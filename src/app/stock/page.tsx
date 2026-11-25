"use client";

import { useNavigate } from "@/hooks/useNavigate";
import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeftRight, Boxes, Download, Eye, History, MoreHorizontal, PackageX, ShoppingCart, SlidersHorizontal, Wallet } from "lucide-react";
import type { MovementType, Product } from "@/types";
import { useInventory } from "@/context/InventoryContext";
import { productStatus, stockValue, totalStock } from "@/lib/calc";
import { getLastStockUpdate, getStockSummary, inRange, rangeFromPreset, RANGE_PRESETS, type RangePreset } from "@/lib/selectors";
import { cn, formatCurrency, formatDate, formatNumber, timeAgo } from "@/lib/utils";
import { downloadCsv } from "@/lib/csv";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { Dropdown } from "@/components/ui/Dropdown";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState, FilterSelect, PageHeader, ProductThumb, SearchInput, Segmented, StatCard, Toolbar } from "@/components/ui/Primitives";
import { MovementsTable } from "@/components/inventory/MovementsTable";
import { AdjustStockDialog } from "@/components/inventory/AdjustStockDialog";
import { TransferDialog } from "@/components/inventory/TransferDialog";

const MOVEMENT_TYPES: MovementType[] = ["Purchase", "Sale", "Sale Cancellation", "Adjustment", "Transfer", "Opening"];

