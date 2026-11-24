import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { AppError } from './errors.js';
import {
  computePlaylistAudioProfile,
  detectStatisticalOutliers,
  fetchAudioFeaturesByIds,
  fetchReccoBeatsSeedCandidates,
  scoreTrackAgainstProfile,
  selectCoreSeedTrackIds,
} from './services/audioAnalysisService.js';
import { generatePlaylistRecommendations } from './services/geminiService.js';
import { getTrackLyrics } from './services/lyricsService.js';
import {
  classifyTrackLanguage,
  computeSubGenreAlignment,
  gatherDominantArtistMetadata,
  normalizeGenreLabel,
  titleCaseGenre,
} from './services/genreLanguageService.js';
import {
  enrichRecommendations,
  extractPlaylistId,
  getPlaylistWithTracks,
  searchMicroGenreTracks,
  spotifySafeFetch,
} from './services/spotifyService.js';

const app = express();
const PORT = Number.parseInt(process.env.PORT ?? '5000', 10) || 5000;

const allowedOrigins = (process.env.FRONTEND_URL ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin || allowedOrigins.includes(origin)) {
    return true;
  }
  if (process.env.NODE_ENV !== 'production') {
    return /^https?:\/\/(?:localhost|127\.0\.0\.1):\d+$/.test(origin);
  }
  return false;
}

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }
      return callback(new AppError(403, 'CORS_BLOCKED', 'Origin tidak diizinkan oleh CORS.'));
    },
  })
);

app.use(express.json({ limit: '64kb' }));

const recommendLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: 'Batas permintaan tercapai (maksimal 10 kali per menit). Coba lagi sebentar lagi.',
    code: 'RATE_LIMITED',
  },
});

function parseLimit(rawLimit) {
  if (rawLimit === undefined || rawLimit === null || rawLimit === '') {
    return 10;
  }

  const parsed = Number(rawLimit);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 20) {
    throw new AppError(
      400,
      'INVALID_LIMIT',
      'Jumlah rekomendasi harus berupa angka bulat antara 1 hingga 20.'
    );
  }

  return parsed;
}

export function resolveOutliersAgainstTracks(rawOutliers, sourceTracks) {
  const seenIndices = new Set();
  const resolved = [];

  for (const outlier of rawOutliers ?? []) {
    let matchedIndex = -1;

    if (
      Number.isInteger(outlier.trackNumber) &&
      outlier.trackNumber >= 1 &&
      outlier.trackNumber <= sourceTracks.length
    ) {
      const candidate = sourceTracks[outlier.trackNumber - 1];
      if (candidate.title.toLowerCase() === outlier.title.toLowerCase()) {
        matchedIndex = outlier.trackNumber - 1;
      }
    }

    if (matchedIndex === -1) {
      const targetTitle = outlier.title.toLowerCase();
      matchedIndex = sourceTracks.findIndex(
        (track, idx) => !seenIndices.has(idx) && track.title.toLowerCase() === targetTitle
      );
    }

    if (matchedIndex === -1 || seenIndices.has(matchedIndex)) {
      continue;
    }

    seenIndices.add(matchedIndex);
    resolved.push({
      ...sourceTracks[matchedIndex],
      trackNumber: matchedIndex + 1,
      mismatchScore: outlier.mismatchScore,
      reason: outlier.reason,
    });
  }

  return resolved.sort((a, b) => b.mismatchScore - a.mismatchScore).slice(0, 6);
}

export function computeLanguageSplitTargets(limit, indonesiaCount, internasionalCount) {
  const total = indonesiaCount + internasionalCount;
  const minPerGroup = limit >= 10 ? Math.max(2, Math.round(limit * 0.25)) : 1;
  const maxPerGroup = Math.max(minPerGroup, limit - minPerGroup);

  if (total === 0) {
    const indonesia = Math.ceil(limit / 2);
    return { indonesia, internasional: limit - indonesia };
  }

  const ratio = indonesiaCount / total;
  // Keep both Indonesia and Internasional tabs populated even for single-language playlists.
  let indonesia = Math.round(ratio * limit);
  if (ratio >= 0.85) {
    indonesia = Math.round(limit * 0.7);
  } else if (ratio <= 0.15) {
    indonesia = Math.round(limit * 0.3);
  }

  indonesia = Math.max(minPerGroup, Math.min(maxPerGroup, indonesia));
  const internasional = Math.max(1, limit - indonesia);
  return { indonesia, internasional };
}

