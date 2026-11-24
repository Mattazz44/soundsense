const MUSICBRAINZ_ARTIST_SEARCH = 'https://musicbrainz.org/ws/2/artist';
const USER_AGENT = 'SoundSense-App/1.0 (https://github.com/soundsense)';

const artistMetaCache = new Map();

const IGNORED_MB_TAGS = new Set([
  'seen live',
  'english',
  'british',
  'american',
  'uk',
  'usa',
  'the lost generation',
  'rock groups',
  'band',
  'bands',
]);

const INDONESIAN_LEXICON = new Set([
  'aku', 'kamu', 'kita', 'kami', 'dia', 'mereka', 'yang', 'dan', 'atau', 'di', 'ke', 'dari',
  'untuk', 'pada', 'dalam', 'tak', 'tidak', 'bukan', 'jangan', 'sudah', 'belum', 'akan',
  'bisa', 'harus', 'selalu', 'pernah', 'jika', 'bila', 'saat', 'ketika', 'waktu', 'hari',
  'malam', 'pagi', 'senja', 'hujan', 'langit', 'bintang', 'bulan', 'matahari', 'angin',
  'laut', 'jalan', 'rumah', 'kota', 'hati', 'jiwa', 'cinta', 'rindu', 'kasih', 'sayang',
  'luka', 'air', 'mata', 'hilang', 'pulang', 'pergi', 'datang', 'tinggal', 'hidup', 'mati',
  'mimpi', 'kenangan', 'cerita', 'suara', 'lagu', 'nada', 'indah', 'sepi', 'sunyi', 'tenang',
  'hangat', 'dingin', 'gelap', 'terang', 'merah', 'biru', 'hitam', 'putih', 'kuning',
  'jingga', 'semua', 'sendiri', 'bersama', 'tentang', 'antara', 'tanpa', 'karena', 'seperti',
  'bagai', 'bagaikan', 'masih', 'lagi', 'hanya', 'cuma', 'satu', 'dua', 'seribu', 'berlari',
  'menari', 'berjalan', 'melihat', 'mendengar', 'merasa', 'menunggu', 'mencari', 'menangis',
  'tersenyum', 'jatuh', 'terbang', 'mengapa', 'kenapa', 'bagaimana', 'siapa', 'apa', 'mana',
  'kembali', 'selamanya', 'sementara', 'akhirnya', 'mungkin', 'nanti', 'kemarin', 'esok',
  'dunia', 'bumi', 'ruang', 'bayang', 'bayangan', 'duka', 'bahagia', 'percaya', 'janji',
  'peluk', 'genggam', 'lepaskan', 'bertahan', 'berubah', 'berharap', 'mengerti', 'terlalu',
  'sangat', 'lebih', 'paling', 'sama', 'beda', 'baru', 'lama', 'tua', 'muda', 'kecil',
  'besar', 'tinggi', 'rendah', 'panjang', 'jauh', 'dekat', 'luar', 'evaluasi', 'serana',
  'sejuk', 'luruh', 'kelabu', 'semu', 'lara', 'fana', 'abad', 'menepi', 'berdua', 'sore',
]);

const ENGLISH_LEXICON = new Set([
  'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'from', 'by',
  'as', 'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'can', 'could', 'should', 'shall', 'may', 'might',
  'must', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my',
  'your', 'his', 'our', 'their', 'mine', 'yours', 'this', 'that', 'these', 'those', 'what',
  'which', 'who', 'where', 'when', 'why', 'how', 'all', 'some', 'no', 'not', 'never',
  'always', 'ever', 'just', 'only', 'very', 'too', 'more', 'most', 'about', 'into', 'over',
  'after', 'before', 'between', 'under', 'through', 'out', 'up', 'down', 'off', 'away',
  'back', 'here', 'there', 'now', 'then', 'love', 'heart', 'night', 'day', 'time', 'life',
  'dream', 'dreams', 'song', 'rain', 'sky', 'stars', 'moon', 'sun', 'eyes', 'tears', 'mind',
  'soul', 'world', 'home', 'girl', 'boy', 'baby', 'forever', 'alone', 'stay', 'leave', 'fall',
  'falling', 'feel', 'feeling', 'know', 'think', 'want', 'need', 'wait', 'waiting',
  'remember', 'forget', 'broken', 'beautiful', 'sweet', 'dark', 'light', 'blue', 'red',
  'black', 'white', 'young', 'old', 'new', 'little', 'good', 'bad', 'slow', 'fast', 'still',
  'again', 'gone', 'lost', 'found', 'say', 'tell', 'hear', 'see', 'look', 'let', 'make',
  'take', 'give', 'come', 'go', 'run', 'walk', 'sleep', 'wake', 'glue', 'birds', 'feather',
]);

