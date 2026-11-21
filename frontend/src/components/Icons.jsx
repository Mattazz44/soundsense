export function PlayCircleIcon({ className = 'w-5 h-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path d="M10 8.5L16 12L10 15.5V8.5Z" fill="#F6F3F0" />
    </svg>
  );
}

export function PlayGlyph({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
      <path d="M4.5 2.75L13 8L4.5 13.25V2.75Z" />
    </svg>
  );
}

export function PauseGlyph({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
      <rect x="4" y="3" width="2.5" height="10" />
      <rect x="9.5" y="3" width="2.5" height="10" />
    </svg>
  );
}

export function PrevGlyph({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
      <rect x="2.5" y="3" width="2" height="10" />
      <path d="M13 3L5.5 8L13 13V3Z" />
    </svg>
  );
}

export function NextGlyph({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
      <path d="M3 3L10.5 8L3 13V3Z" />
      <rect x="11.5" y="3" width="2" height="10" />
    </svg>
  );
}

export function VolumeGlyph({ className = 'w-4 h-4' }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 7.5H6.5L11 4V16L6.5 12.5H3V7.5Z" fill="currentColor" stroke="none" />
      <path d="M14 7.2C14.9 8.1 14.9 11.9 14 12.8" strokeLinecap="round" />
      <path d="M16.3 5.2C17.9 7.2 17.9 12.8 16.3 14.8" strokeLinecap="round" />
    </svg>
  );
}

export function AlertMarkIcon({ className = 'w-4 h-4' }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="square"
      className={className}
      aria-hidden="true"
    >
      <circle cx="10" cy="10" r="7.5" />
      <path d="M10 6.2V10.8" />
      <circle cx="10" cy="13.6" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ArrowRightGlyph({ className = 'w-4 h-4' }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 10H16.5" />
      <path d="M11.5 5L16.5 10L11.5 15" />
    </svg>
  );
}

export function CloseGlyph({ className = 'w-4 h-4' }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 4L12 12" />
      <path d="M12 4L4 12" />
    </svg>
  );
}

export function EqualizerBars({ className = 'w-4 h-4' }) {
  return (
    <span aria-hidden="true" className={`inline-flex items-end gap-[2.5px] ${className}`}>
      <span className="eq-bar-1 w-[3px] h-full bg-[#9E472A]" />
      <span className="eq-bar-2 w-[3px] h-full bg-[#9E472A]" />
      <span className="eq-bar-3 w-[3px] h-full bg-[#9E472A]" />
    </span>
  );
}
