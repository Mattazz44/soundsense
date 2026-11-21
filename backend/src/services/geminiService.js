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
          description: 'Short 2 to 4 word mood label, e.g. Warm Melancholic Indie',
        },
        genres: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Up to 4 dominant genres detected in the playlist',
        },
        summary: {
          type: Type.STRING,
          description:
            '2 to 3 complete sentences in natural Indonesian describing the musical mood, tempo, instrumentation, and atmosphere of the playlist. Never truncate.',
        },
      },
      required: ['mood', 'genres', 'summary'],
    },
    recommendations: {
      type: Type.ARRAY,
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
          reason: {
            type: Type.STRING,
            description:
              '1 to 2 poetic yet specific sentences in natural Indonesian explaining why this song fits the playlist',
          },
        },
        required: ['title', 'artist', 'reason'],
      },
    },
    outliers: {
      type: Type.ARRAY,
      description:
        'Songs from the source playlist that clash with or diverge from its dominant mood, genre, tempo, or era. Return an empty array if the playlist is cohesive.',
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
          mismatchScore: {
            type: Type.INTEGER,
            description: 'Mismatch severity from 1 (mild deviation) to 100 (strong clash)',
          },
          reason: {
            type: Type.STRING,
            description:
              '1 to 2 clear sentences in natural Indonesian explaining why this song feels out of place compared to the dominant playlist vibe',
          },
        },
        required: ['trackNumber', 'title', 'artist', 'mismatchScore', 'reason'],
      },
    },
  },
  required: ['vibeAnalysis', 'recommendations', 'outliers'],
};

function sanitizeCopy(text) {
  return String(text ?? '')
    .replace(/\s*\u2014\s*/g, ', ')
    .trim();
}

export async function generatePlaylistRecommendations({ playlistInfo, tracks, limit }) {
  const { ai, apiKey } = getGeminiConfig();
  // Request a small buffer so deduplication or missed Spotify searches still yield the requested limit.
  const candidateCount = Math.min(limit + 4, 20);

  const trackLines = tracks
    .slice(0, 50)
    .map((track, idx) => {
      const yearPart = track.releaseYear ? ` (${track.releaseYear})` : '';
      return `${idx + 1}. ${track.title} - ${track.artist}${yearPart}`;
    })
    .join('\n');

  const prompt = [
    'Kamu adalah kurator musik editorial untuk SoundSense.',
    `Analisis karakter musikal, tempo, tekstur instrumen, dan mood dari playlist "${playlistInfo.name}" berikut:`,
    playlistInfo.description ? `Deskripsi playlist: ${playlistInfo.description}` : null,
    '',
    'Daftar lagu di playlist asal:',
    trackLines,
    '',
    'Tugasmu:',
    '1. Tentukan mood utama yang ringkas (2 sampai 4 kata, contoh: "Warm Melancholic Indie" atau "Late Night Groove").',
    '2. Identifikasi hingga 4 genre dominan.',
    '3. Tulis ringkasan utuh sepanjang 2 sampai 3 kalimat lengkap dalam bahasa Indonesia yang menjelaskan karakter musikal, tempo, instrumen, dan suasana playlist tanpa jargon klise.',
    `4. Rekomendasikan tepat ${candidateCount} lagu BARU yang benar-benar ada di Spotify dan TIDAK ADA di daftar playlist asal di atas. Utamakan variasi artis agar tidak mengulang artis yang sama berkali-kali.`,
    '5. Untuk setiap lagu rekomendasi, tulis alasan ("reason") sepanjang 1 sampai 2 kalimat dalam bahasa Indonesia yang puitis namun konkret (jelaskan keterkaitan aransemen, nuansa vokal, tempo, atau suasana dengan lagu tertentu di playlist asal).',
    '6. Evaluasi kohesi playlist asal untuk field "outliers": deteksi lagu mana dari daftar playlist asal di atas yang terasa kurang sesuai atau melenceng jauh dari mood, genre, energi, atau tempo utama playlist (maksimal 6 lagu dengan ketidaksesuaian paling jelas, urutkan dari mismatchScore tertinggi). Jika semua lagu di playlist sudah selaras, kembalikan array kosong []. Jangan pernah mengarang lagu yang tidak ada di daftar playlist asal.',
    '7. Aturan penulisan: jangan pernah menggunakan karakter em dash (--) dalam teks mana pun; gunakan koma, titik, atau titik dua sebagai gantinya.',
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
        temperature: 0.7,
        maxOutputTokens: 2048,
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

  if (
    !parsed?.vibeAnalysis ||
    !Array.isArray(parsed?.recommendations) ||
    parsed.recommendations.length === 0
  ) {
    throw new AppError(
      502,
      'GEMINI_EMPTY_RESPONSE',
      'Gemini AI tidak mengembalikan daftar rekomendasi yang lengkap.'
    );
  }

  const rawOutliers = Array.isArray(parsed.outliers) ? parsed.outliers : [];

  return {
    vibeAnalysis: {
      mood: sanitizeCopy(parsed.vibeAnalysis.mood) || 'Curated Selection',
      genres: Array.isArray(parsed.vibeAnalysis.genres)
        ? parsed.vibeAnalysis.genres.slice(0, 4).map(sanitizeCopy).filter(Boolean)
        : [],
      summary: sanitizeCopy(parsed.vibeAnalysis.summary),
    },
    recommendations: parsed.recommendations
      .filter((item) => item?.title && item?.artist && item?.reason)
      .map((item) => ({
        title: String(item.title).trim(),
        artist: String(item.artist).trim(),
        reason: sanitizeCopy(item.reason),
      })),
    outliers: rawOutliers
      .filter((item) => item?.title && item?.reason)
      .map((item) => ({
        trackNumber: Number.isInteger(item.trackNumber) ? item.trackNumber : null,
        title: String(item.title).trim(),
        artist: String(item.artist ?? '').trim(),
        mismatchScore: Math.min(100, Math.max(1, Number.parseInt(item.mismatchScore ?? 70, 10) || 70)),
        reason: sanitizeCopy(item.reason),
      })),
  };
}