const MICRO_GENRE_FAMILIES = [
  ['shoegaze', 'indonesian shoegaze', 'nu gaze', 'dreamgaze', 'dream pop', 'noise pop', 'slowcore', 'ethereal wave', 'blackgaze'],
  ['indie pop', 'indonesian indie', 'bedroom pop', 'jangle pop', 'twee pop', 'chamber pop', 'indie folk'],
  ['indie rock', 'indonesian indie rock', 'post-punk', 'post-punk revival', 'garage rock', 'britpop', 'slacker rock'],
  ['midwest emo', 'emo', 'math rock', 'post-rock', 'indonesian post-rock', 'twinkle emo'],
  ['alternative r&b', 'contemporary r&b', 'neo soul', 'indie r&b', 'indonesian r&b', 'soul', 'lo-fi r&b'],
  ['lo-fi', 'chillhop', 'chillwave', 'downtempo', 'ambient pop', 'ambient', 'trip hop'],
  ['pop punk', 'skate punk', 'easycore', 'emo pop'],
  ['synth-pop', 'electropop', 'dance-pop', 'disco', 'nu-disco', 'house', 'edm', 'trance', 'eurodance'],
  ['jazz rap', 'conscious hip hop', 'boom bap', 'melodic rap', 'lo-fi hip hop', 'indonesian hip hop'],
];

