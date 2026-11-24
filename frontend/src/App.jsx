import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AudioProfileCard } from './components/AudioProfileCard.jsx';
import { BottomCoverStrip } from './components/BottomCoverStrip.jsx';
import { HistoryDrawer } from './components/HistoryDrawer.jsx';
import { ArrowRightGlyph } from './components/Icons.jsx';
import { LoadingStage } from './components/LoadingStage.jsx';
import { SoundwaveBackground } from './components/SoundwaveBackground.jsx';
import { TrackDetailColumn } from './components/TrackDetailColumn.jsx';
import { TracklistPanel } from './components/TracklistPanel.jsx';
import { UrlInputView } from './components/UrlInputView.jsx';
import { VinylShowcase } from './components/VinylShowcase.jsx';
import { analyzePlaylist } from './services/api.js';
import { isValidSpotifyPlaylistUrl } from './utils/format.js';
import {
  clearHistoryStorage,
  loadHistory,
  saveHistoryEntry,
} from './utils/history.js';

function attachStageKeys(result) {
  const rawRecs = result.recommendations;
  let rawIndo = [];
  let rawIntl = [];

  if (rawRecs && !Array.isArray(rawRecs)) {
    rawIndo = Array.isArray(rawRecs.indonesia) ? rawRecs.indonesia : [];
    rawIntl = Array.isArray(rawRecs.internasional) ? rawRecs.internasional : [];
  } else if (Array.isArray(rawRecs)) {
    for (const track of rawRecs) {
      if (track?.language === 'id') rawIndo.push(track);
      else rawIntl.push(track);
    }
  }

  const recommendationsIndonesia = rawIndo.map((track, idx) => ({
    ...track,
    language: track.language || 'id',
    _stageKind: 'recommendation',
    _stageIndex: idx + 1,
    _stageKey: `rec-id-${track.id || idx}-${idx}`,
  }));

  const recommendationsInternasional = rawIntl.map((track, idx) => ({
    ...track,
    language: track.language || 'en',
    _stageKind: 'recommendation',
    _stageIndex: idx + 1,
    _stageKey: `rec-en-${track.id || idx}-${idx}`,
  }));

  const recommendations = [...recommendationsIndonesia, ...recommendationsInternasional].map(
    (track, idx) => ({
      ...track,
      _stageIndex: idx + 1,
    })
  );

  const sourceTracks = (result.sourceTracks ?? []).map((track, idx) => ({
    ...track,
    _stageKind: 'source',
    _stageIndex: track.trackNumber || idx + 1,
    _stageKey: `src-${track.id || idx}-${idx}`,
  }));

  const outliers = (result.outliers ?? []).map((track, idx) => ({
    ...track,
    _stageKind: 'outlier',
    _stageIndex: track.trackNumber || idx + 1,
    _stageKey: `out-${track.id || idx}-${idx}`,
  }));

  return {
    ...result,
    recommendations,
    recommendationsIndonesia,
    recommendationsInternasional,
    sourceTracks,
    outliers,
  };
}

