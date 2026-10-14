/** The adjacent brand provides the accessible name for this decorative mark. */
export function OrbitalMark() {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" className="orbital-mark">
      <circle cx="32" cy="32" r="24" />
      <ellipse cx="32" cy="32" rx="11" ry="24" transform="rotate(24 32 32)" />
      <ellipse cx="32" cy="32" rx="24" ry="9" transform="rotate(-22 32 32)" />
      <ellipse cx="32" cy="32" rx="30" ry="15" transform="rotate(-48 32 32)" />
      <path d="M11 20c13 9 30 12 44 9M9 39c14 9 29 12 43 5" />
    </svg>
  );
}
