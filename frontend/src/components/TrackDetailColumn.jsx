import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchTrackLyrics } from '../services/api.js';
import {
  formatDuration,
  formatSeconds,
  parseSyncedLyrics,
  splitEditorialLines,
} from '../utils/format.js';
import {
  AlertMarkIcon,
  CloseGlyph,
  EqualizerBars,
  PauseGlyph,
  PlayCircleIcon,
  PlayGlyph,
} from './Icons.jsx';

const lyricsMemoryCache = new Map();

export function TrackDetailColumn({
  track,
  trackContext,
  playlistInfo,
  vibeAnalysis,
  audioProfile,
  isPlaying,
  audioCurrentTime,
  audioDuration,
  audioError,
  isFullTrackMode,
  onTogglePreview,
  onToggleFullTrack,
  onSeekAudio,
}) {
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [detailTab, setDetailTab] = useState('notes');
  const [lyricsState, setLyricsState] = useState({
    status: 'idle',
    plainLyrics: null,
    syncedLyrics: null,
    instrumental: false,
  });

  const lyricsBoxRef = useRef(null);
  const activeLineRef = useRef(null);

  useEffect(() => {
    if (!isSummaryOpen) return;
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        setIsSummaryOpen(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isSummaryOpen]);

  useEffect(() => {
    if (detailTab !== 'lyrics' || !track?.title) {
      return;
    }

    const cacheKey = `${track.title.toLowerCase()}::${String(track.artist ?? '').toLowerCase()}`;
    if (lyricsMemoryCache.has(cacheKey)) {
      setLyricsState({
        status: 'ready',
        ...lyricsMemoryCache.get(cacheKey),
      });
      return;
    }

    const controller = new AbortController();
    setLyricsState({
      status: 'loading',
      plainLyrics: null,
      syncedLyrics: null,
      instrumental: false,
    });

    fetchTrackLyrics({
      title: track.title,
      artist: track.artist,
      signal: controller.signal,
    })
      .then((res) => {
        lyricsMemoryCache.set(cacheKey, res);
        setLyricsState({
          status: 'ready',
          ...res,
        });
      })
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setLyricsState({
          status: 'ready',
          plainLyrics: null,
          syncedLyrics: null,
          instrumental: false,
        });
      });

    return () => controller.abort();
  }, [detailTab, track?.title, track?.artist]);

  const parsedSyncedLines = useMemo(
    () => parseSyncedLyrics(lyricsState.syncedLyrics),
    [lyricsState.syncedLyrics]
  );

  const activeLyricIndex = useMemo(() => {
    if (parsedSyncedLines.length === 0) return -1;
    if (!isPlaying && audioCurrentTime <= 0) return -1;

    let currentIdx = -1;
    for (let i = 0; i < parsedSyncedLines.length; i += 1) {
      if (parsedSyncedLines[i].timeSec <= audioCurrentTime + 0.15) {
        currentIdx = i;
      } else {
        break;
      }
    }
    return currentIdx;
  }, [parsedSyncedLines, audioCurrentTime, isPlaying]);

  useEffect(() => {
    if (detailTab !== 'lyrics' || activeLyricIndex < 0) return;
    const container = lyricsBoxRef.current;
    const lineEl = activeLineRef.current;
    if (!container || !lineEl) return;

    const targetTop =
      lineEl.offsetTop - container.clientHeight / 2 + lineEl.clientHeight / 2;
    container.scrollTo({
      top: Math.max(0, targetTop),
      behavior: 'smooth',
    });
  }, [detailTab, activeLyricIndex]);

  if (!track) {
    return (
      <div className="space-y-4">
        <h2 className="font-sans font-bold text-2xl text-[#181818]">
          Pilih lagu untuk melihat detail
        </h2>
        <p className="text-sm text-[#6E6A66]">
          Klik salah satu lagu di daftar sebelah kanan atau sampul album di bagian bawah.
        </p>
      </div>
    );
  }

  const isOutlier = Boolean(trackContext?.outlierInfo);
  const outlierInfo = trackContext?.outlierInfo;
  const displayReason = isOutlier
    ? outlierInfo.reason
    : track.reason ||
      `Lagu ini selaras dengan karakter ${vibeAnalysis.mood} pada playlist "${playlistInfo.name}".`;

  const reasonLines = splitEditorialLines(displayReason);
  const centroid = audioProfile?.centroid;
  const trackAudio = track.audioFeatures || outlierInfo?.audioFeatures;
  const matchPct = track.matchScore ?? track.similarityScore ?? null;

  let captionLabel = `Lagu Playlist Asal · Track ${String(trackContext?.index ?? 1).padStart(2, '0')}`;
  if (trackContext?.kind === 'recommendation') {
    captionLabel = `Catatan Kurasi · Rekomendasi ${String(trackContext.index).padStart(2, '0')}`;
  } else if (isOutlier) {
    captionLabel = `Analisis Ketidaksesuaian · Track ${String(outlierInfo.trackNumber).padStart(2, '0')}`;
  }

  return (
    <div key={track._stageKey} className="stage-enter space-y-5 min-w-0">
      <div className="space-y-2.5">
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="font-sans font-bold text-[clamp(1.75rem,2.75vw,2.45rem)] leading-[1.08] tracking-[-0.025em] text-[#181818] break-words min-w-0">
            {track.title}
          </h2>
          {isPlaying && <EqualizerBars className="w-4 h-5 shrink-0" />}
        </div>

        <p className="text-sm text-[#6E6A66] leading-relaxed flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium text-[#181818]">{track.artist}</span>
          {track.releaseYear && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-xs tabular-nums">{track.releaseYear}</span>
            </>
          )}
          {track.durationMs && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-xs tabular-nums">{formatDuration(track.durationMs)}</span>
            </>
          )}
          {trackAudio?.tempo && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-xs tabular-nums">{Math.round(trackAudio.tempo)} BPM</span>
            </>
          )}
          {!isOutlier && matchPct !== null && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-xs font-medium text-[#9E472A]">
                <span className="font-mono tabular-nums">{matchPct}%</span> cocok
              </span>
            </>
          )}
        </p>

        {(track.subGenre || track.language) && (
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            {track.subGenre && (
              <span className="px-2.5 py-0.5 bg-[#EFE9E5] border border-[#181818]/12 text-[11px] font-medium text-[#181818]">
                {track.subGenre}
              </span>
            )}
            {track.language && (
              <span className="text-[11px] font-medium text-[#5E5A56]">
                {track.language === 'id' ? 'Indonesia' : 'Inggris / Internasional'}
              </span>
            )}
          </div>
        )}
      </div>

      {isOutlier && (
        <div className="p-4 bg-white/80 backdrop-blur-sm border border-[#9E472A] space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#9E472A]">
              <AlertMarkIcon className="w-4 h-4 shrink-0" />
              <span>Terdeteksi Keluar Jalur</span>
            </div>
            <span className="font-mono text-xs tabular-nums text-[#181818] font-medium">
              Ketidaksesuaian {outlierInfo.mismatchScore}%
            </span>
          </div>

          {outlierInfo.subGenre && (
            <p className="text-xs text-[#5E5A56]">
              Sub-genre lagu: <span className="font-medium text-[#181818]">{outlierInfo.subGenre}</span>
            </p>
          )}

          {trackAudio && centroid && (
            <div className="grid grid-cols-2 gap-3 pt-1 text-xs border-t border-[#181818]/10">
              <div>
                <p className="text-[#5E5A56]">Lagu ini</p>
                <p className="font-mono tabular-nums text-[#181818] font-medium">
                  {Math.round(trackAudio.tempo)} BPM · Energi {Math.round(trackAudio.energy * 100)}%
                </p>
              </div>
              <div>
                <p className="text-[#5E5A56]">Inti playlist</p>
                <p className="font-mono tabular-nums text-[#181818] font-medium">
                  {Math.round(centroid.tempo)} BPM · Energi {Math.round(centroid.energy * 100)}%
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        {track.spotifyUrl ? (
          <a
            href={track.spotifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[44px] pr-2 inline-flex items-center gap-2 text-sm font-semibold text-[#181818] hover:text-[#9E472A] transition-colors"
          >
            <PlayCircleIcon className="w-5 h-5 shrink-0" />
            <span>Listen on Spotify</span>
          </a>
        ) : (
          <span className="min-h-[44px] inline-flex items-center text-sm text-[#6E6A66]">
            Tautan Spotify tidak tersedia
          </span>
        )}

        <button
          type="button"
          onClick={() => onTogglePreview(track)}
          disabled={!track.previewUrl}
          aria-label={
            !track.previewUrl
              ? 'Preview audio tidak tersedia untuk lagu ini'
              : isPlaying
                ? 'Jeda preview audio 30 detik'
                : 'Putar preview audio 30 detik'
          }
          className={`min-h-[44px] px-3.5 border text-xs font-medium inline-flex items-center gap-2 transition-colors ${
            track.previewUrl
              ? isPlaying
                ? 'bg-[#181818] text-[#F6F3F0] border-[#181818]'
                : 'bg-transparent text-[#181818] border-[#8A837C] hover:border-[#181818] hover:bg-[#EFE9E5]'
              : 'bg-transparent text-[#6E6A66] border-[#181818]/15 opacity-75'
          }`}
        >
          {isPlaying ? <PauseGlyph className="w-3.5 h-3.5" /> : <PlayGlyph className="w-3.5 h-3.5" />}
          <span>
            {!track.previewUrl
              ? 'Preview tidak tersedia'
              : isPlaying
                ? 'Pause Preview'
                : 'Play Preview'}
          </span>
        </button>

        {track.id && (
          <button
            type="button"
            aria-pressed={isFullTrackMode}
            onClick={onToggleFullTrack}
            className={`min-h-[44px] px-3.5 border text-xs font-medium inline-flex items-center transition-colors ${
              isFullTrackMode
                ? 'bg-[#9E472A] text-[#F6F3F0] border-[#9E472A]'
                : 'bg-transparent text-[#181818] border-[#8A837C] hover:border-[#181818] hover:bg-[#EFE9E5]'
            }`}
          >
            Full Track (Spotify)
          </button>
        )}
      </div>

      {audioError && (
        <p role="status" className="text-xs font-medium text-[#9E472A]">
          {audioError}
        </p>
      )}

      <div className="border-b border-[#181818]/10 flex items-center gap-4" role="tablist" aria-label="Detail lagu">
        <button
          type="button"
          role="tab"
          aria-selected={detailTab === 'notes'}
          onClick={() => setDetailTab('notes')}
          className={`min-h-[44px] px-1 text-xs font-semibold border-b-2 transition-colors ${
            detailTab === 'notes'
              ? 'border-[#9E472A] text-[#181818]'
              : 'border-transparent text-[#6E6A66] hover:text-[#181818]'
          }`}
        >
          Catatan AI
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={detailTab === 'lyrics'}
          onClick={() => setDetailTab('lyrics')}
          className={`min-h-[44px] px-1 text-xs font-semibold border-b-2 transition-colors ${
            detailTab === 'lyrics'
              ? 'border-[#9E472A] text-[#181818]'
              : 'border-transparent text-[#6E6A66] hover:text-[#181818]'
          }`}
        >
          Lirik Lagu
        </button>
      </div>

      {detailTab === 'notes' ? (
        <div className="space-y-4">
          <div className="space-y-1.5 text-[15px] leading-[1.72] text-[#6E6A66] max-w-[46ch]">
            {reasonLines.map((line, idx) => (
              <p key={idx}>{line}</p>
            ))}
          </div>

          <p className="text-xs font-semibold uppercase tracking-[0.04em] text-[#181818]">
            {captionLabel}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {lyricsState.status === 'loading' ? (
            <p role="status" className="text-xs text-[#6E6A66] py-6">
              Mencari lirik lagu di LRCLIB...
            </p>
          ) : parsedSyncedLines.length > 0 ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-[#6E6A66]">
                  Lirik tersinkron ({isPlaying ? 'mengikuti audio preview' : 'putar preview untuk sinkronisasi'})
                </span>
              </div>
              <div
                ref={lyricsBoxRef}
                className="relative max-h-[220px] overflow-y-auto editorial-scroll pr-2 space-y-2"
              >
                {parsedSyncedLines.map((line, idx) => {
                  const isActiveLine = idx === activeLyricIndex;
                  const canSeekHere =
                    Boolean(track.previewUrl) && line.timeSec <= (audioDuration || 30);

                  return (
                    <button
                      key={`${line.timeSec}-${idx}`}
                      ref={isActiveLine ? activeLineRef : null}
                      type="button"
                      disabled={!canSeekHere}
                      onClick={() => canSeekHere && onSeekAudio(line.timeSec)}
                      className={`w-full text-left py-1.5 pl-3 border-l-2 transition-colors flex items-baseline gap-2.5 ${
                        isActiveLine
                          ? 'border-[#9E472A] text-[#181818] font-bold text-[15px]'
                          : 'border-transparent text-[#6E6A66] text-sm hover:text-[#181818]'
                      } ${!canSeekHere ? 'cursor-default' : ''}`}
                    >
                      <span className="font-mono text-[11px] text-[#6E6A66] shrink-0 tabular-nums">
                        {formatSeconds(line.timeSec)}
                      </span>
                      <span className="leading-[1.55]">{line.text}</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : lyricsState.plainLyrics ? (
            <div className="max-h-[220px] overflow-y-auto editorial-scroll pr-2 space-y-2 text-[14px] leading-[1.75] text-[#6E6A66] whitespace-pre-line">
              {lyricsState.plainLyrics}
            </div>
          ) : (
            <p className="text-sm text-[#6E6A66] py-4 leading-relaxed">
              {lyricsState.instrumental
                ? 'Lagu ini terdeteksi sebagai komposisi instrumental tanpa lirik.'
                : 'Lirik untuk lagu ini belum tersedia di database LRCLIB.'}
            </p>
          )}
        </div>
      )}

      <div className="pt-3 border-t border-[#181818]/10 relative">
        <button
          type="button"
          aria-expanded={isSummaryOpen}
          aria-controls="vibe-summary-card"
          onClick={() => setIsSummaryOpen((prev) => !prev)}
          className="min-h-[44px] inline-flex items-center gap-2 text-xs font-medium text-[#181818] hover:text-[#9E472A] transition-colors"
        >
          <span className="underline underline-offset-4">
            Detail karakter playlist: {playlistInfo.name}
          </span>
        </button>

        {isSummaryOpen && (
          <div
            id="vibe-summary-card"
            role="region"
            aria-label="Ringkasan karakter musik playlist"
            className="mt-2 p-4 sm:p-5 bg-[#EFE9E5] border border-[#8A837C] space-y-3 shadow-[0_12px_28px_rgba(24,24,24,0.10)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#9E472A]">
                  {vibeAnalysis.mood}
                </p>
                <p className="font-sans font-semibold text-sm text-[#181818] mt-0.5">
                  {playlistInfo.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSummaryOpen(false)}
                aria-label="Tutup ringkasan vibe playlist"
                className="min-w-[44px] min-h-[44px] -mt-2 -mr-2 flex items-center justify-center text-[#5E5A56] hover:text-[#181818]"
              >
                <CloseGlyph className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm leading-[1.68] text-[#181818]">
              {vibeAnalysis.summary ||
                `Playlist "${playlistInfo.name}" berkarakter ${vibeAnalysis.mood}.`}
            </p>

            {vibeAnalysis.genres?.length > 0 && (
              <p className="text-xs text-[#5E5A56]">
                Genre dominan: {vibeAnalysis.genres.join(' · ')}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
