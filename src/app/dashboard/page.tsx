"use client";

/**
 * Dashboard — "Briefing" composition:
 *   A header · B briefing line · C attention queue · D reorder · E incoming
 *   F performance (range-driven) · G activity · H locations
 */
import { Suspense, useCallback, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { differenceInCalendarDays, parseISO } from "date-fns";
import {
  ArrowLeftRight,
  ArrowRight,
  Ban,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Download,
  PackageCheck,
  PackagePlus,
  PackageX,
  Pencil,
  Plus,
  ReceiptText,
  Settings,
  ShoppingCart,
  SlidersHorizontal,
  Truck,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import type { ActivityType, Product } from "@/types";
import { useInventory } from "@/context/InventoryContext";
import { useNavigate } from "@/hooks/useNavigate";
import {
  PERFORMANCE_PRESETS,
  getAttentionSummary,
  getDashboardKpis,
  getLowStockProducts,
  getPerformance,
  getReplenishment,
  getWarehouseStats,
  isOverdue,
  purchaseProgress,
  rangeFromPreset,
  type PerformancePreset,
} from "@/lib/selectors";
import { productStatus, totalStock } from "@/lib/calc";
import { cn, formatCurrency, formatDate, formatDateTime, formatNumber, timeAgo } from "@/lib/utils";
import { downloadCsv } from "@/lib/csv";
import { CHART_COLORS } from "@/lib/constants";
import { Sheet, SheetHeader } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { MetricStrip } from "@/components/ui/MetricStrip";
import { BinMeter, Code, LocationTag } from "@/components/ui/Stockroom";
import { Delta, EmptyState, PageHeader, Segmented } from "@/components/ui/Primitives";
import { SalesPurchasesChart } from "@/components/charts/Charts";
import { AdjustStockDialog } from "@/components/inventory/AdjustStockDialog";
import { TransferDialog } from "@/components/inventory/TransferDialog";

const PRESET_VALUES = PERFORMANCE_PRESETS.map((p) => p.value) as string[];

export default function DashboardPage() {
  return (
    <Suspense>
      <Dashboard />
    </Suspense>
  );
}

/** Range lives in the URL (?range=30d) so reload/back restore it. Invalid → 30D. */
function useRange(): [PerformancePreset, (p: PerformancePreset) => void] {
  const params = useSearchParams();
  const pathname = usePathname();
  const raw = params.get("range");
  const [preset, setPresetState] = useState<PerformancePreset>(raw && PRESET_VALUES.includes(raw) ? (raw as PerformancePreset) : "30d");
  const setPreset = useCallback(
    (p: PerformancePreset) => {
      setPresetState(p);
      const sp = new URLSearchParams(window.location.search);
      if (p === "30d") sp.delete("range");
      else sp.set("range", p);
      const qs = sp.toString();
      window.history.replaceState(window.history.state, "", qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname],
  );
  return [preset, setPreset];
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${formatNumber(n)} ${n === 1 ? one : many}`;
}

function Dashboard() {
  const { state } = useInventory();
  const navigate = useNavigate();
  const [preset, setPreset] = useRange();
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  const attention = useMemo(() => getAttentionSummary(state), [state]);
  const perf = useMemo(() => getPerformance(state, preset), [state, preset]);
  const lowStock = useMemo(() => getLowStockProducts(state), [state]);
  const locations = useMemo(() => getWarehouseStats(state), [state]);
  const stockKpis = useMemo(() => getDashboardKpis(state, rangeFromPreset(preset)), [state, preset]);
  const advice = useMemo(() => new Map(lowStock.map((p) => [p.id, getReplenishment(state, p)])), [lowStock, state]);
  const whById = useMemo(() => new Map(state.warehouses.map((w) => [w.id, w])), [state.warehouses]);
  const rangeLong = PERFORMANCE_PRESETS.find((p) => p.value === preset)!.long;

  const incoming = useMemo(
    () =>
      state.purchases
        .filter((p) => p.status === "Pending" || p.status === "Partially Received")
        .sort((a, b) => (a.expectedDate || "9999").localeCompare(b.expectedDate || "9999")),
    [state.purchases],
  );

  const exportReport = () =>
    downloadCsv(`stockflow-overview-${formatDate(new Date(), "yyyy-MM-dd")}`, [
      { Section: "Attention", Metric: "Out of stock products", Value: attention.out, Period: "Today" },
      { Section: "Attention", Metric: "Products below minimum", Value: attention.low, Period: "Today" },
      { Section: "Attention", Metric: "Overdue purchase orders", Value: attention.overduePOs, Period: "Today" },
      { Section: "Attention", Metric: "Invoices unpaid over 7 days", Value: attention.overdueSales, Period: "Today" },
      { Section: "Attention", Metric: "Overdue receivables", Value: attention.overdueAmount, Period: "Today" },
      { Section: "Performance", Metric: "Revenue", Value: perf.revenue, Period: rangeLong },
      { Section: "Performance", Metric: "Invoices", Value: perf.orders, Period: rangeLong },
      { Section: "Performance", Metric: "Average invoice", Value: perf.avgOrder, Period: rangeLong },
      { Section: "Performance", Metric: "Purchase spend", Value: perf.spend, Period: rangeLong },
      { Section: "Stock", Metric: "Stock value (cost)", Value: stockKpis.stockValue, Period: "Today" },
      ...perf.series.map((b) => ({ Section: "Series", Metric: `Sales ${b.fullLabel}`, Value: b.sales, Period: b.fullLabel })),
      ...perf.series.map((b) => ({ Section: "Series", Metric: `Purchases ${b.fullLabel}`, Value: b.purchases, Period: b.fullLabel })),
      ...perf.categories.map((c) => ({ Section: "Category revenue", Metric: c.category, Value: c.value, Period: rangeLong })),
      ...locations.map((w) => ({ Section: "Locations", Metric: `${w.name} (${w.code}) units`, Value: w.units, Period: "Today" })),
    ]);

  /* ---------------------------- B · Briefing ---------------------------- */
  const briefing: ReactNode[] = [];
  if (attention.out) briefing.push(<BriefLink key="out" href="/stock?status=Out%20of%20Stock">{plural(attention.out, "product")} out of stock</BriefLink>);
  if (attention.low) briefing.push(<BriefLink key="low" href="/stock?status=Low%20Stock">{formatNumber(attention.low)} below minimum</BriefLink>);
  if (attention.overduePOs) briefing.push(<BriefLink key="po" href="/purchases?status=overdue">{plural(attention.overduePOs, "purchase order")} overdue</BriefLink>);
  if (attention.overdueSales)
    briefing.push(
      <BriefLink key="ar" href="/sales?tab=overdue">
        {formatCurrency(attention.overdueAmount, { whole: true })} unpaid for over 7 days
      </BriefLink>,
    );

  /* ------------------------------ D · Reorder ----------------------------- */
  const reorderHref = (p: Product) => {
    const q = advice.get(p.id)?.suggestedQty ?? 0;
    return `/purchases/new?product=${p.id}${q > 0 ? `&qty=${q}` : ""}`;
  };
  const reorderColumns: Column<Product>[] = [
    {
      key: "product",
      header: "Product",
      sortValue: (p) => p.name,
      cell: (p) => (
        <Link href={`/products/${p.id}`} onClick={(e) => e.stopPropagation()} className="group/p block min-w-0 max-w-[260px]">
          <span className="block truncate font-medium text-ink group-hover/p:text-petrol-700">{p.name}</span>
          <Code className="text-muted">{p.sku}</Code>
        </Link>
      ),
    },
    {
      key: "where",
      header: "Locations",
      hideBelow: "laptop",
      cell: (p) => (
        <span className="flex gap-1">
          {state.warehouses.map((w) => (
            <span key={w.id} className="inline-flex items-center gap-1" title={`${w.name}: ${p.stock[w.id] ?? 0}`}>
              <LocationTag code={w.code} />
              <span className={cn("font-mono text-[12px]", (p.stock[w.id] ?? 0) === 0 ? "text-danger" : "text-ink-2")}>{p.stock[w.id] ?? 0}</span>
            </span>
          ))}
        </span>
      ),
    },
    {
      key: "level",
      header: "On hand",
      sortValue: (p) => totalStock(p) / Math.max(p.minStock, 1),
      cell: (p) => (
        <span className="flex items-center gap-2.5">
          <BinMeter qty={totalStock(p)} min={p.minStock} />
          <span className="font-mono text-[12px] text-ink-2">
            {totalStock(p)}
            <span className="text-faint">/{p.minStock}</span>
          </span>
        </span>
      ),
    },
    {
      key: "cover",
      header: "Cover",
      align: "right",
      sortValue: (p) => advice.get(p.id)?.daysOfCover ?? 9999,
      cell: (p) => {
        const d = advice.get(p.id)?.daysOfCover ?? null;
        if (totalStock(p) <= 0) return <span className="font-medium text-danger">Sold out</span>;
        if (d === null) return <span className="text-faint">No recent sales</span>;
        return <span className={cn("font-mono text-[12px]", d <= 7 ? "text-danger" : "text-ink-2")}>{d}d</span>;
      },
    },
    {
      key: "actions",
      header: <span className="sr-only">Suggested order</span>,
      align: "right",
      cell: (p) => {
        const a = advice.get(p.id);
        return a && a.suggestedQty > 0 ? (
          <span onClick={(e) => e.stopPropagation()}>
            <ButtonLink
              href={reorderHref(p)}
              size="sm"
              variant="secondary"
              title={`Restores stock to ${a.targetLevel} (minimum + 30 days of demand), after ${a.incoming} already on order`}
            >
              <span>
                Order <span className="font-mono">{a.suggestedQty}</span>
              </span>
            </ButtonLink>
          </span>
        ) : (
          <span className="text-label text-muted">{a?.incoming ? <>+<span className="font-mono">{a.incoming}</span> on order</> : "Covered"}</span>
        );
      },
    },
  ];

  const maxCat = Math.max(...perf.categories.map((c) => c.value), 1);
  const catTotal = perf.categories.reduce((s, c) => s + c.value, 0);

  return (
    <>
      {/* A · Header */}
      <PageHeader
        eyebrow={formatDate(new Date(), "EEEE, d MMMM")}
        title="Overview"
        actions={
          <>
            <Button variant="secondary" icon={<Download />} onClick={exportReport}>
              Export
            </Button>
            <Dropdown
              width={220}
              items={[
                { label: "New sale", icon: <ReceiptText />, href: "/sales/new" },
                { label: "New purchase order", icon: <ShoppingCart />, href: "/purchases/new" },
                { label: "Adjust stock", icon: <SlidersHorizontal />, onSelect: () => setAdjustOpen(true), separatorBefore: true },
                { label: "Transfer stock", icon: <ArrowLeftRight />, onSelect: () => setTransferOpen(true) },
              ]}
              trigger={({ toggle, open }) => (
                <Button icon={<Plus />} onClick={toggle} aria-expanded={open} aria-haspopup="menu">
                  Add transaction
                </Button>
              )}
            />
          </>
        }
        tight
      />

      {/* B · Briefing */}
      <p className="mb-6 max-w-[80ch] text-body text-ink-2" data-testid="briefing">
        {briefing.length ? (
          <>
            Today:{" "}
            {briefing.map((b, i) => (
              <span key={i}>
                {i > 0 && (i === briefing.length - 1 ? " and " : ", ")}
                {b}
              </span>
            ))}
            .
          </>
        ) : (
          <>Nothing needs attention today — stock is above minimum, deliveries are on time and invoices are collected.</>
        )}
      </p>

      {/* C · Attention queue */}
      <section aria-labelledby="attention-h">
        <h2 id="attention-h" className="sr-only">
          Needs attention
        </h2>
        <MetricStrip
          size="lg"
          metrics={[
            {
              label: "Out of stock",
              value: formatNumber(attention.out),
              detail: attention.out ? "Products with zero units" : "None",
              href: "/stock?status=Out%20of%20Stock",
              tone: attention.out ? "danger" : undefined,
              ariaLabel: `${attention.out} products out of stock — view in Stock`,
            },
            {
              label: "Below minimum",
              value: formatNumber(attention.low),
              detail: attention.low ? "At or under reorder level" : "All above minimum",
              href: "/stock?status=Low%20Stock",
              tone: attention.low ? "warning" : undefined,
              ariaLabel: `${attention.low} products below minimum — view in Stock`,
            },
            {
              label: "Overdue deliveries",
              value: formatNumber(attention.overduePOs),
              detail: attention.overduePOs ? `${formatCurrency(attention.overduePOValue, { whole: true })} still to arrive` : "All on schedule",
              href: "/purchases?status=overdue",
              tone: attention.overduePOs ? "warning" : undefined,
              ariaLabel: `${attention.overduePOs} overdue purchase orders — view in Purchases`,
            },
            {
              label: "Unpaid > 7 days",
              value: formatCurrency(attention.overdueAmount, { whole: true }),
              detail: attention.overdueSales ? plural(attention.overdueSales, "invoice") : "Nothing overdue",
              href: "/sales?tab=overdue",
              tone: attention.overdueSales ? "warning" : undefined,
              ariaLabel: `${attention.overdueSales} invoices unpaid for over 7 days — view in Sales`,
            },
          ]}
        />
      </section>

      {/* D · Reorder  +  E · Incoming */}
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Sheet className="overflow-clip">
          <SheetHeader
            title="Reorder recommendations"
            description="Suggested quantities restore minimum + 30 days of demand"
            actions={
              <ButtonLink href="/stock?status=attention" variant="ghost" size="sm">
                All low stock <ArrowRight />
              </ButtonLink>
            }
          />
          <DataTable
            label="Reorder recommendations"
            noun="products"
            minWidth={520}
            rows={lowStock}
            columns={reorderColumns}
            rowKey={(p) => p.id}
            pageSize={6}
            initialSort={{ key: "level", dir: "asc" }}
            onRowClick={(p) => navigate(`/products/${p.id}`)}
            rowTone={(p) => (productStatus(p) === "Out of Stock" ? "danger" : "warning")}
            mobileCard={(p) => {
              const a = advice.get(p.id);
              return (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-ink">{p.name}</div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <Code className="text-muted">{p.sku}</Code>
                      <BinMeter qty={totalStock(p)} min={p.minStock} />
                      <span className="font-mono text-[12px] text-ink-2">
                        {totalStock(p)}/{p.minStock}
                      </span>
                    </div>
                  </div>
                  {a && a.suggestedQty > 0 ? (
                    <span onClick={(e) => e.stopPropagation()}>
                      <ButtonLink href={reorderHref(p)} size="sm" variant="secondary">
                        <span>
                Order <span className="font-mono">{a.suggestedQty}</span>
              </span>
                      </ButtonLink>
                    </span>
                  ) : (
                    <span className="text-label text-muted">{a?.incoming ? `+${a.incoming} on order` : "Covered"}</span>
                  )}
                </div>
              );
            }}
            empty={<EmptyState compact icon={<PackageCheck />} title="Nothing to reorder" description="Every product is above its minimum level." />}
          />
        </Sheet>

        <Sheet className="overflow-clip">
          <SheetHeader
            title="Incoming deliveries"
            description={incoming.length ? `${plural(incoming.length, "open purchase order")}` : "No open purchase orders"}
            actions={
              <ButtonLink href="/purchases?status=open" variant="ghost" size="sm">
                Purchases <ArrowRight />
              </ButtonLink>
            }
          />
          {incoming.length ? (
            <ul className="divide-y divide-line">
              {incoming.slice(0, 6).map((p) => {
                const prog = purchaseProgress(p);
                const late = isOverdue(p);
                const lateBy = late ? differenceInCalendarDays(new Date(), parseISO(p.expectedDate)) : 0;
                const wh = whById.get(p.warehouseId);
                return (
                  <li key={p.id} className={cn("relative", late && "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-signal before:content-['']")}>
                    <Link href={`/purchases/${p.id}`} className="flex items-center gap-3 px-4 py-2.5 transition-colors duration-[80ms] hover:bg-row-hover focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand md:px-5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Code className="text-ink">{p.poNumber}</Code>
                          {wh && <LocationTag code={wh.code} />}
                        </div>
                        <div className="truncate text-label text-muted">{p.supplierName}</div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className={cn("text-body-sm", late ? "font-medium text-danger" : "text-ink-2")}>
                          {p.expectedDate ? formatDate(p.expectedDate, "d MMM") : "No date"}
                        </div>
                        <div className="text-label text-muted">
                          {late ? `${lateBy}d late · ` : ""}
                          <span className="font-mono">
                            {prog.received}/{prog.ordered}
                          </span>{" "}
                          recv.
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState compact icon={<Truck />} title="No deliveries expected" description="Open purchase orders will be listed here by expected date." />
          )}
        </Sheet>
      </div>

      {/* F · Performance */}
      <section aria-labelledby="perf-h" className="mt-section">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="perf-h" className="text-h2 font-semibold text-ink">
              Performance
            </h2>
            <p className="text-body-sm text-muted">
              {formatDate(perf.range.from, "d MMM")} – {formatDate(perf.range.to, "d MMM yyyy")} · compared with the previous {rangeLong.replace(/^last /, "")}
            </p>
          </div>
          <Segmented
            ariaLabel="Performance range"
            value={preset}
            onChange={setPreset}
            options={PERFORMANCE_PRESETS.map((p) => ({ value: p.value, label: p.label }))}
          />
        </div>

        <Sheet className="overflow-clip">
          <MetricStrip
            flush
            metrics={[
              {
                label: "Revenue",
                value: formatCurrency(perf.revenue, { whole: true }),
                detail: <Delta value={perf.revenueDelta} label="vs previous" />,
                spark: perf.series.map((b) => b.sales),
              },
              { label: "Invoices", value: formatNumber(perf.orders), detail: <Delta value={perf.ordersDelta} label="vs previous" /> },
              { label: "Average invoice", value: formatCurrency(perf.avgOrder, { whole: true }), detail: <Delta value={perf.avgOrderDelta} label="vs previous" /> },
              { label: "Purchase spend", value: formatCurrency(perf.spend, { whole: true }), detail: <Delta value={perf.spendDelta} label="vs previous" invert /> },
            ]}
          />
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
            <div className="min-w-0 p-4 md:p-5">
              <h3 className="mb-2 text-h3 font-semibold text-ink">Sales vs purchases</h3>
              <SalesPurchasesChart data={perf.series} height={240} />
            </div>
            <div className="min-w-0 border-t border-line p-4 md:p-5 lg:border-t-0 lg:border-l">
              <h3 className="text-h3 font-semibold text-ink">Revenue by category</h3>
              <p className="mb-3 text-label text-muted">Share of {formatCurrency(catTotal, { whole: true })}</p>
              {perf.categories.length ? (
                <ul className="space-y-2.5" aria-label="Revenue by category">
                  {perf.categories.slice(0, 7).map((c) => (
                    <li key={c.category}>
                      <div className="mb-1 flex items-baseline justify-between gap-3 text-body-sm">
                        <span className="truncate text-ink-2">{c.category}</span>
                        <span className="shrink-0 font-mono text-[12px] text-ink">
                          {formatCurrency(c.value, { whole: true })}
                          <span className="ml-1.5 text-faint">{catTotal ? Math.round((c.value / catTotal) * 100) : 0}%</span>
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-sunken">
                        <div className="h-full rounded-full" style={{ width: `${(c.value / maxCat) * 100}%`, background: CHART_COLORS[0] }} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState compact icon={<ReceiptText />} title="No sales in this range" description="Pick a longer range to compare categories." />
              )}
            </div>
          </div>
        </Sheet>
      </section>

      {/* G · Activity  +  H · Locations */}
      <div className="mt-section grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Sheet className="overflow-clip">
          <SheetHeader
            title="Recent activity"
            actions={
              <ButtonLink href="/stock?tab=history" variant="ghost" size="sm">
                Stock history <ArrowRight />
              </ButtonLink>
            }
          />
          {state.activities.length ? (
            <ol className="divide-y divide-line">
              {state.activities.slice(0, 8).map((a) => {
                const Icon = ACTIVITY_ICON[a.type] ?? Settings;
                const row = (
                  <>
                    <Icon className="size-4 shrink-0 text-muted" aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-body-sm">
                      <span className="font-medium text-ink">{a.title}</span>
                      <span className="text-muted"> · {a.description}</span>
                    </span>
                    {a.reference && <Code className="hidden shrink-0 text-ink-2 sm:inline">{a.reference}</Code>}
                    <time className="w-16 shrink-0 text-right text-label text-faint" dateTime={a.date} title={formatDateTime(a.date)}>
                      {timeAgo(a.date)}
                    </time>
                  </>
                );
                return (
                  <li key={a.id}>
                    {a.href ? (
                      <Link href={a.href} className="flex h-10 items-center gap-3 px-4 transition-colors duration-[80ms] hover:bg-row-hover focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand md:px-5">
                        {row}
                      </Link>
                    ) : (
                      <div className="flex h-10 items-center gap-3 px-4 md:px-5">{row}</div>
                    )}
                  </li>
                );
              })}
            </ol>
          ) : (
            <EmptyState compact icon={<ReceiptText />} title="No activity yet" description="Sales, purchases and stock changes will appear here." />
          )}
        </Sheet>

        <Sheet className="overflow-clip">
          <SheetHeader title="Locations" description={`${formatCurrency(stockKpis.stockValue, { whole: true })} stock at cost`} />
          <ul className="divide-y divide-line">
            {locations.map((w) => {
              const share = stockKpis.totalUnits ? Math.round((w.units / stockKpis.totalUnits) * 100) : 0;
              return (
                <li key={w.id}>
                  <Link
                    href={`/stock?warehouse=${encodeURIComponent(w.id)}`}
                    className="block px-4 py-3 transition-colors duration-[80ms] hover:bg-row-hover focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand md:px-5"
                  >
                    <div className="flex items-center gap-2.5">
                      <LocationTag code={w.code} />
                      <span className="min-w-0 flex-1 truncate text-body-sm font-medium text-ink">{w.name}</span>
                      <span className="font-mono text-[12px] text-ink-2">{formatCurrency(w.value, { whole: true })}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-3">
                      <div className="h-1.5 flex-1 rounded-full bg-sunken">
                        <div className="h-full rounded-full bg-ink-2" style={{ width: `${share}%` }} />
                      </div>
                      <span className="w-36 shrink-0 text-right text-label text-muted">
                        <span className="font-mono">{formatNumber(w.units)}</span> units · <span className="font-mono">{w.skus}</span> SKUs
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Sheet>
      </div>

      <AdjustStockDialog open={adjustOpen} onClose={() => setAdjustOpen(false)} />
      <TransferDialog open={transferOpen} onClose={() => setTransferOpen(false)} />
    </>
  );
}

function BriefLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-medium text-ink underline decoration-line-hover decoration-1 underline-offset-[3px] transition-colors duration-[80ms] hover:decoration-ink focus-visible:outline-2 focus-visible:outline-brand">
      {children}
    </Link>
  );
}

const ACTIVITY_ICON: Record<ActivityType, LucideIcon> = {
  sale_created: ReceiptText,
  sale_completed: CheckCircle2,
  sale_cancelled: Ban,
  payment_recorded: CircleDollarSign,
  purchase_created: ShoppingCart,
  purchase_received: PackageCheck,
  purchase_cancelled: Ban,
  product_added: PackagePlus,
  product_updated: Pencil,
  product_deleted: PackageX,
  stock_adjusted: SlidersHorizontal,
  transfer_created: ArrowLeftRight,
  transfer_completed: ArrowLeftRight,
  transfer_cancelled: ArrowLeftRight,
  customer_added: UserPlus,
  supplier_added: Building2,
  settings_updated: Settings,
};
