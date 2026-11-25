/**
 * MetricStrip — replaces rows of KPI tiles. One sheet, equal cells split by
 * hairlines. Each cell: overline label · figure · delta/hint · optional sparkline.
 * Cells with `tone` get the Stockroom floor-tape stripe on their top edge.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Overline } from "./Stockroom";

export interface Metric {
  label: string;
  value: ReactNode;
  /** Small line under the value (delta, context). */
  detail?: ReactNode;
  href?: string;
  /** Attention stripe — only when the metric needs action. */
  tone?: "warning" | "danger";
  spark?: number[];
  /** Accessible summary for linked cells. */
  ariaLabel?: string;
}

export function Sparkline({ data, className }: { data: number[]; className?: string }) {
  if (data.length < 2) return null;
  const w = 96;
  const h = 24;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const span = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * (w - 4) + 2, h - 3 - ((v - min) / span) * (h - 6)]);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className={cn("overflow-visible", className)} aria-hidden>
      <path d={d} fill="none" stroke="var(--color-chart-1)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r="2.5" fill="var(--color-chart-1)" stroke="var(--color-surface)" strokeWidth="1.5" />
    </svg>
  );
}

export function MetricStrip({
  metrics,
  size = "md",
  flush,
  className,
}: {
  metrics: Metric[];
  size?: "md" | "lg";
  /** Inside a sheet: no outer border/radius, bottom rule only. */
  flush?: boolean;
  className?: string;
}) {
  const cols = { 2: "lg:grid-cols-2", 3: "lg:grid-cols-3", 4: "lg:grid-cols-4", 5: "lg:grid-cols-5" }[metrics.length] ?? "lg:grid-cols-4";
  return (
    <div className={cn("grid grid-cols-2 gap-px overflow-hidden bg-line", flush ? "border-b border-line" : "rounded-panel border border-line", cols, className)}>
      {metrics.map((m) => {
        const body = (
          <>
            {m.tone && <span aria-hidden className={cn("absolute inset-x-0 top-0 h-[3px]", m.tone === "danger" ? "bg-danger-solid" : "bg-signal")} />}
            <Overline>{m.label}</Overline>
            <div className="mt-1.5 flex items-end justify-between gap-3">
              <span className={cn("font-semibold tracking-[-0.015em] text-ink tabular", size === "lg" ? "text-h1" : "text-h2")}>{m.value}</span>
              {m.spark && <Sparkline data={m.spark} className="mb-1 hidden shrink-0 sm:block" />}
            </div>
            {m.detail && <div className="mt-1 min-h-4 text-label text-muted">{m.detail}</div>}
          </>
        );
        const cls = "relative block min-w-0 bg-surface px-4 py-3.5 md:px-5";
        return m.href ? (
          <Link key={m.label} href={m.href} aria-label={m.ariaLabel} className={cn(cls, "transition-colors duration-[80ms] hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand")}>
            {body}
          </Link>
        ) : (
          <div key={m.label} className={cls}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
