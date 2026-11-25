"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import { CHART_COLORS } from "@/lib/constants";
import { cn, formatCompactCurrency, formatCurrency, formatNumber } from "@/lib/utils";

// Token literals (SVG attributes cannot read CSS vars): faint #89928e, sunken #eef0ee.
const AXIS = { fontSize: 11, fill: "#89928e", fontFamily: "var(--font-plex-mono), ui-monospace, monospace" };
const GRID = "#eef0ee";
const CURSOR = { fill: "rgba(17,22,20,0.04)", radius: 4 };
const SALES = CHART_COLORS[0];
const PURCHASES = CHART_COLORS[1];

function TooltipBox({ title, rows }: { title: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="min-w-[180px] rounded-panel border border-line bg-surface px-3 py-2.5 shadow-[var(--shadow-pop)]">
      <div className="mb-1.5 text-label font-semibold text-ink">{title}</div>
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-4 text-label">
            <span className="flex items-center gap-1.5 text-muted">
              {r.color && <span className="h-2 w-2 rounded-[3px]" style={{ background: r.color }} />}
              {r.label}
            </span>
            <span className="font-mono text-[12px] text-ink">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LegendItem({ color, label, value }: { color: string; label: string; value?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-label text-ink-2">
      <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: color }} />
      {label}
      {value && <span className="font-medium text-ink tabular">{value}</span>}
    </span>
  );
}

/* --------------------------- Sales vs purchases -------------------------- */

export interface MonthlyPoint {
  label: string;
  fullLabel: string;
  sales: number;
  purchases: number;
  orders: number;
}

export function SalesPurchasesChart({ data, height = 280 }: { data: MonthlyPoint[]; height?: number }) {
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const toggle = (k: string) => setHidden((h) => ({ ...h, [k]: !h[k] }));
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {[
          { key: "sales", label: "Sales", color: SALES },
          { key: "purchases", label: "Purchases", color: PURCHASES },
        ].map((s) => (
          <button
            key={s.key}
            onClick={() => toggle(s.key)}
            className={cn(
              "inline-flex h-6 items-center gap-1.5 rounded-tag border border-line px-2 text-label font-medium transition-colors duration-[80ms] focus-visible:outline-2 focus-visible:outline-brand",
              hidden[s.key] ? "text-faint opacity-60" : "text-ink-2 hover:bg-subtle",
            )}
            aria-pressed={!hidden[s.key]}
          >
            <span className="size-2.5 rounded-[2px]" style={{ background: hidden[s.key] ? "#d2d8d4" : s.color }} />
            {s.label}
          </button>
        ))}
      </div>
      <div style={{ height }} className="-ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={data.length > 16 ? 1 : 2} barCategoryGap={data.length > 16 ? "18%" : "28%"} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS} dy={6} interval="preserveStartEnd" minTickGap={18} />
            <YAxis tickLine={false} axisLine={false} tick={AXIS} width={56} tickFormatter={(v) => formatCompactCurrency(v)} />
            <Tooltip
              cursor={CURSOR}
              content={({ active, payload }: TooltipProps<number, string>) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as MonthlyPoint;
                return (
                  <TooltipBox
                    title={p.fullLabel}
                    rows={[
                      ...(!hidden.sales ? [{ label: "Sales", value: formatCurrency(p.sales), color: SALES }] : []),
                      ...(!hidden.purchases ? [{ label: "Purchases", value: formatCurrency(p.purchases), color: PURCHASES }] : []),
                      { label: "Invoices", value: String(p.orders) },
                    ]}
                  />
                );
              }}
            />
            {!hidden.sales && <Bar dataKey="sales" name="Sales" fill={SALES} radius={[3, 3, 0, 0]} maxBarSize={data.length > 16 ? 10 : 24} isAnimationActive={false} />}
            {!hidden.purchases && <Bar dataKey="purchases" name="Purchases" fill={PURCHASES} radius={[3, 3, 0, 0]} maxBarSize={data.length > 16 ? 10 : 24} isAnimationActive={false} />}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ------------------------------- Donut ---------------------------------- */

export interface DonutDatum {
  name: string;
  value: number;
  sub?: string;
}

