import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Stock Ledger status system — one rule:
 *   • Informational states → <StatusText> (6px dot + text, no fill).
 *   • States that need action → <Badge> (20px tag, tinted, bordered).
 * `StatusBadge` applies this rule automatically from a status label.
 */
export type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";

const badgeTone: Record<Tone, string> = {
  neutral: "border-line-strong bg-sunken text-ink-2",
  brand: "border-petrol-100 bg-petrol-50 text-petrol-700",
  success: "border-success-line bg-success-bg text-success",
  warning: "border-warning-line bg-warning-bg text-warning",
  danger: "border-danger-line bg-danger-bg text-danger",
  info: "border-info-line bg-info-bg text-info",
};

const dotTone: Record<Tone, string> = {
  neutral: "bg-faint",
  brand: "bg-petrol-500",
  success: "bg-success-solid",
  warning: "bg-warning-solid",
  danger: "bg-danger-solid",
  info: "bg-info-solid",
};

/** Tag-shaped badge for states that need attention. */
export function Badge({
  tone = "neutral",
  dot = false,
  children,
  className,
}: {
  tone?: Tone;
  /** Kept for API compatibility; badges read as tags and normally carry no dot. */
  dot?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1.5 rounded-tag border px-1.5 text-[11.5px] leading-none font-semibold whitespace-nowrap",
        badgeTone[tone],
        className,
      )}
    >
      {dot && <span className={cn("size-1.5 rounded-full", dotTone[tone])} aria-hidden />}
      {children}
    </span>
  );
}

/** Dot + text for informational states (no fill). */
export function StatusText({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-label font-medium whitespace-nowrap text-ink-2", className)}>
      <span className={cn("size-1.5 shrink-0 rounded-full", dotTone[tone])} aria-hidden />
      {children}
    </span>
  );
}

/** States that call for user action are badges; everything else is status text. */
const STATUS: Record<string, { tone: Tone; action: boolean }> = {
  "In Stock": { tone: "success", action: false },
  "Low Stock": { tone: "warning", action: true },
  "Out of Stock": { tone: "danger", action: true },
  Completed: { tone: "success", action: false },
  Pending: { tone: "warning", action: true },
  Cancelled: { tone: "neutral", action: false },
  Paid: { tone: "success", action: false },
  Partial: { tone: "warning", action: true },
  Unpaid: { tone: "danger", action: true },
  Overdue: { tone: "danger", action: true },
  Draft: { tone: "neutral", action: false },
  "Partially Received": { tone: "warning", action: true },
  Received: { tone: "success", action: false },
  "In Transit": { tone: "info", action: false },
};

export function StatusBadge({ status, className, detail }: { status: string; className?: string; detail?: string }) {
  const s = STATUS[status] ?? { tone: "neutral" as Tone, action: false };
  const label = detail ? `${status} · ${detail}` : status;
  return s.action ? (
    <Badge tone={s.tone} className={className}>
      {label}
    </Badge>
  ) : (
    <StatusText tone={s.tone} className={className}>
      {label}
    </StatusText>
  );
}
