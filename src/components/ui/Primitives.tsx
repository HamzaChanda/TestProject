"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowDownRight, ArrowUpRight, Minus, Search, X } from "lucide-react";
import { cn, initials as toInitials } from "@/lib/utils";
import { Card } from "./Card";
import { Combobox } from "./Combobox";
import { BinMeter, Overline } from "./Stockroom";

/* ----------------------------- Page header ----------------------------- */

/**
 * The single page-title pattern used by every route:
 *   [back link] [eyebrow] [meta row: ids, status]
 *   Title (h1 24/30 · 600)                         [actions — at most one filled]
 *   Description (body 14/20 · muted)
 */
export function PageHeader({
  title,
  description,
  actions,
  meta,
  back,
  eyebrow,
  tight,
  className,
}: {
  /** Smaller bottom gap (when a briefing line follows). */
  tight?: boolean;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  back?: { href: string; label: string };
  eyebrow?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(tight ? "mb-3" : "mb-8", "flex flex-col gap-4 md:flex-row md:items-end md:justify-between", className)}>
      <div className="min-w-0">
        {back && (
          <Link
            href={back.href}
            className="no-print group mb-2 inline-flex items-center gap-1 text-label font-medium text-muted transition-colors hover:text-ink"
          >
            <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
            {back.label}
          </Link>
        )}
        {eyebrow && <div className="mb-1.5"><Overline>{eyebrow}</Overline></div>}
        {meta && <div className="mb-2 flex flex-wrap items-center gap-2">{meta}</div>}
        <h1 className="truncate text-h1 font-semibold tracking-[-0.015em] text-ink">{title}</h1>
        {description && <p className="mt-1 text-body text-muted">{description}</p>}
      </div>
      {actions && <div className="no-print flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ------------------------------ Delta ------------------------------ */

/** Period-over-period change. Colour only when direction is meaningful. */
export function Delta({ value, label, invert }: { value: number | null | undefined; label?: string; invert?: boolean }) {
  if (value === undefined) return null;
  const good = value !== null && value !== 0 && (invert ? value < 0 : value > 0);
  const bad = value !== null && value !== 0 && (invert ? value > 0 : value < 0);
  return (
    <span className="inline-flex items-center gap-1 text-label">
      <span className={cn("inline-flex items-center gap-0.5 font-medium tabular", good && "text-success", bad && "text-danger", !good && !bad && "text-muted")}>
        {value === null ? "New" : value === 0 ? <><Minus className="size-3" />0%</> : <>{value > 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}{Math.abs(value).toFixed(1)}%</>}
      </span>
      {label && <span className="text-muted">{label}</span>}
    </span>
  );
}

/* ------------------------------ Stat card ------------------------------ */

/** Single metric on a sheet (legacy pages). New screens use <MetricStrip>. No icon chips. */
export function StatCard({
  label,
  value,
  hint,
  trend,
  trendLabel,
  invertTrend,
  onClick,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  /** Accepted for API compatibility; Stock Ledger metrics carry no icon chips. */
  icon?: ReactNode;
  trend?: number | null;
  trendLabel?: string;
  invertTrend?: boolean;
  /** Accepted for API compatibility (no accent tiles in Stock Ledger). */
  accent?: string;
  onClick?: () => void;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Card className={cn(onClick && "transition-colors hover:border-line-strong")}>
      <Comp onClick={onClick} className="block w-full px-4 py-3.5 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand md:px-5">
        <Overline>{label}</Overline>
        <div className="mt-1.5 text-h1 font-semibold tracking-[-0.015em] text-ink tabular">{value}</div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {trend !== undefined && <Delta value={trend} label={trendLabel} invert={invertTrend} />}
          {hint && <span className="text-label text-muted">{hint}</span>}
        </div>
      </Comp>
    </Card>
  );
}

/* ------------------------------ Empty state ----------------------------- */

/** Names what will appear and offers one action. No illustration tiles. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  compact,
}: {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 text-center", compact ? "min-h-[140px] py-8" : "min-h-[200px] py-12")}>
      <span className="mb-3 text-muted [&_svg]:size-5" aria-hidden>
        {icon}
      </span>
      <h3 className="text-h3 font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-body-sm text-muted">{description}</p>}
      {action && <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

/* ----------------------------- Search input ----------------------------- */

/** Toolbar search (32px). Press "/" anywhere to focus the page's search. */
export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative w-full sm:w-[260px]", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-faint" aria-hidden />
      <input
        data-page-search
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-8 w-full rounded-control border border-line-strong bg-surface pr-8 pl-8 text-body-sm text-ink placeholder:text-faint transition-[border-color,box-shadow] duration-[80ms] hover:border-control focus:border-petrol-500 focus:ring-[3px] focus:ring-petrol-500/20 focus:outline-none [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value ? (
        <button onClick={() => onChange("")} className="absolute top-1/2 right-1.5 grid size-5 -translate-y-1/2 place-items-center rounded-tag text-faint hover:bg-hover hover:text-ink" aria-label="Clear search">
          <X className="size-3.5" />
        </button>
      ) : (
        <kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded-tag border border-line px-1 font-mono text-[10.5px] text-muted max-sm:hidden">/</kbd>
      )}
    </div>
  );
}