function StockPageInner() {
  const { state } = useInventory();
  const navigate = useNavigate();
  const params = useSearchParams();
  const [tab, setTab] = useState<"inventory" | "history">(params.get("tab") === "history" ? "history" : "inventory");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState(params.get("status") ?? "all");
  const [warehouse, setWarehouse] = useState("all");
  const [type, setType] = useState("all");
  const [period, setPeriod] = useState<RangePreset | "all">("all");
  const [adjust, setAdjust] = useState<{ open: boolean; productId?: string }>({ open: false });
  const [transfer, setTransfer] = useState<{ open: boolean; productId?: string }>({ open: false });

  const summary = useMemo(() => getStockSummary(state), [state]);
  const categories = useMemo(() => [...new Set(state.products.map((p) => p.category))].sort(), [state.products]);

  const qtyIn = (p: Product) => (warehouse === "all" ? totalStock(p) : p.stock[warehouse] ?? 0);

  const products = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.products.filter((p) => {
      const st = productStatus(p);
      return (
        (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)) &&
        (category === "all" || p.category === category) &&
        (status === "all" || (status === "attention" ? st !== "In Stock" : st === status))
      );
    });
  }, [state.products, query, category, status]);

  const movements = useMemo(() => {
    const q = query.trim().toLowerCase();
    const range = period === "all" ? null : rangeFromPreset(period);
    return state.movements.filter(
      (m) =>
        (!q || m.productName.toLowerCase().includes(q) || m.sku.toLowerCase().includes(q) || m.reference.toLowerCase().includes(q)) &&
        (type === "all" || m.type === type) &&
        (warehouse === "all" || m.warehouseId === warehouse) &&
        (!range || inRange(m.date, range)),
    );
  }, [state.movements, query, type, warehouse, period]);

  const columns: Column<Product>[] = [
    {
      key: "product",
      header: "Product",
      sortValue: (p) => p.name,
      cell: (p) => (
        <Link href={`/products/${p.id}`} className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
          <ProductThumb name={p.name} category={p.category} size={32} />
          <span className="block max-w-[220px] truncate font-medium text-ink hover:text-brand">{p.name}</span>
        </Link>
      ),
    },
    { key: "sku", header: "SKU", sortValue: (p) => p.sku, cell: (p) => <span className="font-mono text-small">{p.sku}</span> },
    { key: "category", header: "Category", sortValue: (p) => p.category, cell: (p) => p.category, hideOnMobile: true, hideBelow: "wide" },
    ...state.warehouses.map(
      (w): Column<Product> => ({
        key: `wh-${w.id}`,
        hideBelow: "laptop",
        header: w.name.replace(" Warehouse", ""),
        mobileLabel: w.name,
        align: "right",
        sortValue: (p) => p.stock[w.id] ?? 0,
        cell: (p) => <span className={cn("tabular", warehouse !== "all" && warehouse !== w.id && "text-faint")}>{p.stock[w.id] ?? 0}</span>,
      }),
    ),
    {
      key: "current",
      header: "Current stock",
      align: "right",
      sortValue: (p) => qtyIn(p),
      cell: (p) => (
        <span className="font-semibold text-ink tabular">
          {qtyIn(p)} <span className="text-small font-normal text-muted">{p.unit}</span>
        </span>
      ),
    },
    { key: "min", hideBelow: "desktop", header: "Min. level", align: "right", sortValue: (p) => p.minStock, cell: (p) => <span className="tabular">{p.minStock}</span> },
    { key: "status", header: "Status", sortValue: (p) => productStatus(p), cell: (p) => <StatusBadge status={productStatus(p)} /> },
    {
      key: "updated", hideBelow: "desktop",
      header: "Last updated",
      sortValue: (p) => getLastStockUpdate(state, p.id) ?? "",
      hideOnMobile: true,
      cell: (p) => {
        const d = getLastStockUpdate(state, p.id);
        return <span className="text-muted" title={d ? formatDate(d) : undefined}>{d ? timeAgo(d) : "—"}</span>;
      },
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (p) => (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <Dropdown
            width={200}
            items={[
              { label: "Adjust stock", icon: <SlidersHorizontal />, onSelect: () => setAdjust({ open: true, productId: p.id }) },
              { label: "Transfer stock", icon: <ArrowLeftRight />, onSelect: () => setTransfer({ open: true, productId: p.id }) },
              { label: "Create purchase order", icon: <ShoppingCart />, href: `/purchases/new?product=${p.id}` },
              { label: "View product", icon: <Eye />, href: `/products/${p.id}`, separatorBefore: true },
            ]}
            trigger={({ toggle }) => (
              <Button size="icon-sm" variant="ghost" onClick={toggle} aria-label={`Stock actions for ${p.name}`}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            )}
          />
        </div>
      ),
    },
  ];

  const exportCsv = () => {
    if (tab === "inventory") {
      downloadCsv(
        `stock-${formatDate(new Date(), "yyyy-MM-dd")}`,
        products.map((p) => ({
          Product: p.name,
          SKU: p.sku,
          Category: p.category,
          ...Object.fromEntries(state.warehouses.map((w) => [w.name, p.stock[w.id] ?? 0])),
          "Total Stock": totalStock(p),
          "Min Level": p.minStock,
          Status: productStatus(p),
          "Stock Value": stockValue(p),
          "Last Updated": formatDate(getLastStockUpdate(state, p.id)),
        })),
      );
    } else {
      downloadCsv(
        `stock-history-${formatDate(new Date(), "yyyy-MM-dd")}`,
        movements.map((m) => ({
          Date: formatDate(m.date, "yyyy-MM-dd HH:mm"),
          Product: m.productName,
          SKU: m.sku,
          Warehouse: state.warehouses.find((w) => w.id === m.warehouseId)?.name ?? "",
          Type: m.type,
          Reference: m.reference,
          Change: m.quantity,
          "Previous Stock": m.previousStock,
          "New Stock": m.newStock,
          Note: m.note,
        })),
      );
    }
  };

  return (
    <>
      <PageHeader
        title="Stock"
        description="Live quantities across warehouses, with a complete movement history."
        actions={
          <>
            <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={exportCsv}>
              Export
            </Button>
            <Button variant="secondary" icon={<ArrowLeftRight className="h-4 w-4" />} onClick={() => setTransfer({ open: true })}>
              Transfer
            </Button>
            <Button icon={<SlidersHorizontal className="h-4 w-4" />} onClick={() => setAdjust({ open: true })}>
              Adjust stock
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Total stock units" value={formatNumber(summary.units)} icon={<Boxes />} accent="brand" hint={`Across ${state.warehouses.length} warehouses`} />
        <StatCard label="Stock value" value={formatCurrency(summary.value, { whole: true })} icon={<Wallet />} accent="info" hint={`Retail value ${formatCurrency(summary.retailValue)}`} />
        <StatCard
          label="Low stock"
          value={summary.low}
          icon={<AlertTriangle />}
          accent="warning"
          hint="At or below minimum level"
          onClick={() => {
            setTab("inventory");
            setStatus("Low Stock");
          }}
        />
        <StatCard
          label="Out of stock"
          value={summary.out}
          icon={<PackageX />}
          accent="danger"
          hint="Cannot be sold"
          onClick={() => {
            setTab("inventory");
            setStatus("Out of Stock");
          }}
        />
      </div>

      <Card className="mt-5 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 md:px-5">
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: "inventory", label: <><Boxes className="h-3.5 w-3.5" /> Inventory</>, count: products.length },
              { value: "history", label: <><History className="h-3.5 w-3.5" /> Stock history</>, count: movements.length },
            ]}
          />
        </div>
        <Toolbar>
          <SearchInput value={query} onChange={setQuery} placeholder={tab === "inventory" ? "Search product or SKU" : "Search product, SKU or reference"} />
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <FilterSelect
              label="Warehouse"
              value={warehouse}
              onChange={setWarehouse}
              options={[{ value: "all", label: "All warehouses" }, ...state.warehouses.map((w) => ({ value: w.id, label: w.name }))]}
            />
            {tab === "inventory" ? (
              <>
                <FilterSelect label="Category" value={category} onChange={setCategory} options={[{ value: "all", label: "All categories" }, ...categories.map((c) => ({ value: c, label: c }))]} />
                <FilterSelect
                  label="Status"
                  value={status}
                  onChange={setStatus}
                  options={[
                    { value: "all", label: "All statuses" },
                    { value: "attention", label: "Needs attention" },
                    { value: "In Stock", label: "In stock" },
                    { value: "Low Stock", label: "Low stock" },
                    { value: "Out of Stock", label: "Out of stock" },
                  ]}
                />
              </>
            ) : (
              <>
                <FilterSelect label="Type" value={type} onChange={setType} options={[{ value: "all", label: "All types" }, ...MOVEMENT_TYPES.map((t) => ({ value: t, label: t }))]} />
                <FilterSelect
                  label="Period"
                  value={period}
                  onChange={(v) => setPeriod(v as RangePreset | "all")}
                  options={[{ value: "all", label: "Any time" }, ...RANGE_PRESETS.filter((r) => r.value !== "all")]}
                />
              </>
            )}
          </div>
        </Toolbar>
        {tab === "inventory" ? (
          <DataTable
            rows={products}
            columns={columns}
            rowKey={(p) => p.id}
            onRowClick={(p) => navigate(`/products/${p.id}`)}
            resetKey={`${query}|${category}|${status}|${warehouse}`}
            mobileTrailing="status"
            rowClassName={(p) => (productStatus(p) === "Out of Stock" ? "bg-row-danger" : productStatus(p) === "Low Stock" ? "bg-row-warning" : undefined)}
            initialSort={{ key: "current", dir: "asc" }}
            empty={<EmptyState icon={<Boxes />} title="No products match" description="Adjust your search or filters to see stock levels." />}
          />
        ) : (
          <MovementsTable state={state} movements={movements} resetKey={`${query}|${type}|${warehouse}|${period}`} />
        )}
      </Card>

      <AdjustStockDialog open={adjust.open} productId={adjust.productId} onClose={() => setAdjust({ open: false })} />
      <TransferDialog open={transfer.open} productId={transfer.productId} onClose={() => setTransfer({ open: false })} />
    </>
  );
}

export default function StockPage() {
  return (
    <Suspense>
      <StockPageInner />
    </Suspense>
  );
}
