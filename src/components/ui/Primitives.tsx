"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Search, X, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { cn, initials as toInitials } from "@/lib/utils";
import { Card } from "./Card";

/* ----------------------------- Page header ----------------------------- */

/**
 * The single page-title pattern used by every route:
 *   [back link]  [meta row: ids, status badges]
 *   Title (24px / semibold)                          [actions]
 *   Supporting description (13.5px / muted)
 */
export function PageHeader({
  title,
  description,
  actions,
  meta,
  back,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  back?: { href: string; label: string };
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between", className)}>
      <div className="min-w-0">
        {back && (
          <Link
            href={back.href}
            className="no-print group mb-2 inline-flex items-center gap-1 text-small font-medium text-muted transition-colors hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            {back.label}
          </Link>
        )}
        {meta && <div className="mb-2 flex flex-wrap items-center gap-2">{meta}</div>}
        <h1 className="truncate text-[22px] leading-tight font-semibold tracking-[-0.02em] text-ink md:text-[24px]">{title}</h1>
        {description && <p className="mt-1.5 text-ui leading-relaxed text-muted">{description}</p>}
      </div>
      {actions && <div className="no-print flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ------------------------------ Stat card ------------------------------ */

export function StatCard({
  label,
  value,
  hint,
  icon,
  trend,
  trendLabel,
  invertTrend,
  accent = "brand",
  onClick,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  trend?: number | null;
  trendLabel?: string;
  /** For metrics where down is good. */
  invertTrend?: boolean;
  accent?: "brand" | "success" | "warning" | "danger" | "info" | "neutral";
  onClick?: () => void;
}) {
  const accents = {
    brand: "bg-brand-50 text-brand",
    success: "bg-success-bg text-success",
    warning: "bg-warning-bg text-warning",
    danger: "bg-danger-bg text-danger",
    info: "bg-info-bg text-info",
    neutral: "bg-fill text-ink-2",
  };
  const showTrend = trend !== undefined;
  const positive = trend !== null && trend !== undefined && (invertTrend ? trend < 0 : trend > 0);
  const negative = trend !== null && trend !== undefined && (invertTrend ? trend > 0 : trend < 0);
  const Comp = onClick ? "button" : "div";
  return (
    <Card className={cn("relative overflow-hidden", onClick && "transition-shadow hover:shadow-[0_4px_14px_-6px_rgba(16,24,40,0.12)]")}>
      <Comp onClick={onClick} className="block w-full p-4 text-left md:p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-small font-medium text-muted">{label}</span>
          {icon && <span className={cn("grid h-8 w-8 place-items-center rounded-control [&_svg]:h-4 [&_svg]:w-4", accents[accent])}>{icon}</span>}
        </div>
        <div className="mt-2.5 text-[24px] leading-none font-semibold tracking-[-0.02em] text-ink tabular md:text-[26px]">{value}</div>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-small">
          {showTrend && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-medium tabular",
                positive && "bg-success-bg text-success",
                negative && "bg-danger-bg text-danger",
                !positive && !negative && "bg-fill text-muted",
              )}
            >
              {trend === null ? (
                "New"
              ) : trend === 0 ? (
                <>
                  <Minus className="h-3 w-3" /> 0%
                </>
              ) : (
                <>
                  {trend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {Math.abs(trend).toFixed(1)}%
                </>
              )}
            </span>
          )}
          {(hint || trendLabel) && <span className="text-muted">{trendLabel ?? hint}</span>}
        </div>
        {trendLabel && hint && <div className="mt-1 text-small text-faint">{hint}</div>}
      </Comp>
    </Card>
  );
}

/* ------------------------------ Empty state ----------------------------- */

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
    <div className={cn("flex flex-col items-center justify-center px-6 text-center", compact ? "py-8" : "py-14")}>
      <div className="relative mb-4">
        <div className="absolute inset-0 -m-2 rounded-2xl bg-brand-50/60" />
        <div className="relative grid h-11 w-11 place-items-center rounded-xl border border-line bg-surface text-muted shadow-[var(--shadow-card)] [&_svg]:h-5 [&_svg]:w-5">
          {icon}
        </div>
      </div>
      <h3 className="text-title-sm font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-body text-muted">{description}</p>}
      {action && <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

/* ----------------------------- Search input ----------------------------- */

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
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-faint" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-control border border-line-strong bg-surface pr-8 pl-9 text-body text-ink placeholder:text-faint shadow-[0_1px_2px_rgba(16,24,40,0.03)] transition focus:border-brand focus:ring-[3px] focus:ring-brand/15 focus:outline-none"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-faint hover:text-ink"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/* ------------------------------- Filters ------------------------------- */

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
    <label className={cn("relative inline-flex", className)}>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-9 w-full cursor-pointer appearance-none rounded-control border border-line-strong bg-surface pr-8 pl-3 text-body text-ink-2 shadow-[0_1px_2px_rgba(16,24,40,0.03)] transition hover:border-line-hover focus:border-brand focus:ring-[3px] focus:ring-brand/15 focus:outline-none",
          value !== "all" && "border-brand/40 bg-brand-50/40 text-ink",
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <svg className="pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </label>
  );
}

