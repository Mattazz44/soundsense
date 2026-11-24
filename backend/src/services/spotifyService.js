import { AppError } from '../errors.js';

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const SPOTIFY_EMBED_BASE = 'https://open.spotify.com/embed/playlist';
const ITUNES_SEARCH_BASE = 'https://itunes.apple.com/search';
const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

let cachedToken = {
  value: null,
  expiresAt: 0,
};
let inFlightTokenPromise = null;

export function extractPlaylistId(playlistUrl) {
  if (typeof playlistUrl !== 'string' || !playlistUrl.trim()) {
    throw new AppError(400, 'INVALID_PLAYLIST_URL', 'Link playlist Spotify wajib diisi.');
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(playlistUrl.trim());
  } catch {
    throw new AppError(
      400,
      'INVALID_PLAYLIST_URL',
      'Format URL tidak valid. Gunakan link playlist publik dari open.spotify.com.'
    );
  }

  if (parsedUrl.hostname !== 'open.spotify.com') {
    throw new AppError(
      400,
      'INVALID_PLAYLIST_URL',
      'URL harus berasal dari domain open.spotify.com.'
    );
  }

  const match = parsedUrl.pathname.match(
    /^\/(?:intl-[a-z-]+\/)?playlist\/([a-zA-Z0-9]+)\/?$/
  );

  if (!match) {
    throw new AppError(
      400,
      'INVALID_PLAYLIST_URL',
      'Link harus mengarah ke playlist Spotify (contoh: https://open.spotify.com/playlist/...).'
    );
  }

  return match[1];
}

async function fetchClientCredentialsToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID?.trim();
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    throw new AppError(
      502,
      'SPOTIFY_CONFIG_MISSING',
      'Konfigurasi SPOTIFY_CLIENT_ID dan SPOTIFY_CLIENT_SECRET di backend belum diisi.'
    );
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (response.status === 429) {
    const retryAfter = response.headers.get('retry-after');
    throw new AppError(
      429,
      'SPOTIFY_RATE_LIMITED',
      `Spotify API membatasi jumlah permintaan sementara${retryAfter ? ` (coba lagi dalam ${retryAfter} detik)` : ''}.`
    );
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new AppError(
      502,
      'SPOTIFY_AUTH_FAILED',
      `Gagal mengautentikasi ke Spotify API (${response.status})${detail ? `: ${detail}` : '.'}`
    );
  }

  const data = await response.json();
  // Refresh 60 seconds early to avoid race-condition expirations mid-request.
  const expiresInMs = Math.max((data.expires_in ?? 3600) - 60, 30) * 1000;
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + expiresInMs,
  };

  return cachedToken.value;
}

async function getAccessToken() {
  if (cachedToken.value && Date.now() < cachedToken.expiresAt) {
    return cachedToken.value;
  }

  if (!inFlightTokenPromise) {
    inFlightTokenPromise = fetchClientCredentialsToken().finally(() => {
      inFlightTokenPromise = null;
    });
  }

  return inFlightTokenPromise;
}

