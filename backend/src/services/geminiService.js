import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { AppError } from '../errors.js';

const PREFERRED_FLASH_MODELS = ['gemini-3-flash-preview', 'gemini-2.5-flash-lite'];
const GEMINI_MODELS_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

let cachedClient = null;
let cachedApiKey = null;

function getGeminiConfig() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new AppError(
      502,
      'GEMINI_CONFIG_MISSING',
      'Konfigurasi GEMINI_API_KEY di backend belum diisi.'
    );
  }

  if (!cachedClient || cachedApiKey !== apiKey) {
    cachedClient = new GoogleGenAI({ apiKey });
    cachedApiKey = apiKey;
  }

  return { ai: cachedClient, apiKey };
}

function isModelNotFoundError(error) {
  if (!error) return false;
  if (error.status === 404 || error.statusCode === 404 || error.code === 404) {
    return true;
  }
  const msg = String(error.message ?? '').toLowerCase();
  return msg.includes('404') || msg.includes('not_found') || msg.includes('is not found');
}

export async function discoverAvailableFlashModels(apiKey, fetchImpl = fetch) {
  const response = await fetchImpl(
    `${GEMINI_MODELS_ENDPOINT}?key=${encodeURIComponent(apiKey)}`
  );
  if (!response.ok) {
    return [];
  }

  const data = await response.json().catch(() => null);
  const models = Array.isArray(data?.models) ? data.models : [];

  return models
    .filter((model) => {
      const methods = Array.isArray(model?.supportedGenerationMethods)
        ? model.supportedGenerationMethods
        : [];
      const shortName = String(model?.name ?? '').replace(/^models\//, '');
      return (
        methods.includes('generateContent') &&
        /^gemini-.*flash/i.test(shortName) &&
        !/(tts|image)/i.test(shortName)
      );
    })
    .map((model) => String(model.name).replace(/^models\//, ''));
}

function buildModelConfig(model, baseConfig) {
  const thinkingConfig = model.includes('gemini-3')
    ? { thinkingLevel: ThinkingLevel.MINIMAL }
    : { thinkingBudget: 0 };

  return {
    ...baseConfig,
    thinkingConfig,
  };
}

export async function generateWithFlashFallback({
  ai,
  apiKey,
  contents,
  config,
  fetchImpl = fetch,
}) {
  const triedModels = new Set();
  let lastError = null;

  for (const model of PREFERRED_FLASH_MODELS) {
    triedModels.add(model);
    try {
      return await ai.models.generateContent({
        model,
        contents,
        config: buildModelConfig(model, config),
      });
    } catch (error) {
      lastError = error;
      if (!isModelNotFoundError(error)) {
        throw error;
      }
    }
  }

  const discoveredModels = await discoverAvailableFlashModels(apiKey, fetchImpl).catch(
    () => []
  );

  for (const model of discoveredModels) {
    if (triedModels.has(model)) continue;
    triedModels.add(model);
    try {
      return await ai.models.generateContent({
        model,
        contents,
        config: buildModelConfig(model, config),
      });
    } catch (error) {
      lastError = error;
      if (!isModelNotFoundError(error)) {
        throw error;
      }
    }
  }

  throw lastError || new Error('Tidak ada model Gemini Flash yang tersedia untuk generateContent.');
}

const recommendationResponseSchema = {
  type: Type.OBJECT,
  properties: {
    vibeAnalysis: {
      type: Type.OBJECT,
      properties: {
        mood: {
          type: Type.STRING,
          description: 'Short 2 to 4 word mood label, e.g. Hazy Shoegaze Reverie',
        },
        dominantSubGenres: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description:
            '3 to 6 specific dominant micro-genres detected in the playlist, e.g. indonesian shoegaze, shoegaze, dream pop, nu gaze, indonesian indie',
        },
        genres: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Up to 4 concise genres detected in the playlist',
        },
        summary: {
          type: Type.STRING,
          description:
            '2 to 3 complete sentences in natural Indonesian describing the musical mood, micro-genre texture, tempo, instrumentation, and atmosphere of the playlist. Never truncate.',
        },
      },
      required: ['mood', 'dominantSubGenres', 'genres', 'summary'],
    },
    sourceTrackClassifications: {
      type: Type.ARRAY,
      description:
        'Concise micro-genre and language tag for each analyzed track in the source playlist.',
      items: {
        type: Type.OBJECT,
        properties: {
          trackNumber: {
            type: Type.INTEGER,
            description: '1-based index of the source track',
          },
          subGenre: {
            type: Type.STRING,
            description: 'Concise 1 to 3 word micro-genre tag, e.g. shoegaze or dream pop',
          },
          language: {
            type: Type.STRING,
            description: 'Exact code: "id" for Indonesian or "en" for English/International',
          },
        },
        required: ['trackNumber', 'subGenre', 'language'],
      },
    },
    recommendationsIndonesia: {
      type: Type.ARRAY,
      description:
        'Curated Indonesian songs strictly belonging to the playlist dominant micro-genres.',
      items: {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description: 'Exact song title available on Spotify',
          },
          artist: {
            type: Type.STRING,
            description: 'Primary artist name',
          },
          subGenre: {
            type: Type.STRING,
            description: 'Specific micro-genre label of this track, e.g. Indonesian Shoegaze',
          },
          reason: {
            type: Type.STRING,
            description:
              '1 to 2 specific sentences in natural Indonesian explaining why this song fits the playlist micro-genre, danceability, and core tracks',
          },
        },
        required: ['title', 'artist', 'subGenre', 'reason'],
      },
    },
    recommendationsInternasional: {
      type: Type.ARRAY,
      description:
        'Curated English or international songs strictly belonging to the playlist dominant micro-genres.',
      items: {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description: 'Exact song title available on Spotify',
          },
          artist: {
            type: Type.STRING,
            description: 'Primary artist name',
          },
          subGenre: {
            type: Type.STRING,
            description: 'Specific micro-genre label of this track, e.g. Dream Pop or Nu Gaze',
          },
          reason: {
            type: Type.STRING,
            description:
              '1 to 2 specific sentences in natural Indonesian explaining why this song fits the playlist micro-genre, danceability, and core tracks',
          },
        },
        required: ['title', 'artist', 'subGenre', 'reason'],
      },
    },
    outliers: {
      type: Type.ARRAY,
      description:
        'Tracks that diverge in audio profile or micro-genre from the playlist core. Empty array if cohesive.',
      items: {
        type: Type.OBJECT,
        properties: {
          trackNumber: {
            type: Type.INTEGER,
            description: '1-based index of the track in the provided source playlist list',
          },
          title: {
            type: Type.STRING,
            description: 'Exact title from the provided source playlist list',
          },
          artist: {
            type: Type.STRING,
            description: 'Artist name from the provided source playlist list',
          },
          subGenre: {
            type: Type.STRING,
            description: 'Micro-genre of the outlier track explaining the contrast',
          },
          mismatchScore: {
            type: Type.INTEGER,
            description: 'Mismatch severity from 1 (mild deviation) to 100 (strong clash)',
          },
          reason: {
            type: Type.STRING,
            description:
              '1 to 2 specific sentences in natural Indonesian citing concrete musical differences (sub-genre, tempo, danceability, energy, or acousticness) against the playlist core',
          },
        },
        required: ['trackNumber', 'title', 'artist', 'subGenre', 'mismatchScore', 'reason'],
      },
    },
  },
  required: [
    'vibeAnalysis',
    'sourceTrackClassifications',
    'recommendationsIndonesia',
    'recommendationsInternasional',
    'outliers',
  ],
};

