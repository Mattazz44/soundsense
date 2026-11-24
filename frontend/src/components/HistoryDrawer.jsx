import { useEffect } from 'react';
import { formatHistoryTime } from '../utils/history.js';
import { CloseGlyph } from './Icons.jsx';

export function HistoryDrawer({
  isOpen,
  history,
  activePlaylistId,
  onClose,
  onSelectEntry,
  onClearHistory,
}) {
  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[#181818]/35"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <aside
        id="history-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Riwayat kurasi playlist"
        className="w-full max-w-[420px] h-full bg-[#F6F3F0] text-[#181818] border-l border-[#181818]/15 flex flex-col shadow-[0_24px_48px_rgba(24,24,24,0.2)]"
      >
        <div className="px-6 py-5 border-b border-[#181818]/10 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-sans font-bold text-base tracking-[-0.01em] text-[#181818]">
              Riwayat Kurasi
            </h2>
            <p className="text-xs text-[#6E6A66]">
              <span className="font-mono tabular-nums">{history.length}</span> playlist tersimpan
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup panel riwayat"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center border border-[#8A837C] text-[#181818] hover:border-[#181818] hover:bg-[#EFE9E5] transition-colors"
          >
            <CloseGlyph className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto editorial-scroll p-5 space-y-3">
          {history.length === 0 ? (
            <div className="p-5 bg-[#EFE9E5] border border-[#181818]/10 text-sm text-[#5E5A56] leading-relaxed">
              Belum ada riwayat kurasi tersimpan. Setiap playlist yang selesai dianalisis akan
              tersimpan otomatis di browser Anda.
            </div>
          ) : (
            history.map((entry) => {
              const info = entry.data.playlistInfo;
              const vibe = entry.data.vibeAnalysis;
              const isCurrent = entry.id === activePlaylistId;

              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => {
                    onSelectEntry(entry);
                    onClose();
                  }}
                  className={`w-full min-h-[68px] p-3.5 text-left border flex items-center gap-3.5 transition-colors ${
                    isCurrent
                      ? 'bg-[#EFE9E5] border-[#9E472A]'
                      : 'bg-[#EFE9E5]/65 border-[#181818]/10 hover:bg-[#EFE9E5] hover:border-[#181818]/40'
                  }`}
                >
                  <div className="w-12 h-12 shrink-0 bg-[#E4DCD6] border border-[#181818]/10 overflow-hidden">
                    {info.image ? (
                      <img
                        src={info.image}
                        alt={`Sampul ${info.name}`}
                        width={48}
                        height={48}
                        className="w-full h-full object-cover block"
                      />
                    ) : (
                      <span className="w-full h-full flex items-center justify-center text-[10px] font-medium text-[#5E5A56]">
                        PL
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-sans font-semibold text-sm text-[#181818] truncate">
                        {info.name}
                      </p>
                      <span className="text-[11px] text-[#5E5A56] shrink-0">
                        {formatHistoryTime(entry.analyzedAt)}
                      </span>
                    </div>
                    <p className="text-xs text-[#5E5A56] truncate">
                      {vibe?.mood || 'Curated'} ·{' '}
                      <span className="font-mono tabular-nums">{info.totalTracks}</span> lagu
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {history.length > 0 && (
          <div className="px-6 py-4 border-t border-[#181818]/10 flex justify-end">
            <button
              type="button"
              onClick={onClearHistory}
              className="min-h-[44px] px-4 border border-[#8A837C] text-xs font-medium text-[#181818] hover:border-[#9E472A] hover:text-[#9E472A] transition-colors"
            >
              Hapus Riwayat
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