async function spotifyFetch(path, { allowRetryOnAuth = true } = {}) {
  const token = await getAccessToken();
  const response = await fetch(`${SPOTIFY_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401 && allowRetryOnAuth) {
    cachedToken = { value: null, expiresAt: 0 };
    return spotifyFetch(path, { allowRetryOnAuth: false });
  }

  if (response.status === 401) {
    throw new AppError(
      502,
      'SPOTIFY_UNAUTHORIZED',
      'Token Spotify API tidak valid atau ditolak (401).'
    );
  }

  if (response.status === 400) {
    throw new AppError(
      400,
      'INVALID_PLAYLIST_URL',
      'ID playlist Spotify tidak valid atau tidak dapat dibaca.'
    );
  }

  if (response.status === 404) {
    throw new AppError(
      404,
      'PLAYLIST_NOT_FOUND',
      'Playlist tidak ditemukan, bersifat private, atau dibatasi oleh Spotify.'
    );
  }

  if (response.status === 403) {
    throw new AppError(
      502,
      'SPOTIFY_FORBIDDEN',
      'Spotify API menolak akses ke playlist ini. Pastikan playlist bersifat publik dan izin aplikasi Spotify valid.'
    );
  }

  if (response.status === 429) {
    const retryAfter = response.headers.get('retry-after');
    throw new AppError(
      429,
      'SPOTIFY_RATE_LIMITED',
      `Spotify API membatasi jumlah permintaan sementara${retryAfter ? ` (coba lagi dalam ${retryAfter} detik)` : ''}.`
    );
  }

  if (!response.ok) {
    throw new AppError(
      502,
      'SPOTIFY_UPSTREAM_ERROR',
      `Gagal mengambil data dari Spotify API (status ${response.status}).`
    );
  }

  return response.json();
}

function parseReleaseYear(releaseDate) {
  if (typeof releaseDate !== 'string' || releaseDate.length < 4) {
    return null;
  }
  const year = Number.parseInt(releaseDate.slice(0, 4), 10);
  return Number.isNaN(year) ? null : year;
}

function pickBestCoverImage(images) {
  if (!Array.isArray(images) || images.length === 0) {
    return null;
  }
  return images[0]?.url ?? images[images.length - 1]?.url ?? null;
}

function normalizeTrack(track) {
  if (!track || track.type !== 'track' || !track.name) {
    return null;
  }

  const artistNames = Array.isArray(track.artists)
    ? track.artists.map((artist) => artist?.name).filter(Boolean)
    : [];

  return {
    id: track.id ?? null,
    artistId: track.artists?.[0]?.id ?? null,
    title: track.name,
    artist: artistNames.join(', ') || 'Unknown Artist',
    album: track.album?.name ?? '',
    coverUrl: pickBestCoverImage(track.album?.images),
    spotifyUrl: track.external_urls?.spotify ?? null,
    previewUrl: track.preview_url ?? null,
    releaseYear: parseReleaseYear(track.album?.release_date),
    durationMs: typeof track.duration_ms === 'number' ? track.duration_ms : null,
  };
}

function buildTrackKey(title, artist) {
  return `${String(title).toLowerCase().trim()}::${String(artist).toLowerCase().trim()}`;
}

function pickEmbedPlaylistImage(entity) {
  const visualImages = entity?.visualIdentity?.image;
  if (Array.isArray(visualImages) && visualImages.length > 0) {
    return visualImages[visualImages.length - 1]?.url ?? visualImages[0]?.url ?? null;
  }

  const coverSources = entity?.coverArt?.sources;
  if (Array.isArray(coverSources) && coverSources.length > 0) {
    return coverSources[0]?.url ?? null;
  }

  return null;
}

function extractEmbedDescription(entity) {
  if (!Array.isArray(entity?.attributes)) {
    return '';
  }

  const descAttr = entity.attributes.find(
    (attr) => attr?.key === 'episode_description' || attr?.key === 'description'
  );
  return typeof descAttr?.value === 'string' ? descAttr.value.trim() : '';
}

function extractTrackIdFromUri(uri) {
  if (typeof uri !== 'string') {
    return null;
  }
  const match = uri.match(/^spotify:track:([a-zA-Z0-9]+)$/);
  return match ? match[1] : null;
}

function normalizeEmbedTrack(item, fallbackCoverUrl) {
  const trackId = extractTrackIdFromUri(item?.uri);
  const title = typeof item?.title === 'string' ? item.title.trim() : '';
  if (!title || (!trackId && item?.entityType !== 'track')) {
    return null;
  }

  // Embed artist strings often use non-breaking spaces after commas.
  const artist =
    typeof item?.subtitle === 'string' && item.subtitle.trim()
      ? item.subtitle.replace(/\u00a0/g, ' ').trim()
      : 'Unknown Artist';

  return {
    id: trackId,
    title,
    artist,
    album: '',
    coverUrl: fallbackCoverUrl ?? null,
    spotifyUrl: trackId ? `https://open.spotify.com/track/${trackId}` : null,
    previewUrl: item?.audioPreview?.url ?? null,
    releaseYear: null,
    durationMs: typeof item?.duration === 'number' ? item.duration : null,
  };
}