export function DonutChart({
  data,
  format = "currency",
  centerLabel,
}: {
  data: DonutDatum[];
  format?: "currency" | "number";
  centerLabel: string;
}) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  const fmt = (v: number) => (format === "currency" ? formatCurrency(v, { whole: true }) : formatNumber(v));
  const fmtCompact = (v: number) => (format === "currency" ? formatCompactCurrency(v) : formatNumber(v));
  const active = activeIdx !== null ? data[activeIdx] : null;
  // Fixed-order palette; anything past the palette folds into the last slot.
  const colorFor = (i: number) => CHART_COLORS[Math.min(i, CHART_COLORS.length - 1)];

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center xl:flex-col xl:items-stretch [&>div:first-child]:self-center">
      <div className="relative h-[188px] w-[188px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={62}
              outerRadius={90}
              paddingAngle={1.5}
              stroke="#fff"
              strokeWidth={2}
              startAngle={90}
              endAngle={-270}
              onMouseEnter={(_, i) => setActiveIdx(i)}
              onMouseLeave={() => setActiveIdx(null)}
              isAnimationActive={false}
            >
              {data.map((d, i) => (
                <Cell key={d.name} fill={colorFor(i)} opacity={activeIdx === null || activeIdx === i ? 1 : 0.35} style={{ outline: "none", transition: "opacity 120ms" }} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-label text-muted">{active ? active.name : centerLabel}</span>
          <span className="text-h3 font-semibold tracking-[-0.01em] text-ink tabular">{fmtCompact(active ? active.value : total)}</span>
          {active && <span className="text-label text-muted tabular">{total ? ((active.value / total) * 100).toFixed(1) : 0}%</span>}
        </div>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-1">
        {data.map((d, i) => (
          <li
            key={d.name}
            onMouseEnter={() => setActiveIdx(i)}
            onMouseLeave={() => setActiveIdx(null)}
            className={cn("flex items-center gap-2.5 rounded-control px-2 py-1.5 text-label transition-colors", activeIdx === i && "bg-subtle")}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: colorFor(i) }} />
            <span className="min-w-0 flex-1 truncate text-ink-2">
              {d.name}
              {d.sub && <span className="ml-1 text-faint">· {d.sub}</span>}
            </span>
            <span className="font-medium text-ink tabular">{fmt(d.value)}</span>
            <span className="w-11 text-right text-muted tabular">{total ? Math.round((d.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------------------- Horizontal bars --------------------------- */

export function RankedBars({
  data,
  format = "currency",
  color = SALES,
}: {
  data: { name: string; value: number; sub?: string }[];
  format?: "currency" | "number";
  color?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const fmt = (v: number) => (format === "currency" ? formatCurrency(v, { whole: true }) : formatNumber(v));
  return (
    <ul className="space-y-3">
      {data.map((d) => (
        <li key={d.name} className="group">
          <div className="mb-1 flex items-baseline justify-between gap-3 text-label">
            <span className="truncate text-ink-2">
              {d.name}
              {d.sub && <span className="ml-1.5 text-faint">{d.sub}</span>}
            </span>
            <span className="font-medium text-ink tabular">{fmt(d.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-fill" title={`${d.name}: ${fmt(d.value)}`}>
            <div className="h-full rounded-full transition-all group-hover:brightness-95" style={{ width: `${(d.value / max) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ----------------------------- Trend (1 series) ---------------------------- */

export function TrendBarChart({
  data,
  height = 240,
  color = SALES,
  seriesLabel,
}: {
  data: { label: string; fullLabel: string; value: number; count?: number }[];
  height?: number;
  color?: string;
  seriesLabel: string;
}) {
  const dense = data.length > 16;
  return (
    <div style={{ height }} className="-ml-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap={dense ? "18%" : "30%"} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS} dy={6} interval={dense ? "preserveStartEnd" : 0} minTickGap={12} />
          <YAxis tickLine={false} axisLine={false} tick={AXIS} width={56} tickFormatter={(v) => formatCompactCurrency(v)} />
          <Tooltip
            cursor={CURSOR}
            content={({ active, payload }: TooltipProps<number, string>) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as { fullLabel: string; value: number; count?: number };
              return (
                <TooltipBox
                  title={p.fullLabel}
                  rows={[
                    { label: seriesLabel, value: formatCurrency(p.value), color },
                    ...(p.count !== undefined ? [{ label: "Documents", value: String(p.count) }] : []),
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="value" name={seriesLabel} fill={color} radius={[4, 4, 0, 0]} maxBarSize={dense ? 14 : 32} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
