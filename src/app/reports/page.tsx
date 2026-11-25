"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { differenceInCalendarDays, eachDayOfInterval, eachMonthOfInterval, eachWeekOfInterval, endOfDay, endOfWeek, format, parseISO, startOfDay, startOfWeek } from "date-fns";
import { AlertTriangle, Boxes, CircleDollarSign, ClipboardList, Download, FileText, PackageCheck, Printer, ReceiptText, ShoppingCart, TrendingUp, Wallet } from "lucide-react";
import { useInventory } from "@/context/InventoryContext";
import { RANGE_PRESETS, getCategoryDistribution, getTopProducts, inRange, isActiveSale, isCommittedPurchase, rangeFromPreset, receivedValue, type DateRange, type RangePreset } from "@/lib/selectors";
import { productStatus, stockValue, totalStock } from "@/lib/calc";
import { CHART_COLORS } from "@/lib/constants";
import { formatCurrency, formatDate, formatNumber, round2 } from "@/lib/utils";
import { downloadCsv } from "@/lib/csv";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState, FilterSelect, PageHeader, Segmented, StatCard } from "@/components/ui/Primitives";
import { DonutChart, RankedBars, TrendBarChart } from "@/components/charts/Charts";
import type { Product, Purchase, Sale } from "@/types";

type Tab = "stock" | "sales" | "purchases";
type Period = RangePreset | "custom";

function bucketize<T>(items: T[], getDate: (t: T) => string, getValue: (t: T) => number, range: DateRange) {
  const days = differenceInCalendarDays(range.to, range.from) + 1;
  const start = range.from.getFullYear() < 2001 && items.length ? startOfDay(parseISO(items.map(getDate).sort()[0])) : range.from;
  const interval = { start, end: range.to };
  let buckets: { key: string; label: string; fullLabel: string; start: Date; end: Date }[];
  if (days <= 31) {
    buckets = eachDayOfInterval(interval).map((d) => ({ key: format(d, "yyyy-MM-dd"), label: format(d, "d MMM"), fullLabel: format(d, "EEE, d MMM yyyy"), start: startOfDay(d), end: endOfDay(d) }));
  } else if (days <= 120) {
    buckets = eachWeekOfInterval(interval, { weekStartsOn: 1 }).map((d) => ({ key: format(d, "yyyy-'W'II"), label: format(d, "d MMM"), fullLabel: `Week of ${format(d, "d MMM yyyy")}`, start: startOfWeek(d, { weekStartsOn: 1 }), end: endOfWeek(d, { weekStartsOn: 1 }) }));
  } else {
    buckets = eachMonthOfInterval(interval).map((d) => ({ key: format(d, "yyyy-MM"), label: format(d, "MMM yy"), fullLabel: format(d, "MMMM yyyy"), start: d, end: endOfDay(new Date(d.getFullYear(), d.getMonth() + 1, 0)) }));
  }
  const out = buckets.map((b) => ({ ...b, value: 0, count: 0 }));
  for (const it of items) {
    const d = parseISO(getDate(it));
    const b = out.find((x) => d >= x.start && d <= x.end);
    if (b) {
      b.value += getValue(it);
      b.count += 1;
    }
  }
  return out.map((b) => ({ label: b.label, fullLabel: b.fullLabel, value: round2(b.value), count: b.count }));
}