/* ------------------------------- Filters ------------------------------- */

/** Toolbar filter — a Combobox in filter style ("Status: Unpaid"). Value "all" = no filter. */
export function FilterSelect({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label: string;
  className?: string;
}) {
  return (
    <Combobox
      size="sm"
      filterLabel={label}
      defaultValue="all"
      value={value}
      onChange={(v) => onChange(v ?? "all")}
      options={options}
      className={cn("w-full sm:w-auto sm:min-w-[170px]", className)}
      panelWidth={220}
    />
  );
}

export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-2 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center md:px-5", className)}>{children}</div>;
}

/* ------------------------------- Segmented ------------------------------ */

/** Small toggle (≤ 3 options). Page-level view switching uses <Tabs>. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = "sm",
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; count?: number }[];
  className?: string;
  size?: "sm" | "md";
  ariaLabel?: string;
}) {
  return (
    <div className={cn("scrollbar-thin inline-flex max-w-full overflow-x-auto rounded-control bg-sunken p-0.5", className)} role="radiogroup" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-[5px] font-medium whitespace-nowrap transition-[background-color,color,box-shadow] duration-[120ms]",
            size === "sm" ? "h-6 px-2.5 text-label" : "h-7 px-3 text-label",
            value === o.value ? "bg-surface text-ink shadow-xs" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
          {o.count !== undefined && <span className="font-mono text-[11px] text-muted">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* -------------------------------- Tooltip ------------------------------- */

/** Ink tooltip: 400ms on hover, immediate on keyboard focus, hides immediately. */
export function Tooltip({ label, children, side = "top" }: { label: string; children: ReactNode; side?: "top" | "right" | "bottom" }) {
  return (
    <span className="group/tt relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-[90] max-w-[240px] rounded-tag bg-ink px-2 py-1 text-label font-medium whitespace-nowrap text-white opacity-0",
          "transition-opacity duration-[80ms] group-hover/tt:opacity-100 group-hover/tt:delay-[400ms] group-has-[:focus-visible]/tt:opacity-100 group-has-[:focus-visible]/tt:delay-0",
          side === "top" && "bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2",
          side === "bottom" && "top-[calc(100%+6px)] left-1/2 -translate-x-1/2",
          side === "right" && "top-1/2 left-[calc(100%+10px)] -translate-y-1/2",
        )}
      >
        {label}
      </span>
    </span>
  );
}

/* ------------------------------ Misc atoms ------------------------------ */

/** Neutral avatar: initials on sunken (ink-2 ≈ 9:1). No per-person hues. */
export function Avatar({ name, size = 32, className }: { name: string; size?: number; className?: string }) {
  return (
    <span
      className={cn("inline-grid shrink-0 place-items-center rounded-full bg-sunken font-semibold text-ink-2 ring-1 ring-line ring-inset", className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      aria-hidden
    >
      {toInitials(name)}
    </span>
  );
}

/** Legacy product glyph (neutral). Redesigned screens identify products by name + SKU only. */
export function ProductThumb({ name, size = 34 }: { name: string; category?: string; size?: number }) {
  const letters = name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
  return (
    <span className="inline-grid shrink-0 place-items-center rounded-control bg-sunken text-label font-semibold text-ink-2" style={{ width: size, height: size }} aria-hidden>
      {letters}
    </span>
  );
}

export function KeyValue({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-label text-muted">{label}</dt>
      <dd className="mt-0.5 text-body font-medium text-ink">{children}</dd>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-[pulse_1.4s_ease-in-out_infinite] rounded-tag bg-sunken", className)} aria-hidden />;
}

/** Stock level indicator — renders the Stockroom bin meter. */
export function StockBar({ qty, min }: { qty: number; min: number }) {
  return <BinMeter qty={qty} min={min} />;
}
