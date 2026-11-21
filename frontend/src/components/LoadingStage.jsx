import { useEffect, useState } from 'react';

const LOADING_STAGES = [
  'Membaca daftar lagu & katalog Spotify...',
  'Menganalisis mood, genre, dan tempo playlist...',
  'AI sedang mengurasi lagu terbaik & mendeteksi lagu kurang cocok...',
  'Menyiapkan cover album & pratinjau audio 30 detik...',
];

const CURATOR_TRIVIA = [
  'Columbia Records memperkenalkan piringan hitam LP 33 1/3 RPM microgroove pada tahun 1948, menggantikan piringan 78 RPM yang rapuh dan berdurasi singkat.',
  'Standar kurva ekualisasi RIAA disepakati pada tahun 1954 agar frekuensi bass diperkecil saat pencetakan alur vinyl dan dipulihkan kembali oleh preamp.',
  'Sisi luar piringan hitam menyimpan detail frekuensi tinggi lebih jernih karena kecepatan linear jarum di tepi luar jauh lebih tinggi dibanding dekat label tengah.',
  'Piringan single 7 inci berkecepatan 45 RPM pertama kali dirilis RCA Victor pada 1949 dan memicu budaya jukebox serta tangga lagu radio modern.',
  'Urutan lagu pada album vinyl sering dirancang berdasar dinamika sisi A dan sisi B, dengan lagu pembuka berenergi tinggi dan penutup yang lebih reflektif.',
];

export function LoadingStage({ onCancel }) {
  const [stageIndex, setStageIndex] = useState(0);
  const [progress, setProgress] = useState(6);
  const [triviaIndex, setTriviaIndex] = useState(0);
  const [isTurntablePaused, setIsTurntablePaused] = useState(false);

  useEffect(() => {
    const stageTimer = setInterval(() => {
      setStageIndex((prev) => (prev + 1) % LOADING_STAGES.length);
    }, 1500);

    const progressTimer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return 95;
        const step = prev < 50 ? 4 : prev < 80 ? 2 : 1;
        return Math.min(95, prev + step);
      });
    }, 240);

    return () => {
      clearInterval(stageTimer);
      clearInterval(progressTimer);
    };
  }, []);

  function handleNextTrivia() {
    setTriviaIndex((prev) => (prev + 1) % CURATOR_TRIVIA.length);
  }

  return (
    <div className="min-h-dvh bg-[#F6F3F0] text-[#181818] flex flex-col">
      <header className="w-full max-w-[1320px] mx-auto px-5 sm:px-8 lg:px-12 py-6 flex items-center justify-between gap-4 border-b border-[#181818]/10">
        <span className="font-sans font-bold text-lg tracking-[-0.02em] text-[#181818]">
          SoundSense
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[44px] px-3 font-sans text-sm text-[#181818] underline underline-offset-4 hover:text-[#9E472A] transition-colors"
        >
          Batalkan
        </button>
      </header>

      <main className="flex-1 w-full max-w-[1160px] mx-auto px-5 sm:px-8 lg:px-12 py-10 lg:py-14 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
        <div className="lg:col-span-5 flex flex-col items-center">
          <div className="relative w-[270px] sm:w-[320px] aspect-square bg-[#EFE9E5] border border-[#181818]/12 p-5 sm:p-6 shadow-[0_18px_40px_rgba(24,24,24,0.10)] flex items-center justify-center">
            <div
              className={`relative w-[86%] aspect-square rounded-full turntable-vinyl-disc flex items-center justify-center ${
                isTurntablePaused ? 'vinyl-spin-paused' : 'vinyl-spin-active'
              }`}
            >
              <div className="vinyl-sheen absolute inset-0 rounded-full pointer-events-none" />
              <span className="relative z-10 font-mono text-[9px] tracking-[0.06em] text-[#181818] translate-y-5 select-none">
                33 1/3 RPM
              </span>
            </div>

            <svg
              viewBox="0 0 120 180"
              aria-hidden="true"
              className={`absolute top-3 right-3 w-[86px] sm:w-[100px] h-auto pointer-events-none transition-transform duration-500 origin-[88px_24px] ${
                isTurntablePaused ? '-rotate-12' : 'rotate-0'
              }`}
            >
              <circle cx="88" cy="24" r="14" fill="#EFE9E5" stroke="#181818" strokeWidth="2.5" />
              <circle cx="88" cy="24" r="4.5" fill="#9E472A" />
              <path
                d="M88 24 L74 114 L52 146"
                fill="none"
                stroke="#181818"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <rect
                x="41"
                y="141"
                width="16"
                height="24"
                rx="2"
                transform="rotate(34 49 153)"
                fill="#181818"
              />
              <circle cx="43" cy="161" r="2.2" fill="#9E472A" />
            </svg>
          </div>

          <button
            type="button"
            onClick={() => setIsTurntablePaused((prev) => !prev)}
            className="mt-4 min-h-[44px] px-4 font-mono text-xs text-[#6E6A66] hover:text-[#181818] underline underline-offset-4 transition-colors"
          >
            {isTurntablePaused ? 'Putar piringan kembali' : 'Jeda animasi piringan'}
          </button>
        </div>

        <div className="lg:col-span-7 space-y-8 min-w-0">
          <div className="space-y-4">
            <div className="flex items-baseline justify-between gap-4">
              <p className="font-mono text-xs text-[#5E5A56]">
                Sedang Mengurasi Playlist
              </p>
              <span className="font-mono text-sm font-medium text-[#181818] tabular-nums">
                {progress}%
              </span>
            </div>

            <div
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progres analisis playlist"
              className="w-full h-2 bg-[#EFE9E5] border border-[#181818]/12 overflow-hidden"
            >
              <div
                className="h-full bg-[#181818] transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>

            <p
              key={stageIndex}
              role="status"
              aria-live="polite"
              className="stage-enter font-sans font-semibold text-xl sm:text-2xl leading-snug tracking-[-0.02em] text-[#181818] min-h-[3.5rem]"
            >
              {LOADING_STAGES[stageIndex]}
            </p>
          </div>

          <button
            type="button"
            onClick={handleNextTrivia}
            className="w-full text-left bg-[#EFE9E5] border border-[#8A837C]/60 hover:border-[#181818] p-5 sm:p-6 space-y-2.5 transition-colors"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-[#9E472A]">
                CATATAN KURATOR
              </span>
              <span className="font-mono text-[11px] text-[#5E5A56]">
                Fakta {triviaIndex + 1}/{CURATOR_TRIVIA.length} · Klik untuk fakta berikutnya
              </span>
            </div>
            <p className="text-sm leading-[1.68] text-[#181818]">
              {CURATOR_TRIVIA[triviaIndex]}
            </p>
          </button>
        </div>
      </main>
    </div>
  );
}
