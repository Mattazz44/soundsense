import { formatSeconds } from '../utils/format.js';
import {
  CloseGlyph,
  NextGlyph,
  PauseGlyph,
  PlayGlyph,
  PrevGlyph,
  VolumeGlyph,
} from './Icons.jsx';

export function BottomCoverStrip({
  recommendations,
  sourceTracks,
  outlierIds,
  selectedKey,
  activeTrack,
  isPlaying,
  currentTime,
  duration,
  volume,
  isFullTrackMode,
  canGoPrev,
  canGoNext,
  onSelectFromStrip,
  onTogglePlayCurrent,
  onPrevTrack,
  onNextTrack,
  onSeek,
  onVolumeChange,
  onToggleFullTrack,
}) {
  const canPlayActive = Boolean(activeTrack?.previewUrl);
  const safeDuration = duration > 0 ? duration : 30;
  const clampedTime = Math.min(currentTime, safeDuration);

  function renderThumbnail(track, groupLabel, index) {
    const isSelected = track._stageKey === selectedKey;
    const isOutlier = track.id && outlierIds.has(track.id);
    const label = `${groupLabel}: ${track.title} oleh ${track.artist}`;

    return (
      <button
        key={track._stageKey}
        type="button"
        onClick={() => onSelectFromStrip(track, index)}
        aria-label={label}
        aria-pressed={isSelected}
        title={`${track.title} - ${track.artist}`}
        className={`relative shrink-0 w-12 h-12 sm:w-14 sm:h-14 p-0.5 border transition-all ${
          isSelected
            ? 'border-[#181818] bg-[#181818]'
            : 'border-transparent hover:border-[#8A837C]'
        }`}
      >
        {track.coverUrl ? (
          <img
            src={track.coverUrl}
            alt={`Sampul ${track.title}`}
            width={56}
            height={56}
            loading="lazy"
            className="w-full h-full object-cover block"
          />
        ) : (
          <span className="w-full h-full bg-[#EFE9E5] text-[#181818] font-mono text-[10px] flex items-center justify-center p-1 text-center leading-tight">
            {track.title.slice(0, 10)}
          </span>
        )}
        {isOutlier && (
          <span
            aria-label="Lagu kurang cocok"
            className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full bg-[#9E472A] border border-[#F6F3F0]"
          />
        )}
      </button>
    );
  }

  return (
    <footer className="w-full border-t border-[#181818]/10 bg-[#F6F3F0]">
      {isFullTrackMode && activeTrack?.id && (
        <div className="border-b border-[#181818]/10 bg-[#EFE9E5]">
          <div className="max-w-[1400px] mx-auto px-5 sm:px-8 lg:px-12 py-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-xs text-[#181818] truncate">
                Spotify Full Track Player · {activeTrack.title} ({activeTrack.artist})
              </p>
              <button
                type="button"
                onClick={onToggleFullTrack}
                aria-label="Tutup Spotify Full Track Player"
                className="min-h-[44px] px-3 inline-flex items-center gap-1.5 font-mono text-xs text-[#181818] hover:text-[#9E472A]"
              >
                <CloseGlyph className="w-3.5 h-3.5" />
                <span>Tutup</span>
              </button>
            </div>
            <iframe
              title={`Spotify player untuk ${activeTrack.title}`}
              src={`https://open.spotify.com/embed/track/${activeTrack.id}?utm_source=generator&theme=0`}
              width="100%"
              height="152"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              className="w-full border-0 rounded-[4px]"
            />
          </div>
        </div>
      )}

      <div className="max-w-[1400px] mx-auto px-5 sm:px-8 lg:px-12 py-3.5 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 lg:gap-6">
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onPrevTrack}
              disabled={!canGoPrev}
              aria-label="Lagu sebelumnya"
              className="w-11 h-11 flex items-center justify-center border border-[#8A837C] text-[#181818] hover:border-[#181818] hover:bg-[#EFE9E5] disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:border-[#8A837C] transition-colors"
            >
              <PrevGlyph className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onTogglePlayCurrent}
              disabled={!canPlayActive}
              aria-label={
                !canPlayActive
                  ? 'Preview audio tidak tersedia untuk lagu ini'
                  : isPlaying
                    ? 'Jeda preview audio'
                    : 'Putar preview audio'
              }
              className={`w-11 h-11 flex items-center justify-center border transition-colors ${
                canPlayActive
                  ? isPlaying
                    ? 'bg-[#181818] text-[#F6F3F0] border-[#181818]'
                    : 'bg-transparent text-[#181818] border-[#8A837C] hover:border-[#181818] hover:bg-[#EFE9E5]'
                  : 'bg-transparent text-[#6E6A66] border-[#181818]/15 opacity-70'
              }`}
            >
              {isPlaying ? <PauseGlyph className="w-4 h-4" /> : <PlayGlyph className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onNextTrack}
              disabled={!canGoNext}
              aria-label="Lagu berikutnya"
              className="w-11 h-11 flex items-center justify-center border border-[#8A837C] text-[#181818] hover:border-[#181818] hover:bg-[#EFE9E5] disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:border-[#8A837C] transition-colors"
            >
              <NextGlyph className="w-4 h-4" />
            </button>

            <div className="ml-2 min-w-0 max-w-[180px] sm:max-w-[210px]">
              <p className="text-xs font-semibold text-[#181818] truncate">
                {activeTrack?.title || 'Pilih lagu'}
              </p>
              <p className="font-mono text-[11px] text-[#6E6A66] truncate">
                {canPlayActive ? activeTrack?.artist : 'Tanpa preview 30s'}
              </p>
            </div>
          </div>

          <div className="flex-1 min-w-0 flex items-center gap-3">
            <span className="font-mono text-xs text-[#6E6A66] tabular-nums w-9 shrink-0">
              {formatSeconds(clampedTime)}
            </span>
            <input
              type="range"
              min={0}
              max={safeDuration}
              step={0.1}
              value={clampedTime}
              disabled={!canPlayActive}
              onChange={(event) => onSeek(Number(event.target.value))}
              aria-label="Posisi waktu lagu preview"
              className="w-full h-2 accent-[#9E472A] bg-[#EFE9E5] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            />
            <span className="font-mono text-xs text-[#6E6A66] tabular-nums w-9 text-right shrink-0">
              {formatSeconds(safeDuration)}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3 shrink-0">
            <div className="min-h-[44px] flex items-center gap-2">
              <VolumeGlyph className="w-4 h-4 text-[#181818] shrink-0" />
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={(event) => onVolumeChange(Number(event.target.value))}
                aria-label="Pengatur volume audio"
                className="w-20 sm:w-24 h-2 accent-[#181818] bg-[#EFE9E5] cursor-pointer"
              />
            </div>

            {activeTrack?.id && (
              <button
                type="button"
                aria-pressed={isFullTrackMode}
                onClick={onToggleFullTrack}
                className={`min-h-[44px] px-3.5 border font-mono text-xs transition-colors ${
                  isFullTrackMode
                    ? 'bg-[#9E472A] text-[#F6F3F0] border-[#9E472A]'
                    : 'bg-transparent text-[#181818] border-[#8A837C] hover:border-[#181818] hover:bg-[#EFE9E5]'
                }`}
              >
                Full Track (Spotify)
              </button>
            )}
          </div>
        </div>

        <nav
          aria-label="Navigasi cepat sampul album"
          className="pt-2 border-t border-[#181818]/8 flex items-center gap-3 overflow-x-auto editorial-scroll py-1"
        >
          <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-[#6E6A66] shrink-0">
            Rekomendasi
          </span>
          <div className="flex items-center gap-2 shrink-0">
            {recommendations.map((track, idx) =>
              renderThumbnail(track, 'Rekomendasi', idx)
            )}
          </div>

          {sourceTracks.length > 0 && (
            <>
              <div
                aria-hidden="true"
                className="h-9 w-px bg-[#181818]/15 mx-1.5 shrink-0"
              />
              <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-[#6E6A66] shrink-0">
                Playlist Asal
              </span>
              <div className="flex items-center gap-2 shrink-0">
                {sourceTracks.map((track, idx) =>
                  renderThumbnail(track, 'Playlist Asal', idx)
                )}
              </div>
            </>
          )}
        </nav>
      </div>
    </footer>
  );
}