function mergeCombinedOutliers(
  statisticalOutliers,
  aiOutliers,
  sourceTracks,
  dominantSubGenres
) {
  const resolvedAi = resolveOutliersAgainstTracks(aiOutliers, sourceTracks);
  const aiByTrackNum = new Map();
  const aiByTitle = new Map();
  for (const item of aiOutliers ?? []) {
    if (Number.isInteger(item.trackNumber)) {
      aiByTrackNum.set(item.trackNumber, item);
    }
    if (item.title) {
      aiByTitle.set(item.title.toLowerCase(), item);
    }
  }

  const mergedByIndex = new Map();

  for (const stat of statisticalOutliers ?? []) {
    const track = sourceTracks[stat.trackNumber - 1] ?? stat;
    const aiMatch =
      aiByTrackNum.get(stat.trackNumber) || aiByTitle.get(stat.title.toLowerCase());
    mergedByIndex.set(stat.trackNumber, {
      ...track,
      trackNumber: stat.trackNumber,
      subGenre: aiMatch?.subGenre || track.subGenre || '',
      mismatchScore: stat.mismatchScore,
      reason: aiMatch?.reason ? aiMatch.reason : stat.reason,
    });
  }

  for (const aiItem of resolvedAi) {
    const existing = mergedByIndex.get(aiItem.trackNumber);
    if (existing) {
      mergedByIndex.set(aiItem.trackNumber, {
        ...existing,
        subGenre: existing.subGenre || aiItem.subGenre || '',
        reason: aiItem.reason || existing.reason,
        mismatchScore: Math.max(existing.mismatchScore, aiItem.mismatchScore),
      });
    } else {
      mergedByIndex.set(aiItem.trackNumber, {
        ...aiItem,
        subGenre: aiItem.subGenre || sourceTracks[aiItem.trackNumber - 1]?.subGenre || '',
      });
    }
  }

  // Deterministic sub-genre clash sweep so blatant genre mismatches are always caught.
  for (const track of sourceTracks) {
    if (mergedByIndex.has(track.trackNumber) || !track.subGenre) continue;
    const align = computeSubGenreAlignment(track.subGenre, dominantSubGenres);
    const hasLowAudioFit = track.similarityScore !== null && track.similarityScore < 75;
    if (align.isClash && (hasLowAudioFit || dominantSubGenres.length > 0)) {
      const domLabel = dominantSubGenres.slice(0, 2).join(', ') || 'karakter inti playlist';
      mergedByIndex.set(track.trackNumber, {
        ...track,
        mismatchScore: hasLowAudioFit ? 78 : 68,
        reason: `Sub-genre ${track.subGenre} pada lagu ini bertolak belakang dengan identitas dominan ${domLabel} di playlist asal.`,
      });
    }
  }

  return Array.from(mergedByIndex.values())
    .sort((a, b) => (b.mismatchScore ?? 0) - (a.mismatchScore ?? 0))
    .slice(0, 6);
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'soundsense-backend' });
});

app.get('/api/lyrics', async (req, res) => {
  const title = typeof req.query.title === 'string' ? req.query.title.trim() : '';
  const artist = typeof req.query.artist === 'string' ? req.query.artist.trim() : '';

  if (!title) {
    return res.status(400).json({
      error: 'Parameter query title wajib diisi.',
      code: 'MISSING_TITLE',
    });
  }

  const lyrics = await getTrackLyrics({ title, artist });
  return res.json(lyrics);
});

