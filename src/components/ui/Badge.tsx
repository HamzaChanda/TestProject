import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";

const tones: Record<Tone, { box: string; dot: string }> = {
  neutral: { box: "bg-[#f2f3f6] text-ink-2 ring-[#e3e5eb]", dot: "bg-faint" },
  brand: { box: "bg-brand-50 text-brand-700 ring-brand-100", dot: "bg-brand" },
  success: { box: "bg-success-bg text-success ring-success-line", dot: "bg-[#22a157]" },
  warning: { box: "bg-warning-bg text-warning ring-warning-line", dot: "bg-[#f59e0b]" },
  danger: { box: "bg-danger-bg text-danger ring-danger-line", dot: "bg-danger" },
  info: { box: "bg-info-bg text-info ring-info-line", dot: "bg-info" },
};

export function Badge({
  tone = "neutral",
  dot = true,
  children,
  className,
}: {
  tone?: Tone;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-[11.5px] font-medium ring-1 ring-inset",
        tones[tone].box,
        className,
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", tones[tone].dot)} />}
      {children}
    </span>
  );
}

const STATUS_TONES: Record<string, Tone> = {
  "In Stock": "success",
  "Low Stock": "warning",
  "Out of Stock": "danger",
  Completed: "success",
  Pending: "warning",
  Cancelled: "neutral",
  Paid: "success",
  Partial: "info",
  Unpaid: "danger",
  Draft: "neutral",
  "Partially Received": "info",
  Received: "success",
  "In Transit": "info",
  Overdue: "danger",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge tone={STATUS_TONES[status] ?? "neutral"} className={className}>
      {status}
    </Badge>
  );
}
