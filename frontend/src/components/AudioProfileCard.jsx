const AUDIO_AXES = [
  { key: 'energy', label: 'Energi' },
  { key: 'valence', label: 'Suasana Positif' },
  { key: 'danceability', label: 'Danceability' },
  { key: 'acousticness', label: 'Nuansa Akustik' },
];

export function AudioProfileCard({ playlistInfo, vibeAnalysis, audioProfile }) {
  const centroid = audioProfile?.centroid;
  const hasAudio = Boolean(audioProfile?.hasAudioProfile && centroid);
  const subGenres =
    vibeAnalysis?.dominantSubGenres?.length > 0
      ? vibeAnalysis.dominantSubGenres
      : audioProfile?.dominantSubGenres?.length > 0
        ? audioProfile.dominantSubGenres
        : vibeAnalysis?.genres ?? [];
  const langDist = audioProfile?.languageDistribution;

  return (
    <section
      aria-label="Profil mood dan fitur audio playlist"
      className="stage-enter w-full max-w-[1400px] mx-auto px-5 sm:px-8 lg:px-12 pt-6"
    >
      <div className="bg-white/80 backdrop-blur-sm border border-[#181818]/12 p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        <div className={`${hasAudio ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-2.5 min-w-0`}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-xs font-semibold uppercase tracking-[0.04em] text-[#9E472A]">
              {vibeAnalysis.mood}
            </span>
            <span className="text-xs text-[#5E5A56]">
              <span className="font-mono tabular-nums">{playlistInfo.analyzedTracks || playlistInfo.totalTracks}</span> lagu dianalisis
            </span>
            {hasAudio && (
              <span className="text-xs text-[#5E5A56]">
                Tempo inti <span className="font-mono tabular-nums font-medium text-[#181818]">{centroid.tempo} BPM</span>
              </span>
            )}
            {langDist && (langDist.indonesia > 0 || langDist.internasional > 0) && (
              <span className="text-xs text-[#5E5A56]">
                Indonesia <span className="font-mono tabular-nums font-medium text-[#181818]">{langDist.indonesia}</span> · Internasional <span className="font-mono tabular-nums font-medium text-[#181818]">{langDist.internasional}</span>
              </span>
            )}
          </div>

          <p className="text-sm leading-[1.65] text-[#181818] max-w-[78ch]">
            {vibeAnalysis.summary}
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            {subGenres.slice(0, 6).map((genre, idx) => (
              <span
                key={genre}
                className={`px-2.5 py-1 border text-xs font-medium ${
                  idx === 0
                    ? 'bg-[#181818] text-[#F6F3F0] border-[#181818]'
                    : 'bg-[#F6F3F0] text-[#181818] border-[#181818]/12'
                }`}
              >
                {genre}
              </span>
            ))}
            {audioProfile?.dominantArtists?.slice(0, 3).map((artist) => (
              <span
                key={artist.name}
                className="text-xs text-[#5E5A56] pl-1"
              >
                {artist.name} (<span className="font-mono tabular-nums">{artist.count}x</span>)
              </span>
            ))}
          </div>
        </div>

        {hasAudio && (
          <div className="lg:col-span-5 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-x-5 gap-y-3 border-t lg:border-t-0 lg:border-l border-[#181818]/12 pt-4 lg:pt-0 lg:pl-6">
            {AUDIO_AXES.map((axis, idx) => {
              const rawVal = centroid[axis.key] ?? 0;
              const pct = Math.round(rawVal * 100);
              return (
                <div
                  key={axis.key}
                  style={{ '--stagger': idx }}
                  className="stagger-item space-y-1.5"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-medium text-[#181818]">
                      {axis.label}
                    </span>
                    <span className="font-mono text-xs tabular-nums text-[#5E5A56]">
                      {pct}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-[#F6F3F0] border border-[#181818]/10 overflow-hidden">
                    <div
                      className="h-full bg-[#181818] transition-all duration-500 ease-out"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