export default function ReportsPage() {
  const { state } = useInventory();
  const [tab, setTab] = useState<Tab>("sales");
  const [period, setPeriod] = useState<Period>("6m");
  const [from, setFrom] = useState(format(new Date(Date.now() - 30 * 864e5), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [category, setCategory] = useState("all");

  const range: DateRange = useMemo(
    () => (period === "custom" ? { from: startOfDay(parseISO(from)), to: endOfDay(parseISO(to)) } : rangeFromPreset(period)),
    [period, from, to],
  );
  const rangeLabel = period === "custom" ? `${formatDate(from)} – ${formatDate(to)}` : RANGE_PRESETS.find((r) => r.value === period)!.label;
  const categories = useMemo(() => [...new Set(state.products.map((p) => p.category))].sort(), [state.products]);
  const productCategory = useMemo(() => new Map(state.products.map((p) => [p.id, p.category])), [state.products]);

  /* ----- Stock ----- */
  const stockRows = useMemo(() => state.products.filter((p) => category === "all" || p.category === category), [state.products, category]);
  const stockTotals = useMemo(
    () => ({
      skus: stockRows.length,
      units: stockRows.reduce((s, p) => s + totalStock(p), 0),
      value: round2(stockRows.reduce((s, p) => s + stockValue(p), 0)),
      attention: stockRows.filter((p) => productStatus(p) !== "In Stock").length,
    }),
    [stockRows],
  );

  /* ----- Sales ----- */
  const salesInRange = useMemo(
    () =>
      state.sales.filter(
        (s) => inRange(s.date, range) && (category === "all" || s.items.some((i) => productCategory.get(i.productId) === category)),
      ),
    [state.sales, range, category, productCategory],
  );
  const activeSales = salesInRange.filter(isActiveSale);
  const salesTotals = {
    revenue: round2(activeSales.reduce((s, x) => s + x.total, 0)),
    count: activeSales.length,
    avg: activeSales.length ? activeSales.reduce((s, x) => s + x.total, 0) / activeSales.length : 0,
    outstanding: round2(activeSales.reduce((s, x) => s + (x.total - x.amountPaid), 0)),
    cancelled: salesInRange.length - activeSales.length,
  };
  const salesSeries = useMemo(() => bucketize(activeSales, (s) => s.date, (s) => s.total, range), [activeSales, range]);
  const topProducts = useMemo(() => getTopProducts(state, activeSales, { category }), [state, activeSales, category]);

  /* ----- Purchases ----- */
  const purchasesInRange = useMemo(() => state.purchases.filter((p) => inRange(`${p.orderDate}T12:00:00`, range)), [state.purchases, range]);
  const committed = purchasesInRange.filter(isCommittedPurchase);
  const purchaseTotals = {
    count: purchasesInRange.length,
    ordered: round2(committed.reduce((s, p) => s + p.total, 0)),
    received: round2(purchasesInRange.reduce((s, p) => s + receivedValue(p), 0)),
    open: purchasesInRange.filter((p) => p.status === "Pending" || p.status === "Partially Received").length,
  };
  const bySupplier = useMemo(() => {
    const map = new Map<string, number>();
    committed.forEach((p) => map.set(p.supplierName, (map.get(p.supplierName) ?? 0) + p.total));
    return [...map.entries()].map(([name, value]) => ({ name, value: round2(value) })).sort((a, b) => b.value - a.value);
  }, [committed]);

  /* ----- Columns ----- */
  const stockColumns: Column<Product>[] = [
    { key: "product", header: "Product", sortValue: (p) => p.name, cell: (p) => <Link href={`/products/${p.id}`} className="font-medium text-ink hover:text-brand">{p.name}</Link> },
    { key: "sku", header: "SKU", sortValue: (p) => p.sku, cell: (p) => <span className="font-mono text-[12px]">{p.sku}</span> },
    { key: "category", header: "Category", sortValue: (p) => p.category, cell: (p) => p.category },
    { key: "qty", header: "Current qty", align: "right", sortValue: (p) => totalStock(p), cell: (p) => <span className="font-semibold text-ink tabular">{totalStock(p)}</span> },
    { key: "min", header: "Min qty", align: "right", sortValue: (p) => p.minStock, cell: (p) => <span className="tabular">{p.minStock}</span> },
    { key: "value", header: "Stock value", align: "right", sortValue: (p) => stockValue(p), cell: (p) => <span className="tabular">{formatCurrency(stockValue(p))}</span> },
    { key: "status", header: "Status", sortValue: (p) => productStatus(p), cell: (p) => <StatusBadge status={productStatus(p)} /> },
  ];
  const salesColumns: Column<Sale>[] = [
    { key: "invoice", header: "Invoice", sortValue: (s) => s.invoiceNo, cell: (s) => <Link href={`/sales/${s.id}`} className="font-mono text-[12.5px] font-medium text-ink hover:text-brand">{s.invoiceNo}</Link> },
    { key: "customer", header: "Customer", sortValue: (s) => s.customerName, cell: (s) => s.customerName },
    { key: "date", header: "Date", sortValue: (s) => s.date, cell: (s) => formatDate(s.date) },
    { key: "revenue", header: "Revenue", align: "right", sortValue: (s) => (s.status === "Cancelled" ? 0 : s.total), cell: (s) => <span className={s.status === "Cancelled" ? "text-faint line-through tabular" : "font-semibold text-ink tabular"}>{formatCurrency(s.total)}</span> },
    { key: "payment", header: "Payment", sortValue: (s) => s.paymentStatus, cell: (s) => (s.status === "Cancelled" ? <StatusBadge status="Cancelled" /> : <StatusBadge status={s.paymentStatus} />) },
  ];
  const purchaseColumns: Column<Purchase>[] = [
    { key: "po", header: "Purchase order", sortValue: (p) => p.poNumber, cell: (p) => <Link href={`/purchases/${p.id}`} className="font-mono text-[12.5px] font-medium text-ink hover:text-brand">{p.poNumber}</Link> },
    { key: "supplier", header: "Supplier", sortValue: (p) => p.supplierName, cell: (p) => p.supplierName },
    { key: "date", header: "Date", sortValue: (p) => p.orderDate, cell: (p) => formatDate(p.orderDate) },
    { key: "total", header: "Total amount", align: "right", sortValue: (p) => p.total, cell: (p) => <span className="font-semibold text-ink tabular">{formatCurrency(p.total)}</span> },
    { key: "received", header: "Received amount", align: "right", sortValue: (p) => receivedValue(p), cell: (p) => <span className="text-success tabular">{formatCurrency(receivedValue(p))}</span> },
    { key: "status", header: "Status", sortValue: (p) => p.status, cell: (p) => <StatusBadge status={p.status} /> },
  ];

  const exportCsv = () => {
    const stamp = formatDate(new Date(), "yyyy-MM-dd");
    if (tab === "stock")
      downloadCsv(`stock-report-${stamp}`, stockRows.map((p) => ({ Product: p.name, SKU: p.sku, Category: p.category, "Current Quantity": totalStock(p), "Minimum Quantity": p.minStock, "Stock Value": stockValue(p), "Stock Status": productStatus(p) })));
    else if (tab === "sales")
      downloadCsv(`sales-report-${stamp}`, salesInRange.map((s) => ({ "Invoice Number": s.invoiceNo, Customer: s.customerName, Date: formatDate(s.date, "yyyy-MM-dd"), Revenue: s.status === "Cancelled" ? 0 : s.total, "Payment Status": s.status === "Cancelled" ? "Cancelled" : s.paymentStatus })));
    else
      downloadCsv(`purchase-report-${stamp}`, purchasesInRange.map((p) => ({ "Purchase Order": p.poNumber, Supplier: p.supplierName, Date: p.orderDate, "Total Amount": p.total, "Received Amount": receivedValue(p), Status: p.status })));
  };

  const distribution = getCategoryDistribution(state, "value");

  return (
    <>
      <PageHeader
        title="Reports"
        description={tab === "stock" ? "Inventory position as of today." : `Showing ${rangeLabel.toLowerCase()} · generated ${formatDate(new Date(), "dd MMM yyyy, h:mm a")}`}
        actions={
          <>
            <Button variant="secondary" icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>
              Print
            </Button>
            <Button icon={<Download className="h-4 w-4" />} onClick={exportCsv}>
              Export CSV
            </Button>
          </>
        }
      />

      <div className="no-print mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "sales", label: <><ReceiptText className="h-3.5 w-3.5" /> Sales report</> },
            { value: "purchases", label: <><ShoppingCart className="h-3.5 w-3.5" /> Purchase report</> },
            { value: "stock", label: <><Boxes className="h-3.5 w-3.5" /> Stock report</> },
          ]}
        />
        <div className="flex flex-wrap items-center gap-2">
          {tab !== "stock" && (
            <>
              <FilterSelect label="Date range" value={period} onChange={(v) => setPeriod(v as Period)} options={[...RANGE_PRESETS, { value: "custom", label: "Custom range…" }]} className="min-w-[150px]" />
              {period === "custom" && (
                <div className="flex items-center gap-2">
                  <input type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} className="h-9 rounded-[9px] border border-line-strong bg-surface px-2.5 text-[13px] focus:border-brand focus:outline-none" aria-label="From date" />
                  <span className="text-muted">–</span>
                  <input type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} className="h-9 rounded-[9px] border border-line-strong bg-surface px-2.5 text-[13px] focus:border-brand focus:outline-none" aria-label="To date" />
                </div>
              )}
            </>
          )}
          {tab !== "purchases" && (
            <FilterSelect label="Category" value={category} onChange={setCategory} options={[{ value: "all", label: "All categories" }, ...categories.map((c) => ({ value: c, label: c }))]} />
          )}
        </div>
      </div>

      <div className="print-area">
        {tab === "stock" && (
          <>
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              <StatCard label="Products" value={stockTotals.skus} icon={<Boxes />} accent="brand" hint={category === "all" ? "All categories" : category} />
              <StatCard label="Units on hand" value={formatNumber(stockTotals.units)} icon={<PackageCheck />} accent="success" />
              <StatCard label="Stock value" value={formatCurrency(stockTotals.value, { whole: true })} icon={<Wallet />} accent="info" hint="At cost price" />
              <StatCard label="Needs attention" value={stockTotals.attention} icon={<AlertTriangle />} accent="warning" hint="Low or out of stock" />
            </div>
            <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
              <Card>
                <CardHeader title="Value by category" />
                <CardBody>
                  <DonutChart data={distribution.map((d) => ({ name: d.category, value: d.value }))} centerLabel="Total value" />
                </CardBody>
              </Card>
              <Card className="overflow-hidden">
                <CardHeader title="Stock report" description={`${stockRows.length} products`} />
                <DataTable rows={stockRows} columns={stockColumns} rowKey={(p) => p.id} initialSort={{ key: "value", dir: "desc" }} mobileTrailing="status" pageSize={12} resetKey={category} empty={<EmptyState icon={<Boxes />} title="No products in this category" />} />
              </Card>
            </div>
          </>
        )}

        {tab === "sales" && (
          <>
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              <StatCard label="Revenue" value={formatCurrency(salesTotals.revenue, { whole: true })} icon={<TrendingUp />} accent="success" hint={rangeLabel} />
              <StatCard label="Invoices" value={salesTotals.count} icon={<FileText />} accent="brand" hint={salesTotals.cancelled ? `${salesTotals.cancelled} cancelled excluded` : "None cancelled"} />
              <StatCard label="Average invoice" value={formatCurrency(salesTotals.avg, { whole: true })} icon={<ReceiptText />} accent="info" />
              <StatCard label="Outstanding" value={formatCurrency(salesTotals.outstanding, { whole: true })} icon={<CircleDollarSign />} accent={salesTotals.outstanding ? "danger" : "neutral"} hint="Unpaid balances" />
            </div>
            <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <Card>
                <CardHeader title="Revenue trend" description={`Excludes cancelled invoices · ${rangeLabel}`} />
                <CardBody>{activeSales.length ? <TrendBarChart data={salesSeries} seriesLabel="Revenue" /> : <EmptyState compact icon={<TrendingUp />} title="No sales in this period" />}</CardBody>
              </Card>
              <Card>
                <CardHeader title="Top products" description={category === "all" ? "By revenue" : `By revenue · ${category}`} />
                <CardBody>{topProducts.length ? <RankedBars data={topProducts.map((p) => ({ name: p.name, value: p.value, sub: `${p.units} units` }))} /> : <EmptyState compact icon={<Boxes />} title="No product sales" />}</CardBody>
              </Card>
            </div>
            <Card className="mt-5 overflow-hidden">
              <CardHeader title="Sales report" description={`${salesInRange.length} invoices`} />
              <DataTable rows={salesInRange} columns={salesColumns} rowKey={(s) => s.id} initialSort={{ key: "date", dir: "desc" }} mobilePrimary="customer" mobileTrailing="revenue" pageSize={12} resetKey={`${period}|${from}|${to}|${category}`} empty={<EmptyState icon={<FileText />} title="No invoices in this period" description="Choose a wider date range." />} />
            </Card>
          </>
        )}

        {tab === "purchases" && (
          <>
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              <StatCard label="Purchase orders" value={purchaseTotals.count} icon={<ClipboardList />} accent="brand" hint={rangeLabel} />
              <StatCard label="Ordered value" value={formatCurrency(purchaseTotals.ordered, { whole: true })} icon={<ShoppingCart />} accent="info" hint="Excludes drafts & cancelled" />
              <StatCard label="Received value" value={formatCurrency(purchaseTotals.received, { whole: true })} icon={<PackageCheck />} accent="success" hint="Goods actually received" />
              <StatCard label="Open orders" value={purchaseTotals.open} icon={<AlertTriangle />} accent="warning" hint="Pending or partial" />
            </div>
            <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <Card>
                <CardHeader title="Purchase trend" description={`By order date · ${rangeLabel}`} />
                <CardBody>
                  {committed.length ? (
                    <TrendBarChart data={bucketize(committed, (p) => `${p.orderDate}T12:00:00`, (p) => p.total, range)} seriesLabel="Ordered" color={CHART_COLORS[1]} />
                  ) : (
                    <EmptyState compact icon={<ShoppingCart />} title="No purchases in this period" />
                  )}
                </CardBody>
              </Card>
              <Card>
                <CardHeader title="Spend by supplier" />
                <CardBody>{bySupplier.length ? <RankedBars data={bySupplier} color={CHART_COLORS[1]} /> : <EmptyState compact icon={<ShoppingCart />} title="No supplier spend" />}</CardBody>
              </Card>
            </div>
            <Card className="mt-5 overflow-hidden">
              <CardHeader title="Purchase report" description={`${purchasesInRange.length} purchase orders`} />
              <DataTable rows={purchasesInRange} columns={purchaseColumns} rowKey={(p) => p.id} initialSort={{ key: "date", dir: "desc" }} mobilePrimary="supplier" mobileTrailing="total" pageSize={12} resetKey={`${period}|${from}|${to}`} empty={<EmptyState icon={<ClipboardList />} title="No purchase orders in this period" />} />
            </Card>
          </>
        )}
      </div>
    </>
  );
}