async function fetchTrackCoverViaOembed(trackId) {
  try {
    const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(
      `https://open.spotify.com/track/${trackId}`
    )}`;
    const response = await fetch(oembedUrl, {
      headers: { 'User-Agent': BROWSER_USER_AGENT },
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data?.thumbnail_url ?? null;
  } catch {
    return null;
  }
}

async function enrichEmbedTracks(embedTracks) {
  // Single-track GET /v1/tracks/{id} remains accessible even when /playlists/{id}/tracks returns 403.
  return mapWithConcurrency(embedTracks, 8, async (track) => {
    if (!track.id) {
      return track;
    }

    try {
      const apiTrack = normalizeTrack(await spotifyFetch(`/tracks/${track.id}`));
      if (apiTrack) {
        return {
          ...apiTrack,
          previewUrl: apiTrack.previewUrl ?? track.previewUrl,
        };
      }
    } catch {
      // Fall back to unauthenticated oEmbed thumbnail if track lookup fails.
    }

    const oembedCover = await fetchTrackCoverViaOembed(track.id);
    if (oembedCover) {
      return {
        ...track,
        coverUrl: oembedCover,
      };
    }

    return track;
  });
}

export function parseEmbedPlaylistHtml(html, playlistId) {
  const nextDataMatch = html.match(
    /<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/
  );
  if (!nextDataMatch) {
    throw new AppError(
      502,
      'SPOTIFY_EMBED_PARSE_ERROR',
      'Gagal membaca metadata playlist dari halaman publik Spotify.'
    );
  }

  let nextData;
  try {
    nextData = JSON.parse(nextDataMatch[1]);
  } catch {
    throw new AppError(
      502,
      'SPOTIFY_EMBED_PARSE_ERROR',
      'Data JSON pada halaman Spotify Embed tidak valid.'
    );
  }

  const entity = nextData?.props?.pageProps?.state?.data?.entity;
  if (!entity || !Array.isArray(entity.trackList)) {
    throw new AppError(
      404,
      'PLAYLIST_NOT_FOUND',
      'Playlist tidak ditemukan, bersifat private, atau tidak memiliki daftar lagu.'
    );
  }

  const playlistCover = pickEmbedPlaylistImage(entity);
  const rawTracks = entity.trackList
    .slice(0, 100)
    .map((item) => normalizeEmbedTrack(item, playlistCover))
    .filter(Boolean);

  if (rawTracks.length === 0) {
    throw new AppError(
      400,
      'EMPTY_PLAYLIST',
      'Playlist ini belum memiliki lagu yang dapat dianalisis.'
    );
  }

  return {
    playlistInfo: {
      id: entity.id ?? playlistId,
      name: entity.name ?? entity.title ?? 'Untitled Playlist',
      description: extractEmbedDescription(entity),
      owner:
        typeof entity.subtitle === 'string' && entity.subtitle.trim()
          ? entity.subtitle.replace(/\u00a0/g, ' ').trim()
          : 'Spotify User',
      image: playlistCover,
      spotifyUrl: `https://open.spotify.com/playlist/${playlistId}`,
      totalTracks: entity.trackList.length,
    },
    rawTracks,
  };
}