export default function App() {
  const [viewState, setViewState] = useState('input');
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [limit, setLimit] = useState(10);
  const [errorMessage, setErrorMessage] = useState('');
  const [data, setData] = useState(null);
  const [history, setHistory] = useState(() => loadHistory());
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const [activeTab, setActiveTab] = useState('recommendations');
  const [recLangFilter, setRecLangFilter] = useState('indonesia');
  const [selectedTrackKey, setSelectedTrackKey] = useState(null);
  const [playingTrackKey, setPlayingTrackKey] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(30);
  const [volume, setVolume] = useState(0.85);
  const [isFullTrackMode, setIsFullTrackMode] = useState(false);
  const [audioError, setAudioError] = useState('');

  const abortRef = useRef(null);
  const audioRef = useRef(null);
  const handleAutoNextRef = useRef(null);

  const outlierById = useMemo(() => {
    const map = new Map();
    for (const item of data?.outliers ?? []) {
      if (item.id) {
        map.set(item.id, item);
      }
    }
    return map;
  }, [data]);

  const outlierIds = useMemo(() => new Set(outlierById.keys()), [outlierById]);

  const activeRecommendationList = useMemo(() => {
    if (!data) return [];
    if (recLangFilter === 'indonesia') return data.recommendationsIndonesia ?? [];
    if (recLangFilter === 'internasional') return data.recommendationsInternasional ?? [];
    return data.recommendations ?? [];
  }, [data, recLangFilter]);

  const activeList = useMemo(() => {
    if (!data) return [];
    if (activeTab === 'outliers') return data.outliers;
    if (activeTab === 'source') return data.sourceTracks;
    return activeRecommendationList;
  }, [data, activeTab, activeRecommendationList]);

  const allStageTracks = useMemo(() => {
    if (!data) return [];
    return [...data.recommendations, ...data.outliers, ...data.sourceTracks];
  }, [data]);

  const activeTrack = useMemo(() => {
    if (!allStageTracks.length) return null;
    return (
      allStageTracks.find((item) => item._stageKey === selectedTrackKey) ||
      activeList[0] ||
      data?.recommendations?.[0] ||
      null
    );
  }, [allStageTracks, selectedTrackKey, activeList, data]);

  const activeQueueIndex = useMemo(() => {
    if (!activeTrack || activeList.length === 0) return -1;
    return activeList.findIndex((item) => item._stageKey === activeTrack._stageKey);
  }, [activeTrack, activeList]);

  const activeTrackContext = useMemo(() => {
    if (!activeTrack) return null;
    const matchedOutlier =
      activeTrack._stageKind === 'outlier'
        ? activeTrack
        : activeTrack.id
          ? outlierById.get(activeTrack.id)
          : null;

    return {
      kind: activeTrack._stageKind,
      index: activeTrack._stageIndex,
      outlierInfo: matchedOutlier || null,
    };
  }, [activeTrack, outlierById]);

  function getAudioElement() {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.volume = volume;
      audio.addEventListener('timeupdate', () => {
        setAudioCurrentTime(audio.currentTime || 0);
      });
      audio.addEventListener('loadedmetadata', () => {
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          setAudioDuration(audio.duration);
        }
      });
      audio.addEventListener('ended', () => {
        if (handleAutoNextRef.current) {
          handleAutoNextRef.current();
        } else {
          setIsPlaying(false);
          setPlayingTrackKey(null);
          setAudioCurrentTime(0);
        }
      });
      audio.addEventListener('error', () => {
        if (!audio.getAttribute('src')) return;
        setIsPlaying(false);
        setPlayingTrackKey(null);
        setAudioError('Preview audio gagal diputar oleh browser.');
      });
      audioRef.current = audio;
    }
    return audioRef.current;
  }

  function stopAudio() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
    }
    setIsPlaying(false);
    setPlayingTrackKey(null);
    setAudioCurrentTime(0);
    setAudioDuration(30);
    setAudioError('');
  }

  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute('src');
        audioRef.current.load();
      }
    };
  }, []);

  const playTrackImmediately = useCallback(
    async (track) => {
      if (!track?.previewUrl) {
        stopAudio();
        return;
      }

      setAudioError('');
      setIsFullTrackMode(false);
      const audio = getAudioElement();
      if (playingTrackKey !== track._stageKey || audio.src !== track.previewUrl) {
        audio.src = track.previewUrl;
        setAudioCurrentTime(0);
        setAudioDuration(30);
      }

      try {
        await audio.play();
        setPlayingTrackKey(track._stageKey);
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
        setAudioError('Browser memblokir pemutaran otomatis. Klik tombol Play sekali lagi.');
      }
    },
    [playingTrackKey, volume]
  );

  const advanceQueue = useCallback(
    (direction, { forcePlay = false } = {}) => {
      if (activeList.length === 0) return;

      const startIndex = activeQueueIndex >= 0 ? activeQueueIndex : 0;
      const step = direction === 'prev' ? -1 : 1;
      const nextIndex = (startIndex + step + activeList.length) % activeList.length;
      const targetTrack = activeList[nextIndex];
      if (!targetTrack) return;

      setAudioError('');
      setSelectedTrackKey(targetTrack._stageKey);

      if (forcePlay || isPlaying) {
        if (targetTrack.previewUrl) {
          void playTrackImmediately(targetTrack);
        } else {
          // Skip forward automatically when auto-advancing into a track without preview.
          const playableFallback = activeList.find(
            (item, idx) => idx !== startIndex && Boolean(item.previewUrl)
          );
          if (forcePlay && playableFallback) {
            setSelectedTrackKey(playableFallback._stageKey);
            void playTrackImmediately(playableFallback);
          } else {
            stopAudio();
          }
        }
      } else {
        setAudioCurrentTime(0);
      }
    },
    [activeList, activeQueueIndex, isPlaying, playTrackImmediately]
  );

  useEffect(() => {
    handleAutoNextRef.current = () => advanceQueue('next', { forcePlay: true });
  }, [advanceQueue]);

  async function syncPlaybackForSelectedTrack(targetTrack) {
    if (!isPlaying) {
      setAudioCurrentTime(0);
      return;
    }

    if (!targetTrack?.previewUrl) {
      stopAudio();
      return;
    }

    if (playingTrackKey === targetTrack._stageKey) {
      return;
    }

    await playTrackImmediately(targetTrack);
  }

  function openStagedResult(rawResult) {
    const staged = attachStageKeys(rawResult);
    const indoCount = staged.recommendationsIndonesia.length;
    const intlCount = staged.recommendationsInternasional.length;
    const dist = staged.audioProfile?.languageDistribution;
    let initialLangFilter = 'all';
    if (indoCount > 0 && intlCount > 0) {
      initialLangFilter = (dist?.indonesia ?? indoCount) >= (dist?.internasional ?? intlCount)
        ? 'indonesia'
        : 'internasional';
    } else if (indoCount > 0) {
      initialLangFilter = 'indonesia';
    } else if (intlCount > 0) {
      initialLangFilter = 'internasional';
    }

    const initialList =
      initialLangFilter === 'indonesia'
        ? staged.recommendationsIndonesia
        : initialLangFilter === 'internasional'
          ? staged.recommendationsInternasional
          : staged.recommendations;

    setData(staged);
    setActiveTab('recommendations');
    setRecLangFilter(initialLangFilter);
    setSelectedTrackKey(initialList[0]?._stageKey ?? staged.recommendations[0]?._stageKey ?? null);
    setIsFullTrackMode(false);
    setViewState('results');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage('');

    const trimmedUrl = playlistUrl.trim();
    if (!trimmedUrl) {
      setErrorMessage('Masukkan tautan playlist publik Spotify terlebih dahulu.');
      return;
    }

    if (!isValidSpotifyPlaylistUrl(trimmedUrl)) {
      setErrorMessage(
        'Format tautan belum sesuai. Gunakan URL playlist Spotify seperti https://open.spotify.com/playlist/...'
      );
      return;
    }

    stopAudio();
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setViewState('loading');

    try {
      const rawResult = await analyzePlaylist({
        playlistUrl: trimmedUrl,
        limit,
        signal: controller.signal,
      });

      setHistory(saveHistoryEntry({ playlistUrl: trimmedUrl, result: rawResult }));
      openStagedResult(rawResult);
    } catch (error) {
      if (error.name === 'AbortError') {
        setViewState('input');
        return;
      }
      setErrorMessage(error.message || 'Gagal menganalisis playlist. Coba beberapa saat lagi.');
      setViewState('input');
    }
  }

  function handleSelectHistoryEntry(entry) {
    stopAudio();
    setErrorMessage('');
    if (entry.playlistUrl) {
      setPlaylistUrl(entry.playlistUrl);
    }
    openStagedResult(entry.data);
  }

  function handleClearHistory() {
    setHistory(clearHistoryStorage());
  }

  function handleCancelLoading() {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    setViewState('input');
  }

  function handleResetToInput() {
    stopAudio();
    setIsFullTrackMode(false);
    setIsHistoryOpen(false);
    setViewState('input');
  }

  function handleSwitchTab(nextTab) {
    setActiveTab(nextTab);
    setAudioError('');
    if (!data) return;

    const list =
      nextTab === 'outliers'
        ? data.outliers
        : nextTab === 'source'
          ? data.sourceTracks
          : activeRecommendationList;

    if (list.length > 0) {
      setSelectedTrackKey(list[0]._stageKey);
      void syncPlaybackForSelectedTrack(list[0]);
    }
  }

  function handleSwitchLangFilter(nextLangFilter) {
    setRecLangFilter(nextLangFilter);
    setAudioError('');
    if (!data) return;

    const list =
      nextLangFilter === 'indonesia'
        ? data.recommendationsIndonesia
        : nextLangFilter === 'internasional'
          ? data.recommendationsInternasional
          : data.recommendations;

    if (list.length > 0) {
      setSelectedTrackKey(list[0]._stageKey);
      void syncPlaybackForSelectedTrack(list[0]);
    }
  }

  function handleSelectTrack(track) {
    setAudioError('');
    setSelectedTrackKey(track._stageKey);
    void syncPlaybackForSelectedTrack(track);
  }

  function handleSelectFromStrip(track) {
    setAudioError('');
    if (track._stageKind === 'recommendation') {
      setActiveTab('recommendations');
      if (recLangFilter !== 'all') {
        const trackLangGroup = track.language === 'id' ? 'indonesia' : 'internasional';
        if (recLangFilter !== trackLangGroup) {
          setRecLangFilter(trackLangGroup);
        }
      }
      setSelectedTrackKey(track._stageKey);
      void syncPlaybackForSelectedTrack(track);
      return;
    }

    if (track.id && outlierById.has(track.id)) {
      const outlierMatch = data.outliers.find((item) => item.id === track.id);
      if (outlierMatch) {
        setActiveTab('outliers');
        setSelectedTrackKey(outlierMatch._stageKey);
        void syncPlaybackForSelectedTrack(outlierMatch);
        return;
      }
    }

    setActiveTab('source');
    setSelectedTrackKey(track._stageKey);
    void syncPlaybackForSelectedTrack(track);
  }

  async function handleTogglePreview(track) {
    if (!track?.previewUrl) {
      return;
    }
    setAudioError('');

    const audio = getAudioElement();
    if (playingTrackKey === track._stageKey && isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    await playTrackImmediately(track);
  }

  function handleSeekAudio(nextTime) {
    if (!activeTrack?.previewUrl) return;
    const audio = getAudioElement();
    if (playingTrackKey !== activeTrack._stageKey || audio.src !== activeTrack.previewUrl) {
      audio.src = activeTrack.previewUrl;
      setPlayingTrackKey(activeTrack._stageKey);
    }
    audio.currentTime = nextTime;
    setAudioCurrentTime(nextTime);
  }

  function handleVolumeChange(nextVolume) {
    setVolume(nextVolume);
    if (audioRef.current) {
      audioRef.current.volume = nextVolume;
    }
  }

  function handleToggleFullTrack() {
    setIsFullTrackMode((prev) => {
      const next = !prev;
      if (next && isPlaying && audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
      return next;
    });
  }

  const activeTrackIsPlaying = Boolean(
    viewState === 'results' &&
      activeTrack &&
      isPlaying &&
      playingTrackKey === activeTrack._stageKey
  );
  const activeTrackTime =
    viewState === 'results' && activeTrack && playingTrackKey === activeTrack._stageKey
      ? audioCurrentTime
      : 0;

  let stageView = null;

  if (viewState === 'loading') {
    stageView = <LoadingStage onCancel={handleCancelLoading} />;
  } else if (viewState === 'input' || !data) {
    stageView = (
      <UrlInputView
        playlistUrl={playlistUrl}
        onPlaylistUrlChange={(val) => {
          setPlaylistUrl(val);
          if (errorMessage) setErrorMessage('');
        }}
        limit={limit}
        onLimitChange={setLimit}
        onSubmit={handleSubmit}
        errorMessage={errorMessage}
        history={history}
        onSelectHistory={handleSelectHistoryEntry}
        onClearHistory={handleClearHistory}
      />
    );
  } else {
    stageView = (
      <div className="relative z-10 min-h-dvh text-[#181818] flex flex-col justify-between">
      <header className="w-full max-w-[1400px] mx-auto px-5 sm:px-8 lg:px-12 py-4 sm:py-6 border-b border-[#181818]/10 grid grid-cols-2 md:grid-cols-12 items-center gap-x-4 gap-y-2">
        <div className="col-span-1 md:col-span-2 flex items-center">
          <button
            type="button"
            onClick={handleResetToInput}
            className="min-h-[44px] inline-flex items-center font-sans font-bold text-lg tracking-[-0.02em] text-[#181818] hover:text-[#9E472A] transition-colors"
          >
            SoundSense
          </button>
        </div>

        <div className="col-span-1 md:col-span-3 md:order-4 flex items-center justify-end gap-3 sm:gap-4">
          <button
            type="button"
            onClick={() => setIsHistoryOpen(true)}
            aria-expanded={isHistoryOpen}
            aria-controls="history-drawer"
            className="min-h-[44px] px-2 text-xs sm:text-sm font-medium text-[#6E6A66] hover:text-[#181818] transition-colors"
          >
            Riwayat (<span className="font-mono tabular-nums">{history.length}</span>)
          </button>

          <button
            type="button"
            onClick={handleResetToInput}
            className="min-h-[44px] px-2 -mr-2 inline-flex items-center gap-2 text-sm font-medium text-[#181818] hover:text-[#9E472A] transition-colors"
          >
            <span>New Playlist</span>
            <ArrowRightGlyph className="w-4 h-4" />
          </button>
        </div>

        <nav
          aria-label="Tampilan hasil analisis"
          className="col-span-2 md:col-span-3 md:order-2 flex items-center gap-2 sm:gap-4"
        >
          <button
            type="button"
            onClick={() => handleSwitchTab('recommendations')}
            aria-current={activeTab === 'recommendations' ? 'page' : undefined}
            className={`min-h-[44px] px-2 text-xs sm:text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'recommendations'
                ? 'border-[#9E472A] text-[#181818]'
                : 'border-transparent text-[#6E6A66] hover:text-[#181818]'
            }`}
          >
            Rekomendasi (<span className="font-mono tabular-nums">{data.recommendations.length}</span>)
          </button>

          <button
            type="button"
            onClick={() => handleSwitchTab('outliers')}
            aria-current={activeTab === 'outliers' ? 'page' : undefined}
            className={`min-h-[44px] px-2 text-xs sm:text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'outliers'
                ? 'border-[#9E472A] text-[#181818]'
                : 'border-transparent text-[#6E6A66] hover:text-[#181818]'
            }`}
          >
            Keluar Jalur (<span className="font-mono tabular-nums">{data.outliers.length}</span>)
          </button>
        </nav>

        <div className="col-span-2 md:col-span-4 md:order-3 md:text-center min-w-0">
          <p className="text-xs font-medium text-[#181818] truncate">
            <span className="font-mono tabular-nums">{data.playlistInfo.totalTracks}</span> lagu · {data.vibeAnalysis.mood}
          </p>
          <p className="text-xs text-[#6E6A66] truncate">
            {data.playlistInfo.name}
          </p>
        </div>
      </header>

      <AudioProfileCard
        playlistInfo={data.playlistInfo}
        vibeAnalysis={data.vibeAnalysis}
        audioProfile={data.audioProfile}
      />

      <main className="flex-1 w-full max-w-[1400px] mx-auto px-5 sm:px-8 lg:px-12 py-6 sm:py-8 lg:py-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
        <div className="md:col-span-1 lg:col-span-4">
          <VinylShowcase track={activeTrack} isPlaying={activeTrackIsPlaying} />
        </div>

        <div className="md:col-span-1 lg:col-span-4 min-w-0">
          <TrackDetailColumn
            track={activeTrack}
            trackContext={activeTrackContext}
            playlistInfo={data.playlistInfo}
            vibeAnalysis={data.vibeAnalysis}
            audioProfile={data.audioProfile}
            isPlaying={activeTrackIsPlaying}
            audioCurrentTime={activeTrackTime}
            audioDuration={audioDuration}
            audioError={audioError}
            isFullTrackMode={isFullTrackMode}
            onTogglePreview={handleTogglePreview}
            onToggleFullTrack={handleToggleFullTrack}
            onSeekAudio={handleSeekAudio}
          />
        </div>

        <div className="md:col-span-2 lg:col-span-4 min-w-0">
          <TracklistPanel
            mode={activeTab}
            tracks={activeList}
            selectedKey={activeTrack?._stageKey}
            playingTrackKey={playingTrackKey}
            isPlaying={isPlaying}
            outlierIds={outlierIds}
            vibeMood={data.vibeAnalysis.mood}
            langFilter={recLangFilter}
            langCounts={{
              indonesia: data.recommendationsIndonesia?.length ?? 0,
              internasional: data.recommendationsInternasional?.length ?? 0,
              all: data.recommendations?.length ?? 0,
            }}
            onLangFilterChange={handleSwitchLangFilter}
            onSelectTrack={handleSelectTrack}
            onSwitchToRecommendations={() => handleSwitchTab('recommendations')}
          />
        </div>
      </main>

      <BottomCoverStrip
        recommendations={data.recommendations}
        sourceTracks={data.sourceTracks}
        outlierIds={outlierIds}
        selectedKey={activeTrack?._stageKey}
        activeTrack={activeTrack}
        isPlaying={activeTrackIsPlaying}
        currentTime={activeTrackTime}
        duration={audioDuration}
        volume={volume}
        isFullTrackMode={isFullTrackMode}
        canGoPrev={activeList.length > 1}
        canGoNext={activeList.length > 1}
        onSelectFromStrip={handleSelectFromStrip}
        onTogglePlayCurrent={() => activeTrack && handleTogglePreview(activeTrack)}
        onPrevTrack={() => advanceQueue('prev')}
        onNextTrack={() => advanceQueue('next')}
        onSeek={handleSeekAudio}
        onVolumeChange={handleVolumeChange}
        onToggleFullTrack={handleToggleFullTrack}
      />

      <HistoryDrawer
        isOpen={isHistoryOpen}
        history={history}
        activePlaylistId={data.playlistInfo.id}
        onClose={() => setIsHistoryOpen(false)}
        onSelectEntry={handleSelectHistoryEntry}
        onClearHistory={handleClearHistory}
      />
    </div>
    );
  }

  return (
    <>
      <SoundwaveBackground
        isAnalyzing={viewState === 'loading'}
        isPlaying={isPlaying}
        tempo={activeTrack?.audioFeatures?.tempo ?? data?.audioProfile?.centroid?.tempo ?? 100}
        energy={activeTrack?.audioFeatures?.energy ?? data?.audioProfile?.centroid?.energy ?? 0.5}
        currentTime={audioCurrentTime}
      />
      <div className="relative z-10 min-h-dvh">{stageView}</div>
    </>
  );
}