export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-2 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center md:px-5", className)}>{children}</div>;
}

/* ------------------------------- Segmented ------------------------------ */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; count?: number }[];
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div className={cn("scrollbar-thin inline-flex max-w-full overflow-x-auto rounded-panel bg-pressed p-[3px]", className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-control font-medium whitespace-nowrap transition-all",
            size === "sm" ? "h-7 px-2.5 text-small" : "h-8 px-3 text-small",
            value === o.value ? "bg-surface text-ink shadow-[0_1px_2px_rgba(16,24,40,0.08)]" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
          {o.count !== undefined && (
            <span className={cn("rounded px-1 text-micro tabular", value === o.value ? "bg-brand-50 text-brand" : "bg-black/5 text-muted")}>{o.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

/* -------------------------------- Tooltip ------------------------------- */

export function Tooltip({ label, children, side = "top" }: { label: string; children: ReactNode; side?: "top" | "right" | "bottom" }) {
  return (
    <span className="group/tt relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-[90] rounded-md bg-ink px-2 py-1 text-caption font-medium whitespace-nowrap text-white opacity-0 shadow-lg transition-opacity delay-75 duration-150 group-hover/tt:opacity-100 group-focus-within/tt:opacity-100",
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

export function Avatar({ name, size = 32, className }: { name: string; size?: number; className?: string }) {
  const palette = ["#635BFF", "#0E9F6E", "#D97706", "#2A78D6", "#C2417A", "#0F766E", "#7C3AED"];
  const idx = [...name].reduce((s, c) => s + c.charCodeAt(0), 0) % palette.length;
  const initials = toInitials(name);
  return (
    <span
      className={cn("inline-grid shrink-0 place-items-center rounded-full font-semibold text-white", className)}
      style={{ width: size, height: size, fontSize: size * 0.38, background: palette[idx] }}
    >
      {initials}
    </span>
  );
}

export function ProductThumb({ name, category, size = 34 }: { name: string; category: string; size?: number }) {
  const tones: Record<string, string> = {
    Peripherals: "bg-[#f0efff] text-[#5148e5]",
    Audio: "bg-[#fdf0f5] text-[#b4366b]",
    Accessories: "bg-[#eef6ff] text-[#1d6fd8]",
    Storage: "bg-[#ecfdf3] text-[#15803d]",
    Displays: "bg-[#fff4e8] text-[#c2410c]",
    Cables: "bg-[#f1f5f9] text-[#475569]",
    Power: "bg-[#fffbeb] text-[#b45309]",
  };
  const letters = name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
  return (
    <span
      className={cn("inline-grid shrink-0 place-items-center rounded-control text-caption font-semibold ring-1 ring-black/[0.04] ring-inset", tones[category] ?? "bg-fill text-ink-2")}
      style={{ width: size, height: size }}
    >
      {letters}
    </span>
  );
}

export function KeyValue({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-small text-muted">{label}</dt>
      <dd className="mt-0.5 text-ui font-medium text-ink">{children}</dd>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-pressed", className)} />;
}

export function StockBar({ qty, min }: { qty: number; min: number }) {
  const cap = Math.max(min * 3, qty, 1);
  const pct = Math.min(100, (qty / cap) * 100);
  const tone = qty <= 0 ? "bg-danger" : qty <= min ? "bg-warning-solid" : "bg-success-solid";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-pressed">
      <div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${Math.max(pct, qty > 0 ? 4 : 0)}%` }} />
    </div>
  );
}
