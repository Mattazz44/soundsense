import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { AppError } from './errors.js';
import { generatePlaylistRecommendations } from './services/geminiService.js';
import { getTrackLyrics } from './services/lyricsService.js';
import {
  enrichRecommendations,
  extractPlaylistId,
  getPlaylistWithTracks,
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
    const aiResult = await generatePlaylistRecommendations({
      playlistInfo,
      tracks,
      limit,
    });

    const recommendations = await enrichRecommendations(
      aiResult.recommendations,
      tracks,
      limit
    );

    if (recommendations.length === 0) {
      throw new AppError(
        502,
        'NO_SPOTIFY_MATCHES',
        'Tidak ada lagu rekomendasi yang berhasil dicocokkan di katalog Spotify.'
      );
    }

    const outliers = resolveOutliersAgainstTracks(aiResult.outliers, tracks);

    res.json({
      playlistInfo: {
        ...playlistInfo,
        analyzedTracks: tracks.length,
      },
      vibeAnalysis: aiResult.vibeAnalysis,
      sourceTracks: tracks.map((track, idx) => ({
        ...track,
        trackNumber: idx + 1,
      })),
      recommendations,
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