function sanitizeCopy(text) {
  return String(text ?? '')
    .replace(/\s*\u2014\s*/g, ', ')
    .trim();
}

function normalizeLanguageCode(rawLang) {
  const value = String(rawLang ?? '').trim().toLowerCase();
  if (value === 'id' || value === 'indonesia' || value === 'indonesian') {
    return 'id';
  }
  return 'en';
}

export async function generatePlaylistRecommendations({
  playlistInfo,
  tracks,
  limit,
  languageSplit = null,
  audioProfile = null,
  artistMetaByName = null,
  seedCandidates = [],
  microGenreSeeds = [],
  statisticalOutliers = [],
}) {
  const { ai, apiKey } = getGeminiConfig();
  const indoTarget = languageSplit?.indonesia ?? Math.ceil(limit / 2);
  const intlTarget = languageSplit?.internasional ?? Math.max(1, limit - indoTarget);
  const indoAsk = Math.min(indoTarget + 5, 16);
  const intlAsk = Math.min(intlTarget + 5, 16);

  const trackLines = tracks
    .slice(0, 100)
    .map((track, idx) => {
      const yearPart = track.releaseYear ? ` (${track.releaseYear})` : '';
      return `${idx + 1}. ${track.title} - ${track.artist}${yearPart}`;
    })
    .join('\n');

  const profileSection = audioProfile?.hasAudioProfile && audioProfile.centroid
    ? [
        '',
        `Profil Audio Inti Playlist (Weighted Centroid dari ${audioProfile.sampleSize} lagu):`,
        `- Energi: ${audioProfile.centroid.energy} (skala 0-1)`,
        `- Suasana/Valence: ${audioProfile.centroid.valence} (skala 0-1)`,
        `- Danceability: ${audioProfile.centroid.danceability} (skala 0-1)`,
        `- Akustik: ${audioProfile.centroid.acousticness} (skala 0-1)`,
        `- Instrumentalness: ${audioProfile.centroid.instrumentalness} (skala 0-1)`,
        `- Tempo median: ${audioProfile.centroid.tempo} BPM`,
        audioProfile.dominantArtists?.length
          ? `- Artis paling dominan: ${audioProfile.dominantArtists
              .map((a) => `${a.name} (${a.count}x)`)
              .join(', ')}`
          : null,
      ]
        .filter(Boolean)
        .join('\n')
    : '';

  const artistMetaLines = [];
  if (artistMetaByName instanceof Map && artistMetaByName.size > 0) {
    for (const meta of artistMetaByName.values()) {
      const tagStr = meta.tags?.length ? meta.tags.join(', ') : 'indie';
      const countryStr = meta.country ? ` [${meta.country}]` : '';
      artistMetaLines.push(`- ${meta.name}${countryStr}: ${tagStr}`);
    }
  }

  const artistMetaSection =
    artistMetaLines.length > 0
      ? ['', 'Referensi Sub-Genre Spesifik Artis Dominan (MusicBrainz/Spotify):', ...artistMetaLines].join(
          '\n'
        )
      : '';

  const combinedSeeds = [];
  const seenSeedKeys = new Set();
  for (const c of [...microGenreSeeds, ...seedCandidates]) {
    const key = `${String(c.title ?? '').toLowerCase()}::${String(c.artist ?? '').toLowerCase()}`;
    if (!c.title || !c.artist || seenSeedKeys.has(key)) continue;
    seenSeedKeys.add(key);
    combinedSeeds.push(c);
  }

  const seedSection =
    combinedSeeds.length > 0
      ? [
          '',
          'Kandidat lagu berbasis kecocokan fitur audio dan sub-genre inti playlist:',
          combinedSeeds
            .slice(0, 24)
            .map((c, idx) => `${idx + 1}. ${c.title} - ${c.artist}${c.subGenre ? ` [${c.subGenre}]` : ''}`)
            .join('\n'),
        ].join('\n')
      : '';

  const outlierInstruction =
    statisticalOutliers.length > 0
      ? [
          '',
          'Lagu berikut terdeteksi secara statistik keluar jalur berdasarkan jarak fitur audio terhadap centroid playlist. Evaluasi kembali bersama ketidaksesuaian sub-genre dan jelaskan pada field "outliers" dengan angka nyata berikut:',
          statisticalOutliers
            .map(
              (o) =>
                `- Track #${o.trackNumber}: "${o.title}" oleh ${o.artist} (Tempo ${o.audioFeatures.tempo} BPM, Energi ${o.audioFeatures.energy}, Danceability ${o.audioFeatures.danceability}, Valence ${o.audioFeatures.valence}, Akustik ${o.audioFeatures.acousticness}, Kemiripan ${o.similarityScore}%)`
            )
            .join('\n'),
        ].join('\n')
      : '\nCatatan evaluasi outlier: Deteksi lagu yang keluar jalur baik secara fitur audio (tempo/danceability/energi ekstrem) maupun sub-genre yang berbenturan dengan sub-genre dominan playlist. Jika seluruh lagu selaras, kembalikan "outliers": [].';

  const prompt = [
    'Kamu adalah kurator musik spesialis sub-genre (micro-genre) dan analis audio untuk SoundSense.',
    `Analisis karakter musikal, micro-genre, bahasa lagu, dan kohesi audio dari playlist "${playlistInfo.name}" (${tracks.length} lagu):`,
    playlistInfo.description ? `Deskripsi playlist: ${playlistInfo.description}` : null,
    profileSection,
    artistMetaSection,
    '',
    'Daftar lagu di playlist asal:',
    trackLines,
    seedSection,
    outlierInstruction,
    '',
    'Tugasmu:',
    '1. Tentukan mood utama yang ringkas (2 sampai 4 kata, contoh: "Hazy Shoegaze Reverie" atau "Melancholic Dream Pop").',
    '2. Tentukan 3 sampai 6 "dominantSubGenres" spesifik (contoh: "indonesian shoegaze", "shoegaze", "dream pop", "nu gaze", "indonesian indie") serta maksimal 4 label genre ringkas.',
    '3. Tulis ringkasan utuh sepanjang 2 sampai 3 kalimat lengkap dalam bahasa Indonesia yang menjelaskan karakter sub-genre, tekstur instrumen, tempo, dan suasana playlist.',
    '4. Isi "sourceTrackClassifications" untuk setiap lagu playlist asal (nomor urut, label subGenre singkat 1-3 kata, dan language "id" untuk lagu Indonesia atau "en" untuk Inggris/Internasional).',
    `5. REKOMENDASI TERPISAH BERDASARKAN BAHASA (ANTI-NYASAR):`,
    `   - "recommendationsIndonesia": rekomendasikan tepat ${indoAsk} lagu BERBAHASA INDONESIA yang nyata di Spotify dan berada tepat pada garis keturunan micro-genre dominan playlist.`,
    `   - "recommendationsInternasional": rekomendasikan tepat ${intlAsk} lagu BERBAHASA INGGRIS / INTERNASIONAL yang nyata di Spotify dan berada tepat pada garis keturunan micro-genre dominan playlist.`,
    '   - ATURAN KETAT SUB-GENRE & DANCEABILITY: Jangan pernah merekomendasikan lagu pop/rock/dance-pop generik yang keluar dari micro-genre inti hanya karena skor BPM atau energinya mirip (misal: jika playlist dominan shoegaze atau dream pop yang dreamy dan distorsi reverb, JANGAN merekomendasikan band pop-punk/alt-rock seperti Weezer atau lagu danceable yang melenceng jauh dari profil danceability playlist).',
    '   - Tidak boleh ada lagu yang sudah terdapat di daftar playlist asal, dan jangan mengulang artis yang sama berkali-kali.',
    '   - Untuk setiap lagu rekomendasi, tulis "subGenre" spesifik dan "reason" sepanjang 1 sampai 2 kalimat bahasa Indonesia yang menyebut alasan musikal dan kecocokannya dengan lagu/artis inti playlist.',
    '6. Untuk field "outliers": gabungkan temuan statistik fitur audio di atas dengan ketidaksesuaian sub-genre yang mencolok di daftar lagu asal (jika ada), sebutkan subGenre serta alasan konkretnya.',
    '7. Aturan penulisan: jangan pernah menggunakan karakter em dash (--) di teks mana pun; gunakan koma, titik, atau titik dua.',
  ]
    .filter(Boolean)
    .join('\n');

  let response;
  try {
    response = await generateWithFlashFallback({
      ai,
      apiKey,
      contents: prompt,
      config: {
        temperature: 0.5,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
        responseSchema: recommendationResponseSchema,
      },
    });
  } catch (error) {
    throw new AppError(
      502,
      'GEMINI_UPSTREAM_ERROR',
      `Gagal memproses rekomendasi dengan Gemini AI: ${error?.message || 'kesalahan jaringan'}.`
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(response.text);
  } catch {
    throw new AppError(
      502,
      'GEMINI_INVALID_RESPONSE',
      'Respons dari Gemini AI tidak berbentuk JSON yang valid.'
    );
  }

  const rawIndoRecs = Array.isArray(parsed?.recommendationsIndonesia)
    ? parsed.recommendationsIndonesia
    : [];
  const rawIntlRecs = Array.isArray(parsed?.recommendationsInternasional)
    ? parsed.recommendationsInternasional
    : [];

  if (!parsed?.vibeAnalysis || (rawIndoRecs.length === 0 && rawIntlRecs.length === 0)) {
    throw new AppError(
      502,
      'GEMINI_EMPTY_RESPONSE',
      'Gemini AI tidak mengembalikan daftar rekomendasi yang lengkap.'
    );
  }

  const dominantSubGenres = Array.isArray(parsed.vibeAnalysis.dominantSubGenres)
    ? parsed.vibeAnalysis.dominantSubGenres.map(sanitizeCopy).filter(Boolean).slice(0, 6)
    : [];

  const genres = Array.isArray(parsed.vibeAnalysis.genres)
    ? parsed.vibeAnalysis.genres.slice(0, 4).map(sanitizeCopy).filter(Boolean)
    : dominantSubGenres.slice(0, 4);

  const normalizeRecs = (list, defaultLang) =>
    list
      .filter((item) => item?.title && item?.artist && item?.reason)
      .map((item) => ({
        title: String(item.title).trim(),
        artist: String(item.artist).trim(),
        subGenre: sanitizeCopy(item.subGenre) || dominantSubGenres[0] || '',
        language: defaultLang,
        reason: sanitizeCopy(item.reason),
      }));

  const rawOutliers = Array.isArray(parsed.outliers) ? parsed.outliers : [];
  const rawSourceClassifications = Array.isArray(parsed.sourceTrackClassifications)
    ? parsed.sourceTrackClassifications
    : [];

  return {
    vibeAnalysis: {
      mood: sanitizeCopy(parsed.vibeAnalysis.mood) || 'Curated Selection',
      dominantSubGenres: dominantSubGenres.length > 0 ? dominantSubGenres : genres,
      genres,
      summary: sanitizeCopy(parsed.vibeAnalysis.summary),
    },
    sourceTrackClassifications: rawSourceClassifications
      .filter((item) => Number.isInteger(item?.trackNumber))
      .map((item) => ({
        trackNumber: item.trackNumber,
        subGenre: sanitizeCopy(item.subGenre) || '',
        language: normalizeLanguageCode(item.language),
      })),
    recommendationsIndonesia: normalizeRecs(rawIndoRecs, 'id'),
    recommendationsInternasional: normalizeRecs(rawIntlRecs, 'en'),
    outliers: rawOutliers
      .filter((item) => item?.title && item?.reason)
      .map((item) => ({
        trackNumber: Number.isInteger(item.trackNumber) ? item.trackNumber : null,
        title: String(item.title).trim(),
        artist: String(item.artist ?? '').trim(),
        subGenre: sanitizeCopy(item.subGenre) || '',
        mismatchScore: Math.min(
          100,
          Math.max(1, Number.parseInt(item.mismatchScore ?? 70, 10) || 70)
        ),
        reason: sanitizeCopy(item.reason),
      })),
  };
}
