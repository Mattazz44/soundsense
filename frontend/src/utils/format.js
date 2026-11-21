export function formatDuration(durationMs) {
  if (typeof durationMs !== 'number' || Number.isNaN(durationMs) || durationMs <= 0) {
    return '--:--';
  }
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function formatSeconds(secondsInput) {
  if (typeof secondsInput !== 'number' || Number.isNaN(secondsInput) || secondsInput < 0) {
    return '0:00';
  }
  const totalSeconds = Math.floor(secondsInput);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function isValidSpotifyPlaylistUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return false;
  }

  try {
    const parsed = new URL(rawUrl.trim());
    return (
      parsed.hostname === 'open.spotify.com' &&
      /^\/(?:intl-[a-z-]+\/)?playlist\/[a-zA-Z0-9]+\/?$/.test(parsed.pathname)
    );
  } catch {
    return false;
  }
}

export function splitEditorialLines(text) {
  const clean = String(text ?? '').trim();
  if (!clean) {
    return [];
  }

  // Break at sentence endings or natural comma clauses to mirror editorial liner-note stanzas.
  const sentences = clean
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (sentences.length >= 2) {
    return sentences;
  }

  const clauses = clean
    .split(/(?<=,)\s+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (clauses.length >= 2) {
    const midpoint = Math.ceil(clauses.length / 2);
    return [clauses.slice(0, midpoint).join(' '), clauses.slice(midpoint).join(' ')].filter(Boolean);
  }

  return [clean];
}

export function parseSyncedLyrics(lrcText) {
  if (typeof lrcText !== 'string' || !lrcText.trim()) {
    return [];
  }

  const lines = lrcText.split(/\r?\n/);
  const parsed = [];
  const timeTagRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;

  for (const rawLine of lines) {
    const matches = [...rawLine.matchAll(timeTagRegex)];
    if (matches.length === 0) continue;

    const text = rawLine.replace(timeTagRegex, '').trim();
    if (!text) continue;

    for (const match of matches) {
      const minutes = Number.parseInt(match[1], 10);
      const seconds = Number.parseInt(match[2], 10);
      const fractionRaw = match[3] || '0';
      const fractionMs =
        fractionRaw.length === 3
          ? Number.parseInt(fractionRaw, 10)
          : Number.parseInt(fractionRaw.padEnd(2, '0'), 10) * 10;

      const timeSec = minutes * 60 + seconds + fractionMs / 1000;
      parsed.push({ timeSec, text });
    }
  }

  return parsed.sort((a, b) => a.timeSec - b.timeSec);
}
