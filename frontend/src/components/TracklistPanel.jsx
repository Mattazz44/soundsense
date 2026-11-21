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
  onSelectTrack,
  onSwitchToRecommendations,
}) {
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [mode, tracks]);

  let headingLabel = 'Rekomendasi Lagu';
  if (mode === 'outliers') {
    headingLabel = 'Lagu Kurang Cocok';
  } else if (mode === 'source') {
    headingLabel = 'Daftar Lagu Playlist Asal';
  }

  return (
    <section
      aria-label={headingLabel}
      className="bg-[#EFE9E5] border border-[#181818]/8 p-5 sm:p-7 lg:p-8 flex flex-col lg:min-h-[360px] min-w-0"
    >
      <div className="flex items-baseline justify-between gap-3 pb-4 border-b border-[#181818]/10">
        <h2 className="font-mono text-xs uppercase tracking-[0.06em] text-[#5E5A56]">
          {headingLabel}
        </h2>
        <span className="font-mono text-xs text-[#5E5A56]">
          {tracks.length} tracks
        </span>
      </div>

      {mode === 'outliers' && tracks.length === 0 ? (
        <div className="py-10 space-y-4">
          <p className="text-sm leading-relaxed text-[#181818]">
            Semua lagu yang dianalisis selaras dengan mood utama ({vibeMood}). Tidak ada lagu yang
            terdeteksi keluar jalur dari karakter playlist Anda.
          </p>
          <button
            type="button"
            onClick={onSwitchToRecommendations}
            className="min-h-[44px] px-4 border border-[#8A837C] text-xs font-mono text-[#181818] hover:border-[#181818] hover:bg-[#E7E0DB] transition-colors"
          >
            Lihat Lagu Rekomendasi
          </button>
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

            return (
              <li key={trackKey}>
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
                        {track.artist}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    {isRowPlaying && <EqualizerBars className="w-3.5 h-3.5" />}
                    {isOutlierTrack && (
                      <span className="font-mono text-[11px] text-[#9E472A]">
                        Kurang cocok
                      </span>
                    )}
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
