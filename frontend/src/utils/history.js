const HISTORY_STORAGE_KEY = 'soundsense_history';
const MAX_HISTORY_ITEMS = 10;

export function loadHistory() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => item?.id && item?.data) : [];
  } catch {
    return [];
  }
}

export function saveHistoryEntry({ playlistUrl, result }) {
  if (typeof window === 'undefined' || !window.localStorage || !result?.playlistInfo?.id) {
    return loadHistory();
  }

  const entry = {
    id: result.playlistInfo.id,
    playlistUrl: playlistUrl || result.playlistInfo.spotifyUrl || '',
    analyzedAt: new Date().toISOString(),
    data: result,
  };

  const current = loadHistory().filter((item) => item.id !== entry.id);
  const nextHistory = [entry, ...current].slice(0, MAX_HISTORY_ITEMS);

  try {
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(nextHistory));
  } catch {
    // Ignore storage quota errors so curation results still display normally.
  }

  return nextHistory;
}

export function clearHistoryStorage() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [];
  }

  try {
    window.localStorage.removeItem(HISTORY_STORAGE_KEY);
  } catch {
    // Ignore storage removal issues.
  }
  return [];
}

export function formatHistoryTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';

  const diffSeconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSeconds < 60) return 'Baru saja';
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)} mnt lalu`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)} jam lalu`;

  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
