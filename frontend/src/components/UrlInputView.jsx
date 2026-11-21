import { formatHistoryTime } from '../utils/history.js';
import { AlertMarkIcon, ArrowRightGlyph } from './Icons.jsx';

const EXAMPLE_PLAYLIST_URL = 'https://open.spotify.com/playlist/37i9dQZF1DX4WYpdgoIcn6';

export function UrlInputView({
  playlistUrl,
  onPlaylistUrlChange,
  limit,
  onLimitChange,
  onSubmit,
  errorMessage,
  history = [],
  onSelectHistory,
  onClearHistory,
}) {
  function handleFillExample() {
    onPlaylistUrlChange(EXAMPLE_PLAYLIST_URL);
  }

  return (
    <div className="min-h-dvh bg-[#F6F3F0] text-[#181818] flex flex-col">
      <header className="w-full max-w-[1320px] mx-auto px-5 sm:px-8 lg:px-12 py-6 flex flex-wrap items-center justify-between gap-4 border-b border-[#181818]/10">
        <span className="font-sans font-bold text-lg tracking-[-0.02em] text-[#181818]">
          SoundSense
        </span>
        <span className="font-mono text-xs text-[#6E6A66]">
          Kurasi &amp; audit playlist Spotify
        </span>
      </header>

      <main className="flex-1 w-full max-w-[1320px] mx-auto px-5 sm:px-8 lg:px-12 py-10 sm:py-14 lg:py-16 space-y-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          <section className="lg:col-span-7 space-y-8">
            <div className="space-y-4">
              <h1 className="font-sans font-bold text-[clamp(2rem,4.4vw,3.35rem)] leading-[1.06] tracking-[-0.03em] text-[#181818]">
                Kurasi playlist Spotify Anda, dan temukan lagu yang keluar jalur.
              </h1>
              <p className="text-[15px] sm:text-base leading-[1.7] text-[#6E6A66] max-w-[56ch]">
                Tempel tautan playlist publik Spotify di bawah. SoundSense membaca hingga 50 lagu
                pertama untuk merangkum suasana utama, menyarankan lagu baru beserta alasan musikalnya,
                dan menandai lagu di playlist asal yang kurang selaras.
              </p>
            </div>

            <form onSubmit={onSubmit} noValidate className="space-y-6 max-w-[580px]">
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label
                    htmlFor="playlist-url"
                    className="text-sm font-medium text-[#181818]"
                  >
                    Tautan Playlist Publik Spotify
                  </label>
                  <button
                    type="button"
                    onClick={handleFillExample}
                    className="min-h-[44px] px-2 -mr-2 inline-flex items-center font-mono text-xs text-[#9E472A] underline underline-offset-4 hover:text-[#181818] active:opacity-75 transition-colors"
                  >
                    Pakai contoh link playlist
                  </button>
                </div>

                <input
                  id="playlist-url"
                  name="playlistUrl"
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  value={playlistUrl}
                  onChange={(event) => onPlaylistUrlChange(event.target.value)}
                  placeholder="https://open.spotify.com/playlist/..."
                  aria-invalid={Boolean(errorMessage)}
                  aria-describedby={errorMessage ? 'playlist-url-error' : 'playlist-url-hint'}
                  className="w-full min-h-[48px] px-4 py-3 bg-[#FFFFFF] border border-[#8A837C] text-[#181818] placeholder:text-[#6E6A66] text-sm sm:text-[15px] font-mono rounded-[2px] focus:border-[#181818] transition-colors"
                />

                <p id="playlist-url-hint" className="text-xs text-[#6E6A66]">
                  Pastikan status playlist di Spotify bersifat publik agar dapat dibaca sistem.
                </p>

                {errorMessage && (
                  <div
                    id="playlist-url-error"
                    role="alert"
                    className="mt-2 p-3.5 bg-[#EFE9E5] border border-[#9E472A] text-[#181818] text-sm flex items-start gap-2.5"
                  >
                    <AlertMarkIcon className="w-4 h-4 text-[#9E472A] shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 pt-1">
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium text-[#181818]">
                    Jumlah rekomendasi
                  </legend>
                  <div className="inline-flex gap-2" role="radiogroup" aria-label="Jumlah rekomendasi">
                    {[10, 15].map((count) => {
                      const selected = limit === count;
                      return (
                        <button
                          key={count}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => onLimitChange(count)}
                          className={`min-h-[44px] min-w-[68px] px-4 font-mono text-sm border transition-colors ${
                            selected
                              ? 'bg-[#181818] text-[#F6F3F0] border-[#181818] font-medium'
                              : 'bg-transparent text-[#181818] border-[#8A837C] hover:border-[#181818] hover:bg-[#EFE9E5]'
                          }`}
                        >
                          {count} lagu
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <button
                  type="submit"
                  className="min-h-[48px] px-6 py-3 bg-[#181818] text-[#F6F3F0] text-sm font-semibold tracking-[-0.01em] inline-flex items-center justify-center gap-3 hover:bg-[#2C2A29] active:translate-y-[1px] transition-all"
                >
                  <span>Analyze Playlist</span>
                  <ArrowRightGlyph className="w-4 h-4" />
                </button>
              </div>
            </form>
          </section>

          <aside
            aria-label="Pratinjau tahapan analisis"
            className="lg:col-span-5 bg-[#EFE9E5] p-6 sm:p-8 lg:p-10 space-y-8 border border-[#181818]/10"
          >
            <div className="relative w-[176px] sm:w-[208px] aspect-square mx-auto lg:mx-0">
              <div
                aria-hidden="true"
                className="vinyl-disc absolute top-1/2 -translate-y-1/2 right-[-26%] w-[88%] aspect-square rounded-full"
              >
                <div className="vinyl-sheen w-full h-full rounded-full" />
              </div>
              <div className="relative z-10 w-full h-full bg-[#F6F3F0] border border-[#181818]/15 p-5 flex flex-col justify-between shadow-[0_14px_32px_rgba(24,24,24,0.10)]">
                <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#6E6A66]">
                  Side A · Liner Notes
                </span>
                <div className="space-y-1">
                  <p className="font-sans font-bold text-base tracking-[-0.02em] text-[#181818]">
                    Menunggu Tautan
                  </p>
                  <p className="font-mono text-xs text-[#6E6A66]">
                    50 tracks max · Spotify API
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-2 border-t border-[#181818]/12">
              <h2 className="font-mono text-xs font-medium text-[#5E5A56]">
                Yang Anda dapatkan
              </h2>
              <ol className="space-y-3 text-sm text-[#181818]">
                <li className="flex gap-3">
                  <span className="font-mono text-xs text-[#5E5A56] pt-0.5">01</span>
                  <span>
                    Ringkasan mood utama dan genre dominan dari playlist Anda.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="font-mono text-xs text-[#5E5A56] pt-0.5">02</span>
                  <span>
                    Daftar lagu rekomendasi baru lengkap dengan alasan kecocokan, preview audio, dan lirik sinkron.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="font-mono text-xs text-[#5E5A56] pt-0.5">03</span>
                  <span>
                    Deteksi lagu di dalam playlist asal yang kurang selaras beserta penjelasan ketidaksesuaiannya.
                  </span>
                </li>
              </ol>
            </div>
          </aside>
        </div>

        {history.length > 0 && (
          <section
            aria-label="Riwayat kurasi terakhir"
            className="pt-8 border-t border-[#181818]/10 space-y-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-mono text-xs uppercase tracking-[0.06em] text-[#6E6A66]">
                RIWAYAT KURASI TERAKHIR
              </h2>
              <button
                type="button"
                onClick={onClearHistory}
                className="min-h-[44px] px-3 font-mono text-xs text-[#6E6A66] underline underline-offset-4 hover:text-[#9E472A] transition-colors"
              >
                Hapus Riwayat
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {history.map((entry) => {
                const info = entry.data.playlistInfo;
                const vibe = entry.data.vibeAnalysis;

                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => onSelectHistory(entry)}
                    className="p-4 bg-[#EFE9E5] border border-[#181818]/10 hover:border-[#181818] text-left flex items-center gap-4 transition-colors"
                  >
                    <div className="w-14 h-14 shrink-0 bg-[#E4DCD6] border border-[#181818]/10 overflow-hidden">
                      {info.image ? (
                        <img
                          src={info.image}
                          alt={`Sampul ${info.name}`}
                          width={56}
                          height={56}
                          loading="lazy"
                          className="w-full h-full object-cover block"
                        />
                      ) : (
                        <span className="w-full h-full flex items-center justify-center font-mono text-xs text-[#5E5A56]">
                          PL
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="font-sans font-semibold text-sm text-[#181818] truncate">
                        {info.name}
                      </p>
                      <p className="font-mono text-xs text-[#5E5A56] truncate">
                        {vibe?.mood || 'Curated'}
                      </p>
                      <p className="font-mono text-[11px] text-[#5E5A56] truncate">
                        {info.totalTracks} lagu · {formatHistoryTime(entry.analyzedAt)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
