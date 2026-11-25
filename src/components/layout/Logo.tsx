/**
 * Bin-tag mark: an ink-outlined shelf tag with three petrol stock bars —
 * the Stockroom motif reduced to a glyph.
 */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden className="shrink-0">
      <rect x="1.75" y="4.75" width="24.5" height="18.5" rx="4" stroke="var(--color-ink)" strokeWidth="1.5" fill="var(--color-surface)" />
      <circle cx="6.5" cy="14" r="1.6" fill="var(--color-ink)" />
      <rect x="10.5" y="15" width="3" height="4.5" rx=".75" fill="var(--color-petrol-500)" />
      <rect x="15.25" y="11.5" width="3" height="8" rx=".75" fill="var(--color-petrol-500)" />
      <rect x="20" y="8.5" width="3" height="11" rx=".75" fill="var(--color-petrol-500)" />
    </svg>
  );
}
