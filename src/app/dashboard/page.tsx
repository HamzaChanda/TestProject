"use client";

import { useNavigate } from "@/hooks/useNavigate";
import { useMemo, useState } from "react";
import Link from "next/link";

import {
  AlertTriangle,
  Banknote,
  ArrowLeftRight,
  ArrowRight,
  Download,
  Eye,
  IndianRupee,
  MoreHorizontal,
  Package,
  PackageCheck,
  Plus,
  ReceiptText,
  ShoppingCart,
  SlidersHorizontal,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useInventory } from "@/context/InventoryContext";
import {
  RANGE_PRESETS,
  getCategoryDistribution,
  getDashboardKpis,
  getLowStockProducts,
  getMonthlySeries,
  getReplenishment,
  rangeFromPreset,
  type RangePreset,
} from "@/lib/selectors";
import { productStatus, totalStock } from "@/lib/calc";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import { downloadCsv } from "@/lib/csv";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { Dropdown } from "@/components/ui/Dropdown";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState, FilterSelect, PageHeader, ProductThumb, Segmented, StatCard, StockBar } from "@/components/ui/Primitives";
import { DonutChart, SalesPurchasesChart } from "@/components/charts/Charts";
import { ActivityFeed } from "@/components/inventory/ActivityFeed";
import { AdjustStockDialog } from "@/components/inventory/AdjustStockDialog";
import { TransferDialog } from "@/components/inventory/TransferDialog";
import type { Product } from "@/types";