app.post('/api/recommend', recommendLimiter, async (req, res, next) => {
  try {
    const { playlistUrl, limit: rawLimit } = req.body ?? {};
    const playlistId = extractPlaylistId(playlistUrl);
    const limit = parseLimit(rawLimit);

    const { playlistInfo, tracks } = await getPlaylistWithTracks(playlistId);
    const trackIds = tracks.map((track) => track.id).filter(Boolean);
    const featuresById = await fetchAudioFeaturesByIds(trackIds);
    const audioProfile = computePlaylistAudioProfile(tracks, featuresById);
    const statisticalOutliers = detectStatisticalOutliers(tracks, featuresById, audioProfile);
    const coreSeedIds = selectCoreSeedTrackIds(tracks, featuresById, audioProfile, 5);

    const [artistMetaByName, seedCandidates] = await Promise.all([
      gatherDominantArtistMetadata(audioProfile.dominantArtists, spotifySafeFetch, tracks),
      fetchReccoBeatsSeedCandidates(coreSeedIds, 25),
    ]);

    const preTagFreq = new Map();
    for (const meta of artistMetaByName.values()) {
      for (const tag of meta.tags ?? []) {
        const clean = normalizeGenreLabel(tag);
        if (clean) {
          preTagFreq.set(clean, (preTagFreq.get(clean) ?? 0) + 1);
        }
      }
    }
    const preSubGenres = Array.from(preTagFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag)
      .slice(0, 3);

    let preIndoCount = 0;
    let preIntlCount = 0;
    for (const track of tracks) {
      const primaryArtist = String(track.artist ?? '').split(',')[0]?.trim().toLowerCase();
      const meta = artistMetaByName.get(primaryArtist);
      const lang = classifyTrackLanguage({
        title: track.title,
        artist: track.artist,
        subGenre: meta?.tags?.[0] ?? '',
        artistCountry: meta?.country ?? null,
      });
      if (lang === 'id') preIndoCount += 1;
      else preIntlCount += 1;
    }

    const preLanguageSplit = computeLanguageSplitTargets(limit, preIndoCount, preIntlCount);
    const microGenreSeeds =
      preSubGenres.length > 0 ? await searchMicroGenreTracks(preSubGenres, 6) : [];

    const aiResult = await generatePlaylistRecommendations({
      playlistInfo,
      tracks,
      limit,
      languageSplit: preLanguageSplit,
      audioProfile,
      artistMetaByName,
      seedCandidates,
      microGenreSeeds,
      statisticalOutliers,
    });

    const seenSubGenreKeys = new Set();
    const dominantSubGenres = [];
    for (const rawTag of [
      ...(aiResult.vibeAnalysis.dominantSubGenres ?? []),
      ...preSubGenres,
      ...(aiResult.vibeAnalysis.genres ?? []),
    ]) {
      const norm = normalizeGenreLabel(rawTag);
      if (!norm || seenSubGenreKeys.has(norm)) continue;
      seenSubGenreKeys.add(norm);
      dominantSubGenres.push(titleCaseGenre(norm));
      if (dominantSubGenres.length >= 6) break;
    }

    const classByTrackNumber = new Map();
    for (const item of aiResult.sourceTrackClassifications ?? []) {
      classByTrackNumber.set(item.trackNumber, item);
    }

    let indoTrackCount = 0;
    let intlTrackCount = 0;
    const enrichedSourceTracks = tracks.map((track, idx) => {
      const trackNumber = idx + 1;
      const features = track.id ? featuresById.get(track.id) : null;
      const metrics = features ? scoreTrackAgainstProfile(features, audioProfile) : null;
      const primaryArtist = String(track.artist ?? '').split(',')[0]?.trim().toLowerCase();
      const artistMeta = artistMetaByName.get(primaryArtist);
      const aiClass = classByTrackNumber.get(trackNumber);
      const rawSubGenre = aiClass?.subGenre || artistMeta?.tags?.[0] || dominantSubGenres[0] || '';
      const language = classifyTrackLanguage({
        title: track.title,
        artist: track.artist,
        subGenre: rawSubGenre,
        artistCountry: artistMeta?.country ?? null,
        aiLanguage: aiClass?.language ?? null,
      });

      if (language === 'id') indoTrackCount += 1;
      else intlTrackCount += 1;

      return {
        ...track,
        trackNumber,
        subGenre: rawSubGenre ? titleCaseGenre(rawSubGenre) : '',
        language,
        similarityScore: metrics?.similarityScore ?? null,
        audioFeatures: features
          ? {
              ...features,
              tempo: Math.round(features.tempo),
            }
          : null,
      };
    });

    const finalLanguageSplit = computeLanguageSplitTargets(limit, indoTrackCount, intlTrackCount);
    const [indoPool, intlPool] = await Promise.all([
      enrichRecommendations(
        aiResult.recommendationsIndonesia,
        tracks,
        finalLanguageSplit.indonesia + 4,
        {
          audioProfile,
          dominantSubGenres,
          fetchFeaturesFn: fetchAudioFeaturesByIds,
          scoreFn: scoreTrackAgainstProfile,
          subGenreAlignFn: computeSubGenreAlignment,
          classifyLangFn: classifyTrackLanguage,
          artistMetaByName,
          targetLanguage: 'id',
        }
      ),
      enrichRecommendations(
        aiResult.recommendationsInternasional,
        tracks,
        finalLanguageSplit.internasional + 4,
        {
          audioProfile,
          dominantSubGenres,
          fetchFeaturesFn: fetchAudioFeaturesByIds,
          scoreFn: scoreTrackAgainstProfile,
          subGenreAlignFn: computeSubGenreAlignment,
          classifyLangFn: classifyTrackLanguage,
          artistMetaByName,
          targetLanguage: 'en',
        }
      ),
    ]);

    const formatRecItem = (item) => ({
      ...item,
      subGenre: item.subGenre ? titleCaseGenre(item.subGenre) : dominantSubGenres[0] || '',
    });

    let indoRecs = indoPool.slice(0, finalLanguageSplit.indonesia).map(formatRecItem);
    let intlRecs = intlPool.slice(0, finalLanguageSplit.internasional).map(formatRecItem);

    // Top up any shortfall using validated overflow from the peer language bucket while preserving strict separation.
    const currentTotal = indoRecs.length + intlRecs.length;
    if (currentTotal < limit) {
      const remaining = limit - currentTotal;
      if (indoRecs.length < finalLanguageSplit.indonesia && intlPool.length > intlRecs.length) {
        const extraIntl = intlPool.slice(intlRecs.length, intlRecs.length + remaining).map(formatRecItem);
        intlRecs = [...intlRecs, ...extraIntl];
      } else if (intlRecs.length < finalLanguageSplit.internasional && indoPool.length > indoRecs.length) {
        const extraIndo = indoPool.slice(indoRecs.length, indoRecs.length + remaining).map(formatRecItem);
        indoRecs = [...indoRecs, ...extraIndo];
      }
    }

    if (indoRecs.length === 0 && intlRecs.length === 0) {
      throw new AppError(
        502,
        'NO_SPOTIFY_MATCHES',
        'Tidak ada lagu rekomendasi yang berhasil dicocokkan di katalog Spotify.'
      );
    }

    const outliers = mergeCombinedOutliers(
      statisticalOutliers,
      aiResult.outliers,
      enrichedSourceTracks,
      dominantSubGenres
    );

    res.json({
      playlistInfo: {
        ...playlistInfo,
        analyzedTracks: tracks.length,
      },
      audioProfile: {
        hasAudioProfile: audioProfile.hasAudioProfile,
        sampleSize: audioProfile.sampleSize,
        dominantArtists: audioProfile.dominantArtists,
        dominantSubGenres,
        languageDistribution: {
          indonesia: indoTrackCount,
          internasional: intlTrackCount,
        },
        centroid: audioProfile.centroid,
      },
      vibeAnalysis: {
        ...aiResult.vibeAnalysis,
        dominantSubGenres,
      },
      sourceTracks: enrichedSourceTracks,
      recommendations: {
        indonesia: indoRecs,
        internasional: intlRecs,
      },
      outliers,
    });
  } catch (error) {
    next(error);
  }
});

app.use((err, _req, res, _next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: 'Format JSON pada request body tidak valid.',
      code: 'INVALID_JSON',
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
    });
  }

  console.error('[SoundSense API Error]', err);
  return res.status(500).json({
    error: 'Terjadi kesalahan internal pada server.',
    code: 'INTERNAL_ERROR',
  });
});

export function startServer(port = PORT) {
  return app.listen(port, () => {
    console.log(`SoundSense backend running on http://localhost:${port}`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer();
}

export default app;
