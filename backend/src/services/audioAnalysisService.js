const RECCOBEATS_API_BASE = 'https://api.reccobeats.com/v1';
const FEATURE_KEYS = [
  'energy',
  'valence',
  'danceability',
  'acousticness',
  'instrumentalness',
  'tempo',
];

const FEATURE_LABELS_ID = {
  energy: 'energi',
  valence: 'suasana ceria',
  danceability: 'danceability',
  acousticness: 'nuansa akustik',
  instrumentalness: 'instrumental',
  tempo: 'tempo',
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function extractSpotifyTrackId(href) {
  if (typeof href !== 'string') return null;
  const match = href.match(/\/track\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

function normalizeFeatures(raw) {
  if (!raw || typeof raw.energy !== 'number' || typeof raw.tempo !== 'number') {
    return null;
  }

  return {
    energy: clamp(raw.energy, 0, 1),
    valence: clamp(raw.valence ?? 0.5, 0, 1),
    danceability: clamp(raw.danceability ?? 0.5, 0, 1),
    acousticness: clamp(raw.acousticness ?? 0.2, 0, 1),
    instrumentalness: clamp(raw.instrumentalness ?? 0, 0, 1),
    tempo: clamp(raw.tempo, 30, 240),
  };
}

function toNormalizedVector(features) {
  return [
    features.energy,
    features.valence,
    features.danceability,
    features.acousticness,
    features.instrumentalness,
    clamp(features.tempo / 200, 0, 1),
  ];
}

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function euclideanDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum / a.length);
}

function cosineSimilarity(a, b) {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export async function fetchAudioFeaturesByIds(trackIds, fetchImpl = fetch) {
  const uniqueIds = [...new Set((trackIds ?? []).filter(Boolean))];
  const featuresById = new Map();
  if (uniqueIds.length === 0) {
    return featuresById;
  }

  const batches = [];
  for (let i = 0; i < uniqueIds.length; i += 40) {
    batches.push(uniqueIds.slice(i, i + 40));
  }

  await Promise.all(
    batches.map(async (batch) => {
      try {
        const url = `${RECCOBEATS_API_BASE}/audio-features?ids=${encodeURIComponent(
          batch.join(',')
        )}`;
        const response = await fetchImpl(url, {
          signal: AbortSignal.timeout(6000),
        });
        if (!response.ok) return;

        const payload = await response.json().catch(() => null);
        const items = Array.isArray(payload?.content) ? payload.content : [];
        for (const item of items) {
          const spotifyId = extractSpotifyTrackId(item?.href);
          const normalized = normalizeFeatures(item);
          if (spotifyId && normalized) {
            featuresById.set(spotifyId, normalized);
          }
        }
      } catch {
        // Ignore transient external audio-feature failures so playlist analysis still completes.
      }
    })
  );

  return featuresById;
}

export async function fetchReccoBeatsSeedCandidates(seedTrackIds, size = 25, fetchImpl = fetch) {
  const seeds = [...new Set((seedTrackIds ?? []).filter(Boolean))].slice(0, 5);
  if (seeds.length === 0) {
    return [];
  }

  try {
    const url = `${RECCOBEATS_API_BASE}/track/recommendation?size=${size}&seeds=${encodeURIComponent(
      seeds.join(',')
    )}`;
    const response = await fetchImpl(url, {
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) return [];

    const payload = await response.json().catch(() => null);
    const items = Array.isArray(payload?.content) ? payload.content : [];
    return items
      .map((item) => {
        const spotifyId = extractSpotifyTrackId(item?.href);
        const title = typeof item?.trackTitle === 'string' ? item.trackTitle.trim() : '';
        const artist = Array.isArray(item?.artists)
          ? item.artists.map((a) => a?.name).filter(Boolean).join(', ')
          : '';
        if (!title || !artist) return null;
        return {
          spotifyId,
          title,
          artist,
          durationMs: typeof item?.durationMs === 'number' ? item.durationMs : null,
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function extractDominantArtists(tracks) {
  const counts = new Map();
  for (const track of tracks) {
    const primary = String(track?.artist ?? '').split(',')[0]?.trim();
    if (!primary || primary === 'Unknown Artist') continue;
    counts.set(primary, (counts.get(primary) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count]) => ({ name, count }));
}

export function computePlaylistAudioProfile(tracks, featuresById) {
  const dominantArtists = extractDominantArtists(tracks);
  const featured = tracks
    .map((track, idx) => {
      const features = track?.id ? featuresById.get(track.id) : null;
      return features ? { track, trackNumber: idx + 1, features } : null;
    })
    .filter(Boolean);

  if (featured.length < 3) {
    return {
      hasAudioProfile: false,
      sampleSize: featured.length,
      dominantArtists,
      centroid: null,
      medianFeatures: null,
      robustStd: null,
    };
  }

  const medianFeatures = {};
  const robustStd = {};

  for (const key of FEATURE_KEYS) {
    const vals = featured.map((entry) => entry.features[key]);
    const med = median(vals);
    const deviations = vals.map((val) => Math.abs(val - med));
    const mad = median(deviations);
    const stdFloor = key === 'tempo' ? 14 : 0.1;
    medianFeatures[key] = med;
    robustStd[key] = Math.max(stdFloor, 1.4826 * mad);
  }

  const medianVec = toNormalizedVector(medianFeatures);
  const weightedSums = {
    energy: 0,
    valence: 0,
    danceability: 0,
    acousticness: 0,
    instrumentalness: 0,
    tempo: 0,
  };
  let weightTotal = 0;

  // Dampen extreme outliers so 1-2 discordant tracks do not pull the playlist centroid.
  for (const entry of featured) {
    const vec = toNormalizedVector(entry.features);
    const dist = euclideanDistance(vec, medianVec);
    const weight = 1 / (1 + (dist / 0.24) ** 2);
    weightTotal += weight;
    for (const key of FEATURE_KEYS) {
      weightedSums[key] += entry.features[key] * weight;
    }
  }

  const centroid = {};
  for (const key of FEATURE_KEYS) {
    const rawVal = weightedSums[key] / Math.max(weightTotal, 1e-6);
    centroid[key] = key === 'tempo' ? Math.round(rawVal) : Number(rawVal.toFixed(2));
  }

  return {
    hasAudioProfile: true,
    sampleSize: featured.length,
    dominantArtists,
    centroid,
    medianFeatures,
    robustStd,
  };
}

export function scoreTrackAgainstProfile(features, profile) {
  if (!features || !profile?.hasAudioProfile || !profile.centroid) {
    return null;
  }

  const trackVec = toNormalizedVector(features);
  const centroidVec = toNormalizedVector(profile.centroid);

  const dist = euclideanDistance(trackVec, centroidVec);
  const euclideanSim = Math.exp(-3.2 * dist);
  const cosSim = cosineSimilarity(trackVec, centroidVec);
  const combined = clamp(0.65 * euclideanSim + 0.35 * cosSim, 0, 1);
  const similarityScore = Math.round(combined * 100);

  const zScores = {};
  let zSquareSum = 0;
  for (const key of FEATURE_KEYS) {
    const z = (features[key] - profile.medianFeatures[key]) / profile.robustStd[key];
    zScores[key] = z;
    zSquareSum += z * z;
  }
  const rmsZScore = Number(Math.sqrt(zSquareSum / FEATURE_KEYS.length).toFixed(2));

  return {
    similarityScore,
    rmsZScore,
    zScores,
  };
}

export function selectCoreSeedTrackIds(tracks, featuresById, profile, maxSeeds = 5) {
  if (!profile?.hasAudioProfile) {
    return tracks
      .map((t) => t.id)
      .filter(Boolean)
      .slice(0, maxSeeds);
  }

  const scored = tracks
    .map((track) => {
      const features = track?.id ? featuresById.get(track.id) : null;
      if (!features) return null;
      const metrics = scoreTrackAgainstProfile(features, profile);
      return { track, similarityScore: metrics?.similarityScore ?? 0 };
    })
    .filter(Boolean)
    .sort((a, b) => b.similarityScore - a.similarityScore);

  const selected = [];
  const seenArtists = new Set();

  for (const item of scored) {
    const primaryArtist = String(item.track.artist ?? '').split(',')[0]?.trim().toLowerCase();
    if (primaryArtist && seenArtists.has(primaryArtist)) continue;
    if (primaryArtist) seenArtists.add(primaryArtist);
    selected.push(item.track.id);
    if (selected.length >= maxSeeds) break;
  }

  if (selected.length < maxSeeds) {
    for (const item of scored) {
      if (!selected.includes(item.track.id)) {
        selected.push(item.track.id);
      }
      if (selected.length >= maxSeeds) break;
    }
  }

  return selected;
}

function formatMetricDiff(key, trackValue, coreValue) {
  if (key === 'tempo') {
    const diffDir = trackValue > coreValue ? 'jauh lebih cepat' : 'jauh lebih lambat';
    return `tempo ${Math.round(trackValue)} BPM (${diffDir} dari inti playlist ${Math.round(coreValue)} BPM)`;
  }

  const diffDir = trackValue > coreValue ? 'jauh lebih tinggi' : 'jauh lebih rendah';
  return `${FEATURE_LABELS_ID[key]} ${trackValue.toFixed(2)} (${diffDir} dari median ${coreValue.toFixed(2)})`;
}

function buildDataDrivenOutlierReason(features, profile) {
  const rankedDeviations = FEATURE_KEYS.map((key) => ({
    key,
    absZ: Math.abs((features[key] - profile.medianFeatures[key]) / profile.robustStd[key]),
    trackVal: features[key],
    coreVal: profile.centroid[key],
  }))
    .sort((a, b) => b.absZ - a.absZ)
    .slice(0, 2);

  if (rankedDeviations.length === 0) {
    return 'Karakter fitur audio lagu ini menyimpang dari profil mayoritas playlist.';
  }

  const parts = rankedDeviations.map((d) => formatMetricDiff(d.key, d.trackVal, d.coreVal));
  return `Memiliki ${parts.join(' dan ')}, sehingga terasa kontras dibanding mayoritas lagu lain di playlist ini.`;
}

export function detectStatisticalOutliers(tracks, featuresById, profile) {
  if (!profile?.hasAudioProfile) {
    return [];
  }

  const scored = [];
  for (let i = 0; i < tracks.length; i += 1) {
    const track = tracks[i];
    const features = track?.id ? featuresById.get(track.id) : null;
    if (!features) continue;

    const metrics = scoreTrackAgainstProfile(features, profile);
    if (!metrics) continue;

    if (metrics.similarityScore < 68 || metrics.rmsZScore >= 1.65) {
      scored.push({
        ...track,
        trackNumber: i + 1,
        audioFeatures: {
          ...features,
          tempo: Math.round(features.tempo),
        },
        similarityScore: metrics.similarityScore,
        mismatchScore: Math.max(15, 100 - metrics.similarityScore),
        rmsZScore: metrics.rmsZScore,
        reason: buildDataDrivenOutlierReason(features, profile),
      });
    }
  }

  const maxOutliers = Math.min(6, Math.max(1, Math.floor(tracks.length * 0.2)));
  return scored
    .sort((a, b) => b.rmsZScore - a.rmsZScore || a.similarityScore - b.similarityScore)
    .slice(0, maxOutliers);
}
