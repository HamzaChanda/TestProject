export function Logo({ size = 30 }: { size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-[9px] bg-brand text-white shadow-[0_1px_2px_rgba(16,24,40,0.15),inset_0_1px_0_rgba(255,255,255,0.18)]"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24" fill="none">
        <path d="M4 7.5 12 3l8 4.5-8 4.5-8-4.5Z" fill="currentColor" fillOpacity=".95" />
        <path d="m4 12 8 4.5 8-4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeOpacity=".75" />
        <path d="m4 16.5 8 4.5 8-4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeOpacity=".5" />
      </svg>
    </span>
  );
}
