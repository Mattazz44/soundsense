export function VinylShowcase({ track, isPlaying }) {
  const coverAlt = track?.title
    ? `Sampul album untuk ${track.title} oleh ${track.artist}`
    : 'Sampul album';

  return (
    <div className="w-full flex justify-center lg:justify-start pr-8 sm:pr-12 lg:pr-14">
      <div
        key={track?._stageKey || 'empty-vinyl'}
        className="stage-enter relative w-[220px] sm:w-[270px] xl:w-[310px] aspect-square shrink-0"
      >
        <div
          aria-hidden="true"
          className={`vinyl-disc absolute top-1/2 -translate-y-1/2 right-[-28%] w-[90%] aspect-square rounded-full overflow-hidden ${
            isPlaying ? 'vinyl-spin-active' : 'vinyl-spin-paused'
          }`}
        >
          <div className="vinyl-sheen w-full h-full rounded-full" />
        </div>

        <div className="relative z-10 w-full h-full bg-[#EFE9E5] border border-[#181818]/12 shadow-[0_18px_40px_rgba(24,24,24,0.14)] overflow-hidden">
          {track?.coverUrl ? (
            <img
              src={track.coverUrl}
              alt={coverAlt}
              width={310}
              height={310}
              fetchPriority="high"
              className="w-full h-full object-cover block"
            />
          ) : (
            <div className="w-full h-full p-6 flex flex-col justify-between bg-[#EFE9E5] text-[#181818]">
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#5E5A56]">
                Tanpa Gambar Sampul
              </span>
              <div>
                <p className="font-sans font-bold text-lg leading-tight line-clamp-2">
                  {track?.title || 'Track'}
                </p>
                <p className="font-mono text-xs text-[#5E5A56] mt-1">
                  {track?.artist || ''}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
