const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(
  /\/+$/,
  ''
);

export async function analyzePlaylist({ playlistUrl, limit, signal }) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/recommend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ playlistUrl, limit }),
      signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw error;
    }
    throw new Error(
      'Tidak dapat terhubung ke server SoundSense. Pastikan backend berjalan di ' + API_BASE_URL + '.'
    );
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload?.error ||
      `Permintaan gagal dengan status ${response.status}. Periksa kembali tautan playlist atau coba lagi.`;
    const error = new Error(message);
    error.status = response.status;
    error.code = payload?.code;
    throw error;
  }

  return payload;
}

export async function fetchTrackLyrics({ title, artist, signal }) {
  const params = new URLSearchParams({
    title: String(title ?? ''),
    artist: String(artist ?? ''),
  });

  const response = await fetch(`${API_BASE_URL}/api/lyrics?${params.toString()}`, {
    signal,
  });

  if (!response.ok) {
    return { plainLyrics: null, syncedLyrics: null, instrumental: false };
  }

  const data = await response.json().catch(() => null);
  return {
    plainLyrics: data?.plainLyrics ?? null,
    syncedLyrics: data?.syncedLyrics ?? null,
    instrumental: Boolean(data?.instrumental),
  };
}
