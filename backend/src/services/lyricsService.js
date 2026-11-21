const LRCLIB_BASE = 'https://lrclib.net/api';
const USER_AGENT = 'SoundSense-App/1.0 (https://github.com/soundsense)';
const MAX_CACHE_ENTRIES = 500;

const lyricsCache = new Map();

function cleanTrackTitle(rawTitle) {
  return String(rawTitle ?? '')
    .replace(/\s*\((?:feat\.|ft\.|with|remaster(?:ed)?|live|acoustic)[^)]*\)/gi, '')
    .replace(/\s*-\s*(?:remaster(?:ed)?|radio edit|single version|acoustic).*$/i, '')
    .trim();
}

function getPrimaryArtist(rawArtist) {
  return String(rawArtist ?? '').split(',')[0]?.trim() || '';
}

function buildCacheKey(title, artist) {
  return `${title.toLowerCase().trim()}::${artist.toLowerCase().trim()}`;
}

function setCachedLyrics(key, value) {
  if (lyricsCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = lyricsCache.keys().next().value;
    if (oldestKey !== undefined) {
      lyricsCache.delete(oldestKey);
    }
  }
  lyricsCache.set(key, value);
}

function normalizeLyricsPayload(entry) {
  if (!entry || entry.instrumental) {
    return {
      plainLyrics: null,
      syncedLyrics: null,
      instrumental: Boolean(entry?.instrumental),
    };
  }

  const plainLyrics =
    typeof entry.plainLyrics === 'string' && entry.plainLyrics.trim()
      ? entry.plainLyrics.trim()
      : null;
  const syncedLyrics =
    typeof entry.syncedLyrics === 'string' && entry.syncedLyrics.trim()
      ? entry.syncedLyrics.trim()
      : null;

  return {
    plainLyrics,
    syncedLyrics,
    instrumental: false,
  };
}

async function fetchLrcLibJson(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
    },
    signal: AbortSignal.timeout(6000),
  });

  if (!response.ok) {
    return null;
  }

  return response.json().catch(() => null);
}

export async function getTrackLyrics({ title, artist, fetchImpl }) {
  const cleanTitle = String(title ?? '').trim();
  const cleanArtist = String(artist ?? '').trim();
  const primaryArtist = getPrimaryArtist(cleanArtist);

  if (!cleanTitle) {
    return { plainLyrics: null, syncedLyrics: null, instrumental: false };
  }

  const cacheKey = buildCacheKey(cleanTitle, primaryArtist || cleanArtist);
  if (!fetchImpl && lyricsCache.has(cacheKey)) {
    return lyricsCache.get(cacheKey);
  }

  const runFetch = fetchImpl ?? fetchLrcLibJson;
  const strippedTitle = cleanTrackTitle(cleanTitle);
  const artistToQuery = primaryArtist || cleanArtist;

  try {
    if (artistToQuery) {
      const exactUrl = `${LRCLIB_BASE}/get?artist_name=${encodeURIComponent(
        artistToQuery
      )}&track_name=${encodeURIComponent(cleanTitle)}`;
      const exactHit = await runFetch(exactUrl);
      const normalized = normalizeLyricsPayload(exactHit);
      if (normalized.plainLyrics || normalized.syncedLyrics || normalized.instrumental) {
        if (!fetchImpl) setCachedLyrics(cacheKey, normalized);
        return normalized;
      }

      if (strippedTitle && strippedTitle !== cleanTitle) {
        const cleanUrl = `${LRCLIB_BASE}/get?artist_name=${encodeURIComponent(
          artistToQuery
        )}&track_name=${encodeURIComponent(strippedTitle)}`;
        const cleanHit = await runFetch(cleanUrl);
        const normalizedClean = normalizeLyricsPayload(cleanHit);
        if (
          normalizedClean.plainLyrics ||
          normalizedClean.syncedLyrics ||
          normalizedClean.instrumental
        ) {
          if (!fetchImpl) setCachedLyrics(cacheKey, normalizedClean);
          return normalizedClean;
        }
      }
    }

    const searchQuery = [strippedTitle || cleanTitle, artistToQuery].filter(Boolean).join(' ');
    const searchUrl = `${LRCLIB_BASE}/search?q=${encodeURIComponent(searchQuery)}`;
    const searchResults = await runFetch(searchUrl);

    if (Array.isArray(searchResults) && searchResults.length > 0) {
      const preferred =
        searchResults.find((item) => item?.syncedLyrics) ||
        searchResults.find((item) => item?.plainLyrics) ||
        searchResults[0];
      const normalizedSearch = normalizeLyricsPayload(preferred);
      if (!fetchImpl) setCachedLyrics(cacheKey, normalizedSearch);
      return normalizedSearch;
    }
  } catch {
    // Gracefully fall through to empty lyrics so UI never crashes on upstream timeout.
  }

  const emptyResult = { plainLyrics: null, syncedLyrics: null, instrumental: false };
  if (!fetchImpl) setCachedLyrics(cacheKey, emptyResult);
  return emptyResult;
}
