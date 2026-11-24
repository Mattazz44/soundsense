import { useEffect, useRef } from 'react';
import { formatDuration } from '../utils/format.js';
import { EqualizerBars } from './Icons.jsx';

export function TracklistPanel({
  mode,
  tracks,
  selectedKey,
  playingTrackKey,
  isPlaying,
  outlierIds,
  vibeMood,
  langFilter = 'indonesia',
  langCounts = { indonesia: 0, internasional: 0, all: 0 },
  onLangFilterChange,
  onSelectTrack,
  onSwitchToRecommendations,
}) {
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [mode, langFilter, tracks]);

  let headingLabel = 'Rekomendasi Lagu';
  if (mode === 'outliers') {
    headingLabel = 'Lagu Kurang Cocok';
  } else if (mode === 'source') {
    headingLabel = 'Daftar Lagu Playlist Asal';
  }

  const languageTabs = [
    { id: 'indonesia', label: 'Indonesia', count: langCounts.indonesia ?? 0 },
    { id: 'internasional', label: 'Inggris / Intl', count: langCounts.internasional ?? 0 },
    { id: 'all', label: 'Semua', count: langCounts.all ?? tracks.length },
  ];

  return (
    <section
      aria-label={headingLabel}
      className="bg-white/80 backdrop-blur-sm border border-[#181818]/12 p-5 sm:p-7 lg:p-8 flex flex-col lg:min-h-[360px] min-w-0"
    >
      <div className="flex items-baseline justify-between gap-3 pb-4 border-b border-[#181818]/10">
        <h2 className="text-xs font-semibold uppercase tracking-[0.04em] text-[#5E5A56]">
          {headingLabel}
        </h2>
        <span className="text-xs text-[#5E5A56]">
          <span className="font-mono tabular-nums">{tracks.length}</span> lagu
        </span>
      </div>

      {mode === 'recommendations' && onLangFilterChange && langCounts.all > 0 && (
        <div
          role="tablist"
          aria-label="Filter bahasa rekomendasi"
          className="pt-3 pb-1 flex flex-wrap gap-1.5"
        >
          {languageTabs.map((tab) => {
            const selected = langFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => onLangFilterChange(tab.id)}
                className={`min-h-[44px] px-3 text-xs font-medium border transition-colors inline-flex items-center gap-1.5 ${
                  selected
                    ? 'bg-[#181818] text-[#F6F3F0] border-[#181818]'
                    : 'bg-[#F6F3F0] text-[#181818] border-[#181818]/15 hover:border-[#181818]'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`font-mono text-[11px] tabular-nums ${
                    selected ? 'text-[#F6F3F0]/80' : 'text-[#5E5A56]'
                  }`}
                >
                  ({tab.count})
                </span>
              </button>
            );
          })}
        </div>
      )}

      {mode === 'outliers' && tracks.length === 0 ? (
        <div className="py-10 space-y-4">
          <p className="text-sm leading-relaxed text-[#181818]">
            Semua lagu yang dianalisis selaras dengan mood utama ({vibeMood}). Tidak ada lagu yang
            terdeteksi keluar jalur dari karakter playlist Anda.
          </p>
          <button
            type="button"
            onClick={onSwitchToRecommendations}
            className="min-h-[44px] px-4 border border-[#8A837C] text-xs font-medium text-[#181818] hover:border-[#181818] hover:bg-[#E7E0DB] transition-colors"
          >
            Lihat Lagu Rekomendasi
          </button>
        </div>
      ) : mode === 'recommendations' && tracks.length === 0 ? (
        <div className="py-10 space-y-4">
          <p className="text-sm leading-relaxed text-[#181818]">
            Belum ada rekomendasi pada kelompok bahasa ini untuk sub-genre playlist tersebut.
          </p>
          {onLangFilterChange && (
            <button
              type="button"
              onClick={() => onLangFilterChange('all')}
              className="min-h-[44px] px-4 border border-[#8A837C] text-xs font-medium text-[#181818] hover:border-[#181818] hover:bg-[#E7E0DB] transition-colors"
            >
              Tampilkan Semua Rekomendasi
            </button>
          )}
        </div>
      ) : (
        <ol
          ref={listRef}
          className="mt-3 max-h-[380px] lg:max-h-[430px] overflow-y-auto editorial-scroll divide-y divide-[#181818]/6 pr-1"
        >
          {tracks.map((track, idx) => {
            const trackKey = track._stageKey;
            const isSelected = trackKey === selectedKey;
            const isRowPlaying = isPlaying && trackKey === playingTrackKey;
            const isOutlierTrack =
              mode === 'outliers' || (track.id && outlierIds.has(track.id));
            const displayIndex =
              mode === 'outliers' && track.trackNumber ? track.trackNumber : idx + 1;
            const matchScore = mode === 'recommendations' ? track.matchScore : null;
            const secondaryParts = [track.artist];
            if (track.subGenre) {
              secondaryParts.push(track.subGenre);
            }
            if (mode === 'recommendations' && langFilter === 'all' && track.language) {
              secondaryParts.push(track.language === 'id' ? 'ID' : 'Intl');
            }

            return (
              <li
                key={trackKey}
                style={{ '--stagger': Math.min(idx, 12) }}
                className="stagger-item"
              >
                <button
                  type="button"
                  onClick={() => onSelectTrack(track, idx)}
                  aria-current={isSelected ? 'true' : undefined}
                  className={`w-full min-h-[44px] py-2.5 px-3 flex items-baseline justify-between gap-3 text-left transition-colors ${
                    isSelected
                      ? 'bg-[#E4DCD6] border-l-2 border-[#9E472A]'
                      : 'hover:bg-[#E8E0DA] border-l-2 border-transparent'
                  }`}
                >
                  <div className="flex items-baseline gap-3 min-w-0">
                    <span className="font-mono text-xs text-[#5E5A56] w-6 shrink-0 tabular-nums">
                      {displayIndex}.
                    </span>
                    <div className="min-w-0">
                      <p
                        className={`text-sm leading-snug truncate ${
                          isSelected ? 'font-semibold text-[#181818]' : 'font-normal text-[#181818]'
                        }`}
                      >
                        {track.title}
                      </p>
                      <p className="text-xs text-[#5E5A56] truncate mt-0.5">
                        {secondaryParts.join(' · ')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    {isRowPlaying && <EqualizerBars className="w-3.5 h-3.5" />}
                    {isOutlierTrack ? (
                      <span className="text-[11px] font-medium text-[#9E472A]">
                        Keluar jalur
                      </span>
                    ) : matchScore !== null && matchScore !== undefined ? (
                      <span className="font-mono text-[11px] tabular-nums text-[#5E5A56]">
                        {matchScore}%
                      </span>
                    ) : null}
                    <span className="font-mono text-xs text-[#5E5A56] tabular-nums">
                      {formatDuration(track.durationMs)}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