export default function DashboardPage() {
  const { state } = useInventory();
  const navigate = useNavigate();
  const MoneyIcon = state.settings.currency === "INR" ? IndianRupee : Banknote;
  const [preset, setPreset] = useState<RangePreset>("month");
  const [metric, setMetric] = useState<"value" | "units">("value");
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  const range = useMemo(() => rangeFromPreset(preset), [preset]);
  const rangeLabel = RANGE_PRESETS.find((r) => r.value === preset)!.label;
  const kpis = useMemo(() => getDashboardKpis(state, range), [state, range]);
  const monthly = useMemo(() => getMonthlySeries(state, 6), [state]);
  const distribution = useMemo(() => getCategoryDistribution(state, metric), [state, metric]);
  const lowStock = useMemo(() => getLowStockProducts(state), [state]);
  const sixMonthSales = monthly.reduce((s, m) => s + m.sales, 0);
  const sixMonthPurchases = monthly.reduce((s, m) => s + m.purchases, 0);

  const exportReport = () => {
    downloadCsv(`stockflow-dashboard-${formatDate(new Date(), "yyyy-MM-dd")}`, [
      { Section: "KPI", Metric: "Total products", Value: kpis.totalProducts, Period: "Current" },
      { Section: "KPI", Metric: "Stock value (cost)", Value: kpis.stockValue, Period: "Current" },
      { Section: "KPI", Metric: "Total sales", Value: kpis.totalSales, Period: rangeLabel },
      { Section: "KPI", Metric: "Invoices", Value: kpis.salesCount, Period: rangeLabel },
      { Section: "KPI", Metric: "Low / out of stock items", Value: kpis.lowStock, Period: "Current" },
      ...monthly.map((m) => ({ Section: "Monthly", Metric: `Sales ${m.fullLabel}`, Value: m.sales, Period: m.fullLabel })),
      ...monthly.map((m) => ({ Section: "Monthly", Metric: `Purchases ${m.fullLabel}`, Value: m.purchases, Period: m.fullLabel })),
      ...lowStock.map((p) => ({ Section: "Low stock", Metric: `${p.name} (${p.sku})`, Value: totalStock(p), Period: `Min ${p.minStock}` })),
    ]);
  };

  // Replenishment advice per low-stock product (cover days, suggested order quantity).
  const adviceById = useMemo(() => new Map(lowStock.map((p) => [p.id, getReplenishment(state, p)])), [lowStock, state]);
  const advice = (p: Product) => adviceById.get(p.id) ?? getReplenishment(state, p);
  const reorderHref = (p: Product) => `/purchases/new?product=${p.id}${advice(p).suggestedQty > 0 ? `&qty=${advice(p).suggestedQty}` : ""}`;

  const lowColumns: Column<Product>[] = [
    {
      key: "product",
      header: "Product",
      sortValue: (p) => p.name,
      cell: (p) => (
        <Link href={`/products/${p.id}`} className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
          <ProductThumb name={p.name} category={p.category} size={32} />
          <span className="min-w-0">
            <span className="block truncate font-medium text-ink hover:text-brand">{p.name}</span>
            <span className="block text-caption text-muted">
              <span className="font-mono">{p.sku}</span>
              <CoverHint days={advice(p).daysOfCover} qty={totalStock(p)} />
            </span>
          </span>
        </Link>
      ),
    },
    {
      key: "qty",
      header: "On hand / min",
      align: "right",
      sortValue: (p) => totalStock(p),
      cell: (p) => (
        <div className="ml-auto w-[104px]">
          <div className="mb-1 text-right tabular">
            <span className="font-semibold text-ink">{totalStock(p)}</span>
            <span className="text-small text-muted"> / {p.minStock}</span>
          </div>
          <StockBar qty={totalStock(p)} min={p.minStock} />
        </div>
      ),
    },
    {
      key: "suggest",
      header: "Suggested",
      align: "right",
      sortValue: (p) => advice(p).suggestedQty,
      cell: (p) => {
        const a = advice(p);
        return a.suggestedQty > 0 ? (
          <span className="font-semibold text-ink tabular" title={`Restores stock to ${a.targetLevel} (minimum + 30 days of demand), after ${a.incoming} already on order`}>
            {a.suggestedQty}
          </span>
        ) : (
          <span className="text-caption text-success" title={a.incoming ? `${a.incoming} already on order` : undefined}>
            {a.incoming ? `+${a.incoming} on order` : "Covered"}
          </span>
        );
      },
    },
    { key: "status", header: "Status", cell: (p) => <StatusBadge status={productStatus(p)} /> },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (p) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {advice(p).suggestedQty > 0 && (
            <span className="hidden 2xl:inline-flex">
              <ButtonLink href={reorderHref(p)} size="xs" variant="subtle" icon={<ShoppingCart className="h-3.5 w-3.5" />}>
                Order {advice(p).suggestedQty}
              </ButtonLink>
            </span>
          )}
          <Dropdown
            width={200}
            items={[
              { label: "View product", icon: <Eye />, href: `/products/${p.id}` },
              {
                label: advice(p).suggestedQty > 0 ? `Order ${advice(p).suggestedQty} units` : "Create purchase order",
                icon: <ShoppingCart />,
                href: reorderHref(p),
              },
            ]}
            trigger={({ toggle }) => (
              <Button size="icon-sm" variant="ghost" onClick={toggle} aria-label={`Actions for ${p.name}`}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            )}
          />
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Here's what's happening with your inventory today."
        actions={
          <>
            <FilterSelect label="Date range" value={preset} onChange={(v) => setPreset(v as RangePreset)} options={RANGE_PRESETS} className="min-w-[150px]" />
            <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={exportReport}>
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
              trigger={({ toggle }) => (
                <Button icon={<Plus className="h-4 w-4" />} onClick={toggle}>
                  Add transaction
                </Button>
              )}
            />
          </>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Products"
          value={formatNumber(kpis.totalProducts)}
          icon={<Package />}
          accent="brand"
          hint={`Active products · ${formatNumber(kpis.totalUnits)} units on hand`}
          onClick={() => navigate("/products")}
        />
        <StatCard
          label="Total Stock Value"
          value={formatCurrency(kpis.stockValue, { whole: true })}
          icon={<Wallet />}
          accent="info"
          trend={kpis.stockValueTrend}
          trendLabel={`vs start of ${rangeLabel.toLowerCase()}`}
          hint="Current inventory valuation at cost"
          onClick={() => navigate("/stock")}
        />
        <StatCard
          label="Total Sales"
          value={formatCurrency(kpis.totalSales, { whole: true })}
          icon={<MoneyIcon />}
          accent="success"
          trend={kpis.salesTrend}
          trendLabel="vs previous period"
          hint={`${rangeLabel} · ${kpis.salesCount} invoice${kpis.salesCount === 1 ? "" : "s"}`}
          onClick={() => navigate("/sales")}
        />
        <StatCard
          label="Low Stock Items"
          value={formatNumber(kpis.lowStock)}
          icon={<AlertTriangle />}
          accent={kpis.lowStock ? "warning" : "success"}
          hint={kpis.outOfStock ? `Need attention · ${kpis.outOfStock} out of stock` : "Products requiring attention"}
          onClick={() => navigate("/stock?status=attention")}
        />
      </div>

      {/* Charts */}
      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="Sales overview"
            description="Monthly sales vs purchase orders, last 6 months"
            icon={<TrendingUp className="h-4 w-4" />}
            actions={
              <div className="hidden text-right sm:block">
                <div className="text-caption text-muted">6-month sales</div>
                <div className="text-title-sm font-semibold text-ink tabular">{formatCurrency(sixMonthSales, { whole: true })}</div>
              </div>
            }
          />
          <CardBody>
            <SalesPurchasesChart data={monthly} />
            <div className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3 text-small sm:grid-cols-3">
              <div>
                <div className="text-muted">Purchases</div>
                <div className="font-semibold text-ink tabular">{formatCurrency(sixMonthPurchases, { whole: true })}</div>
              </div>
              <div>
                <div className="text-muted">Best month</div>
                <div className="font-semibold text-ink">
                  {[...monthly].sort((a, b) => b.sales - a.sales)[0]?.fullLabel ?? "—"}
                </div>
              </div>
              <div className="hidden sm:block">
                <div className="text-muted">Avg. invoice</div>
                <div className="font-semibold text-ink tabular">
                  {formatCurrency(sixMonthSales / Math.max(1, monthly.reduce((s, m) => s + m.orders, 0)), { whole: true })}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            title="Inventory distribution"
            description={metric === "value" ? "Stock value by category" : "Units on hand by category"}
            actions={
              <Segmented
                size="sm"
                value={metric}
                onChange={setMetric}
                options={[
                  { value: "value", label: "Value" },
                  { value: "units", label: "Units" },
                ]}
              />
            }
          />
          <CardBody>
            {distribution.length ? (
              <DonutChart
                format={metric === "value" ? "currency" : "number"}
                centerLabel={metric === "value" ? "Total value" : "Total units"}
                data={distribution.map((d) => ({
                  name: d.category,
                  value: metric === "value" ? d.value : d.units,
                  sub: `${d.products}`,
                }))}
              />
            ) : (
              <EmptyState compact icon={<Package />} title="No products yet" description="Add products to see distribution." />
            )}
          </CardBody>
        </Card>
      </div>

      {/* Alerts + activity. The actionable table gets the room: side-by-side with a slim
          activity column on wide screens, full width (activity below) on smaller ones. */}
      <div className="mt-5 grid grid-cols-1 gap-5 min-[1380px]:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="overflow-hidden">
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                Low stock alerts
                {lowStock.length > 0 && <span className="rounded-md bg-warning-bg px-1.5 py-px text-caption font-semibold text-warning tabular">{lowStock.length}</span>}
              </span>
            }
            description="Products at or below their minimum stock level"
            actions={
              <ButtonLink href="/stock?status=attention" variant="ghost" size="sm">
                View all <ArrowRight className="h-3.5 w-3.5" />
              </ButtonLink>
            }
          />
          <DataTable
            minWidth={480}
            rows={lowStock}
            columns={lowColumns}
            rowKey={(p) => p.id}
            pageSize={6}
            onRowClick={(p) => navigate(`/products/${p.id}`)}
            rowClassName={(p) => (productStatus(p) === "Out of Stock" ? "bg-row-danger" : "bg-row-warning")}
            mobileTrailing="status"
            empty={
              <EmptyState
                icon={<PackageCheck />}
                title="All stock levels are healthy"
                description="No product is at or below its minimum level. Nice work."
              />
            }
          />
        </Card>
        <Card>
          <CardHeader
            title="Recent activity"
            description="Latest transactions across your business"
            actions={
              <ButtonLink href="/stock?tab=history" variant="ghost" size="sm">
                History <ArrowRight className="h-3.5 w-3.5" />
              </ButtonLink>
            }
          />
          <CardBody className="pt-1">
            {state.activities.length ? (
              <ActivityFeed activities={state.activities.slice(0, 6)} />
            ) : (
              <EmptyState compact icon={<ReceiptText />} title="No activity yet" description="Sales, purchases and stock changes will appear here." />
            )}
          </CardBody>
        </Card>
      </div>

      <AdjustStockDialog open={adjustOpen} onClose={() => setAdjustOpen(false)} />
      <TransferDialog open={transferOpen} onClose={() => setTransferOpen(false)} />
    </>
  );
}

/** "· 4 days left" — how long current stock lasts at the 90-day sales rate. */
function CoverHint({ days, qty }: { days: number | null; qty: number }) {
  if (qty <= 0) return <span className="text-danger"> · sold out</span>;
  if (days === null) return <span> · no recent sales</span>;
  return <span className={days <= 7 ? "text-danger" : days <= 21 ? "text-warning" : undefined}> · {days} day{days === 1 ? "" : "s"} left</span>;
}