function tokenizeWords(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

export function normalizeGenreLabel(tag) {
  return String(tag ?? '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function titleCaseGenre(tag) {
  return normalizeGenreLabel(tag)
    .split(' ')
    .map((word) => (word === 'r&b' ? 'R&B' : word === 'edm' ? 'EDM' : word ? word[0].toUpperCase() + word.slice(1) : ''))
    .join(' ');
}

export function scoreTextLanguage(text) {
  const words = tokenizeWords(text);
  let idScore = 0;
  let enScore = 0;

  for (const word of words) {
    if (INDONESIAN_LEXICON.has(word)) idScore += 2;
    if (ENGLISH_LEXICON.has(word)) enScore += 2;
    if (/^(?:meng|men|mem|ber|ter|se|ke)[a-z]{3,}$/.test(word) && !ENGLISH_LEXICON.has(word)) {
      idScore += 1;
    }
    if (/(?:kan|nya|lah)$/.test(word) && word.length >= 5 && !ENGLISH_LEXICON.has(word)) {
      idScore += 1;
    }
  }

  return { idScore, enScore };
}

export function classifyTrackLanguage({
  title = '',
  artist = '',
  subGenre = '',
  artistCountry = null,
  aiLanguage = null,
}) {
  const normSubGenre = normalizeGenreLabel(subGenre);
  const normArtist = String(artist ?? '').toLowerCase();

  let idPoints = 0;
  let enPoints = 0;

  if (/\b(indonesian|indo|malay|jawa|nusantara|dangdut|koplo|jakarta|bandung)\b/i.test(normSubGenre)) {
    idPoints += 6;
  }

  if (artistCountry === 'ID') {
    idPoints += 6;
  } else if (artistCountry && ['US', 'GB', 'CA', 'AU', 'IE', 'NZ', 'SE', 'DE', 'FR', 'JP', 'KR'].includes(artistCountry)) {
    enPoints += 5;
  }

  const textScores = scoreTextLanguage(`${title} ${normArtist}`);
  idPoints += textScores.idScore;
  enPoints += textScores.enScore;

  if (aiLanguage === 'id' || aiLanguage === 'indonesia') {
    idPoints += 3;
  } else if (aiLanguage === 'en' || aiLanguage === 'internasional') {
    enPoints += 3;
  }

  if (idPoints > enPoints && idPoints >= 2) {
    return 'id';
  }
  return 'en';
}

function getGenreFamilyIndex(genre) {
  const norm = normalizeGenreLabel(genre);
  if (!norm) return -1;

  for (let i = 0; i < MICRO_GENRE_FAMILIES.length; i += 1) {
    const family = MICRO_GENRE_FAMILIES[i];
    if (
      family.some((rawMember) => {
        const member = normalizeGenreLabel(rawMember);
        return norm === member || norm.includes(member) || member.includes(norm);
      })
    ) {
      return i;
    }
  }
  return -1;
}

const GENERIC_ROOT_GENRE_TOKENS = new Set([
  'indonesian',
  'indo',
  'pop',
  'rock',
  'indie',
  'music',
  'alternative',
  'alt',
  'modern',
  'classic',
  'new',
  'post',
  'neo',
]);

export function computeSubGenreAlignment(candidateSubGenre, dominantSubGenres) {
  const normCandidate = normalizeGenreLabel(candidateSubGenre);
  if (!normCandidate || !Array.isArray(dominantSubGenres) || dominantSubGenres.length === 0) {
    return { matches: true, boost: 0, isClash: false };
  }

  const normalizedDominants = dominantSubGenres.map(normalizeGenreLabel).filter(Boolean);
  const candidateTokens = new Set(
    normCandidate
      .split(' ')
      .filter((t) => t.length > 2 && !GENERIC_ROOT_GENRE_TOKENS.has(t))
  );

  // 1. Direct or specific sub-genre overlap (ignoring generic roots like pop/rock/indie).
  for (const dom of normalizedDominants) {
    if (normCandidate === dom || normCandidate.includes(dom) || dom.includes(normCandidate)) {
      return { matches: true, boost: 10, isClash: false };
    }
    const domTokens = dom
      .split(' ')
      .filter((t) => t.length > 2 && !GENERIC_ROOT_GENRE_TOKENS.has(t));
    if (domTokens.some((token) => candidateTokens.has(token))) {
      return { matches: true, boost: 7, isClash: false };
    }
  }

  // 2. Same curated micro-genre family (e.g. shoegaze <-> dream pop / nu gaze / slowcore).
  const candidateFamily = getGenreFamilyIndex(normCandidate);
  const dominantFamilies = new Set(
    normalizedDominants.map(getGenreFamilyIndex).filter((idx) => idx >= 0)
  );

  if (candidateFamily >= 0 && dominantFamilies.has(candidateFamily)) {
    return { matches: true, boost: 6, isClash: false };
  }

  if (candidateFamily >= 0 && dominantFamilies.size > 0 && !dominantFamilies.has(candidateFamily)) {
    return { matches: false, boost: -25, isClash: true };
  }

  return { matches: false, boost: -14, isClash: false };
}

async function fetchMusicBrainzArtistMeta(artistName) {
  const cleanName = String(artistName ?? '').split(',')[0]?.trim();
  if (!cleanName || cleanName === 'Unknown Artist') {
    return null;
  }

  const cacheKey = cleanName.toLowerCase();
  if (artistMetaCache.has(cacheKey)) {
    return artistMetaCache.get(cacheKey);
  }

  try {
    const query = `artist:"${cleanName.replace(/"/g, '')}"`;
    const url = `${MUSICBRAINZ_ARTIST_SEARCH}?query=${encodeURIComponent(query)}&fmt=json&limit=1`;
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) {
      return null;
    }

    const data = await response.json().catch(() => null);
    const artist = data?.artists?.[0];
    if (!artist) {
      artistMetaCache.set(cacheKey, null);
      return null;
    }

    const tags = Array.isArray(artist.tags)
      ? artist.tags
          .filter((t) => t?.name && !IGNORED_MB_TAGS.has(String(t.name).toLowerCase()) && !String(t.name).startsWith('_'))
          .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
          .slice(0, 5)
          .map((t) => normalizeGenreLabel(t.name))
      : [];

    const meta = {
      name: cleanName,
      country: artist.country ?? null,
      area: artist.area?.name ?? null,
      tags,
    };
    artistMetaCache.set(cacheKey, meta);
    return meta;
  } catch {
    return null;
  }
}

export async function gatherDominantArtistMetadata(dominantArtists = [], spotifyFetchFn = null, tracks = []) {
  const topNames = dominantArtists.slice(0, 4).map((a) => a.name).filter(Boolean);
  const metadataByArtist = new Map();

  // Check Spotify artist endpoint first in case Extended Quota provides official genres.
  if (spotifyFetchFn && tracks.length > 0) {
    const topArtistIds = [];
    const seen = new Set();
    for (const track of tracks) {
      const primaryName = String(track.artist ?? '').split(',')[0]?.trim();
      if (track.artistId && topNames.includes(primaryName) && !seen.has(track.artistId)) {
        seen.add(track.artistId);
        topArtistIds.push({ id: track.artistId, name: primaryName });
      }
      if (topArtistIds.length >= 4) break;
    }

    await Promise.all(
      topArtistIds.map(async ({ id, name }) => {
        try {
          const spArtist = await spotifyFetchFn(`/artists/${id}`);
          if (Array.isArray(spArtist?.genres) && spArtist.genres.length > 0) {
            metadataByArtist.set(name.toLowerCase(), {
              name,
              country: null,
              tags: spArtist.genres.map(normalizeGenreLabel),
            });
          }
        } catch {
          // Ignore Dev Mode stripped artist genre fields.
        }
      })
    );
  }

  // Space MusicBrainz calls gently to respect public rate limits while staying fast.
  for (const name of topNames) {
    const key = name.toLowerCase();
    const existing = metadataByArtist.get(key);
    if (existing && existing.tags.length > 0) continue;

    const mb = await fetchMusicBrainzArtistMeta(name);
    if (mb) {
      metadataByArtist.set(key, {
        name,
        country: mb.country,
        tags: existing?.tags?.length ? existing.tags : mb.tags,
      });
    }
    if (topNames.length > 1) {
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  return metadataByArtist;
}