async function fetchPlaylistFromEmbed(playlistId) {
  const response = await fetch(`${SPOTIFY_EMBED_BASE}/${playlistId}`, {
    headers: {
      'User-Agent': BROWSER_USER_AGENT,
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (response.status === 404) {
    throw new AppError(
      404,
      'PLAYLIST_NOT_FOUND',
      'Playlist tidak ditemukan, bersifat private, atau dibatasi oleh Spotify.'
    );
  }

  if (response.status === 429) {
    const retryAfter = response.headers.get('retry-after');
    throw new AppError(
      429,
      'SPOTIFY_RATE_LIMITED',
      `Spotify API membatasi jumlah permintaan sementara${retryAfter ? ` (coba lagi dalam ${retryAfter} detik)` : ''}.`
    );
  }

  if (!response.ok) {
    throw new AppError(
      502,
      'SPOTIFY_EMBED_UPSTREAM_ERROR',
      `Gagal memuat halaman publik playlist Spotify (status ${response.status}).`
    );
  }

  const html = await response.text();
  const { playlistInfo, rawTracks } = parseEmbedPlaylistHtml(html, playlistId);
  const tracks = await enrichEmbedTracks(rawTracks);

  return {
    playlistInfo,
    tracks,
  };
}

function shouldUseEmbedFallback(error) {
  return (
    error instanceof AppError &&
    ['SPOTIFY_FORBIDDEN', 'SPOTIFY_UNAUTHORIZED', 'SPOTIFY_AUTH_FAILED', 'PLAYLIST_NOT_FOUND'].includes(
      error.code
    )
  );
}

export async function getPlaylistWithTracks(playlistId) {
  const playlistFields = encodeURIComponent(
    'id,name,description,owner(display_name),images,external_urls(spotify),tracks(total)'
  );
  const trackFields = encodeURIComponent(
    'items(track(id,type,name,duration_ms,preview_url,external_urls(spotify),artists(id,name),album(name,release_date,images)))'
  );

  try {
    const [playlistData, tracksData] = await Promise.all([
      spotifyFetch(`/playlists/${playlistId}?fields=${playlistFields}`),
      spotifyFetch(`/playlists/${playlistId}/tracks?limit=100&fields=${trackFields}`),
    ]);

    const tracks = (tracksData.items ?? [])
      .map((item) => normalizeTrack(item?.track))
      .filter(Boolean);

    if (tracks.length === 0) {
      throw new AppError(
        400,
        'EMPTY_PLAYLIST',
        'Playlist ini belum memiliki lagu yang dapat dianalisis.'
      );
    }

    return {
      playlistInfo: {
        id: playlistData.id ?? playlistId,
        name: playlistData.name ?? 'Untitled Playlist',
        description: playlistData.description ?? '',
        owner: playlistData.owner?.display_name ?? 'Spotify User',
        image: pickBestCoverImage(playlistData.images),
        spotifyUrl:
          playlistData.external_urls?.spotify ?? `https://open.spotify.com/playlist/${playlistId}`,
        totalTracks: playlistData.tracks?.total ?? tracks.length,
      },
      tracks,
    };
  } catch (error) {
    if (shouldUseEmbedFallback(error)) {
      return fetchPlaylistFromEmbed(playlistId);
    }
    throw error;
  }
}

async function fetchItunesPreviewUrl(title, artist) {
  const queryTerms = [`${title} ${artist}`];
  const primaryArtist = String(artist ?? '').split(',')[0]?.trim();
  if (primaryArtist && primaryArtist !== artist) {
    queryTerms.push(`${title} ${primaryArtist}`);
  }

  for (const term of queryTerms) {
    try {
      const url = `${ITUNES_SEARCH_BASE}?term=${encodeURIComponent(term)}&media=music&limit=1`;
      const response = await fetch(url, { signal: AbortSignal.timeout(4500) });
      if (!response.ok) {
        continue;
      }
      const data = await response.json();
      const previewUrl = data?.results?.[0]?.previewUrl;
      if (typeof previewUrl === 'string' && previewUrl.startsWith('http')) {
        return previewUrl;
      }
    } catch {
      // Ignore transient iTunes lookup errors so recommendation matching never fails.
    }
  }

  return null;
}

async function searchSingleTrack(title, artist) {
  const strictQuery = encodeURIComponent(`track:${title} artist:${artist}`);
  const strictResult = await spotifyFetch(`/search?q=${strictQuery}&type=track&limit=1`);
  const strictTrack = normalizeTrack(strictResult.tracks?.items?.[0]);
  if (strictTrack) {
    return strictTrack;
  }

  // Fallback to free-text search when punctuation or featured artists prevent exact field matches.
  const looseQuery = encodeURIComponent(`${title} ${artist}`);
  const looseResult = await spotifyFetch(`/search?q=${looseQuery}&type=track&limit=1`);
  return normalizeTrack(looseResult.tracks?.items?.[0]);
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

export async function spotifySafeFetch(path) {
  return spotifyFetch(path);
}

export async function searchMicroGenreTracks(subGenres = [], limitPerGenre = 8) {
  const queries = subGenres
    .map((g) => String(g ?? '').trim())
    .filter(Boolean)
    .slice(0, 2);

  const collected = [];
  for (const genre of queries) {
    try {
      const q = encodeURIComponent(`genre:"${genre}"`);
      const res = await spotifyFetch(`/search?q=${q}&type=track&limit=${limitPerGenre}`);
      const items = (res?.tracks?.items ?? []).map(normalizeTrack).filter(Boolean);
      for (const item of items) {
        collected.push({ ...item, subGenre: genre });
      }
    } catch {
      // Ignore individual genre search misses.
    }
  }
  return collected;
}

export async function enrichRecommendations(
  aiRecommendations,
  sourceTracks,
  limit,
  {
    audioProfile = null,
    dominantSubGenres = [],
    fetchFeaturesFn = null,
    scoreFn = null,
    subGenreAlignFn = null,
    classifyLangFn = null,
    artistMetaByName = new Map(),
    targetLanguage = null,
  } = {}
) {
  const seenIds = new Set(sourceTracks.map((track) => track.id).filter(Boolean));
  const seenKeys = new Set(
    sourceTracks.map((track) => buildTrackKey(track.title, track.artist))
  );

  const enrichedCandidates = await mapWithConcurrency(
    aiRecommendations,
    5,
    async (item) => {
      try {
        const matched = await searchSingleTrack(item.title, item.artist);
        if (!matched) {
          return null;
        }
        const previewUrl =
          matched.previewUrl || (await fetchItunesPreviewUrl(matched.title, matched.artist));
        return {
          ...matched,
          previewUrl,
          subGenre: item.subGenre || '',
          aiLanguage: item.language || null,
          reason: item.reason,
        };
      } catch {
        return null;
      }
    }
  );

  const uniqueCandidates = [];
  for (const track of enrichedCandidates) {
    if (!track) continue;
    const key = buildTrackKey(track.title, track.artist);
    if ((track.id && seenIds.has(track.id)) || seenKeys.has(key)) {
      continue;
    }

    if (track.id) seenIds.add(track.id);
    seenKeys.add(key);
    uniqueCandidates.push(track);
  }

  let featuresById = new Map();
  if (audioProfile?.hasAudioProfile && fetchFeaturesFn && uniqueCandidates.length > 0) {
    const candidateIds = uniqueCandidates.map((t) => t.id).filter(Boolean);
    featuresById = await fetchFeaturesFn(candidateIds);
  }

  const scored = [];
  for (const track of uniqueCandidates) {
    const primaryArtist = String(track.artist ?? '').split(',')[0]?.trim().toLowerCase();
    const artistCountry = artistMetaByName.get(primaryArtist)?.country ?? null;
    const detectedLanguage = classifyLangFn
      ? classifyLangFn({
          title: track.title,
          artist: track.artist,
          subGenre: track.subGenre,
          artistCountry,
          aiLanguage: track.aiLanguage,
        })
      : track.aiLanguage === 'id'
        ? 'id'
        : 'en';

    if (targetLanguage && detectedLanguage !== targetLanguage) {
      continue;
    }

    const features = track.id ? featuresById.get(track.id) : null;
    let baseScore = 76;
    if (features && scoreFn && audioProfile?.hasAudioProfile) {
      const metrics = scoreFn(features, audioProfile);
      if (metrics) {
        baseScore = metrics.similarityScore;
      }

      // Strict danceability divergence guard (e.g. rejects danceable pop/rock on shoegaze playlists).
      const centroidDance = audioProfile.centroid?.danceability;
      if (typeof centroidDance === 'number') {
        const danceDiff = Math.abs(features.danceability - centroidDance);
        if (centroidDance <= 0.55 && features.danceability > centroidDance + 0.28) {
          continue;
        }
        if (danceDiff > 0.34) {
          continue;
        }
        if (danceDiff > 0.16) {
          baseScore -= Math.round((danceDiff - 0.16) * 115);
        }
      }
    }

    const alignment = subGenreAlignFn
      ? subGenreAlignFn(track.subGenre, dominantSubGenres)
      : { matches: true, boost: 0, isClash: false };

    if (alignment.isClash && baseScore < 72) {
      continue;
    }

    const finalScore = Math.min(99, Math.max(35, baseScore + alignment.boost));
    scored.push({
      ...track,
      language: detectedLanguage,
      matchScore: finalScore,
      audioFeatures: features
        ? {
            ...features,
            tempo: Math.round(features.tempo),
          }
        : null,
    });
  }

  scored.sort((a, b) => b.matchScore - a.matchScore);
  return scored.slice(0, limit);
}
