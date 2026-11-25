/**
 * Stockroom identity motifs (used ONLY where a real inventory concept appears):
 *   LocationTag — warehouse code in a 1px tag.
 *   BinMeter    — 4-segment stock gauge with a minimum-level tick.
 *   Code        — SKU / document identifiers in Plex Mono.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function LocationTag({
  code,
  name,
  className,
  emphasis,
}: {
  code: string;
  name?: string;
  className?: string;
  /** Destination in a route (MWH → RWH). */
  emphasis?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 rounded-[3px] border bg-surface px-1.5 font-mono text-[11px] leading-none whitespace-nowrap",
        emphasis ? "border-petrol-100 text-petrol-700" : "border-line-hover text-ink-2",
        className,
      )}
      title={name ? `${name} (${code})` : code}
    >
      <span className="font-medium tracking-[0.03em]">{code}</span>
      {name && <span className="font-sans text-label text-muted">{name}</span>}
    </span>
  );
}

/**
 * Bin meter: scale tops out at 2× the minimum (or the quantity, if higher),
 * so the minimum tick always sits in a readable place.
 */
export function BinMeter({ qty, min, className, label = true }: { qty: number; min: number; className?: string; label?: boolean }) {
  const cap = Math.max(min * 2, qty, 1);
  const filled = qty <= 0 ? 0 : Math.max(1, Math.ceil((qty / cap) * 4));
  const state = qty <= 0 ? "out" : qty <= min ? "low" : "ok";
  const segOn = state === "low" ? "bg-signal" : "bg-ink-2";
  const tick = `${Math.min(96, (min / cap) * 100)}%`;
  return (
    <span
      className={cn("relative inline-grid w-[62px] shrink-0 grid-cols-4 gap-[2px] align-middle", className)}
      role={label ? "img" : undefined}
      aria-label={label ? `${qty} on hand, minimum ${min}${state === "out" ? ", out of stock" : state === "low" ? ", below minimum" : ""}` : undefined}
    >
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 rounded-[1px]",
            state === "out" && i === 0 ? "bg-danger-solid" : i < filled ? segOn : "bg-sunken",
          )}
        />
      ))}
      <span className="absolute -top-[3px] h-3 w-[1.5px] bg-ink" style={{ left: tick }} aria-hidden />
    </span>
  );
}

export function Code({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("font-mono text-code text-ink-2", className)}>{children}</span>;
}

/** Overline label — condensed caps, shelf-label style. */
export function Overline({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("font-cond text-overline font-semibold tracking-[0.06em] text-muted uppercase", className)}>{children}</span>;
}
