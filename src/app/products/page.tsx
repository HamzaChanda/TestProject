"use client";

import { useNavigate } from "@/hooks/useNavigate";
import { useMemo, useState } from "react";
import Link from "next/link";

import { Download, Eye, MoreHorizontal, Package, PackagePlus, Pencil, ShoppingCart, SlidersHorizontal, Trash2 } from "lucide-react";
import type { Product } from "@/types";
import { useInventory } from "@/context/InventoryContext";
import { productDeleteBlocker } from "@/lib/inventory";
import { productStatus, stockValue, totalStock } from "@/lib/calc";
import { CATEGORIES } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";
import { downloadCsv } from "@/lib/csv";
import { Card } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { Dropdown } from "@/components/ui/Dropdown";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState, FilterSelect, PageHeader, ProductThumb, SearchInput, Toolbar } from "@/components/ui/Primitives";
import { AdjustStockDialog } from "@/components/inventory/AdjustStockDialog";

export default function ProductsPage() {
  const { state, actions } = useInventory();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [toDelete, setToDelete] = useState<Product | null>(null);
  const [adjustFor, setAdjustFor] = useState<string | null>(null);

  const categories = useMemo(() => [...new Set([...CATEGORIES, ...state.products.map((p) => p.category)])], [state.products]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.products.filter(
      (p) =>
        (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)) &&
        (category === "all" || p.category === category) &&
        (status === "all" || productStatus(p) === status),
    );
  }, [state.products, query, category, status]);

  const supplierName = (id: string | null) => state.suppliers.find((s) => s.id === id)?.name ?? "—";

  const columns: Column<Product>[] = [
    {
      key: "product",
      header: "Product",
      sortValue: (p) => p.name,
      cell: (p) => (
        <Link href={`/products/${p.id}`} className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
          <ProductThumb name={p.name} category={p.category} />
          <span className="min-w-0">
            <span className="block max-w-[240px] truncate font-medium text-ink hover:text-brand">{p.name}</span>
            <span className="block max-w-[240px] truncate text-label text-muted">{supplierName(p.supplierId)}</span>
          </span>
        </Link>
      ),
    },
    { key: "sku", header: "SKU", sortValue: (p) => p.sku, cell: (p) => <span className="font-mono text-label text-ink-2">{p.sku}</span> },
    { key: "category", hideBelow: "laptop", header: "Category", sortValue: (p) => p.category, cell: (p) => p.category },
    { key: "unit", hideBelow: "desktop", header: "Unit", cell: (p) => <span className="text-muted">{p.unit}</span>, hideOnMobile: true },
    { key: "sell", header: "Selling price", align: "right", sortValue: (p) => p.sellingPrice, cell: (p) => <span className="font-medium text-ink tabular">{formatCurrency(p.sellingPrice)}</span> },
    { key: "cost", hideBelow: "desktop", header: "Cost price", align: "right", sortValue: (p) => p.costPrice, cell: (p) => <span className="tabular">{formatCurrency(p.costPrice)}</span> },
    {
      key: "stock",
      header: "Available",
      align: "right",
      sortValue: (p) => totalStock(p),
      cell: (p) => (
        <span className="tabular">
          <span className="font-semibold text-ink">{totalStock(p)}</span> <span className="text-label text-muted">{p.unit}</span>
        </span>
      ),
    },
    { key: "status", header: "Status", sortValue: (p) => productStatus(p), cell: (p) => <StatusBadge status={productStatus(p)} /> },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (p) => (
        <div onClick={(e) => e.stopPropagation()} className="flex justify-end">
          <Dropdown
            width={210}
            items={[
              { label: "View details", icon: <Eye />, href: `/products/${p.id}` },
              { label: "Edit product", icon: <Pencil />, href: `/products/${p.id}/edit` },
              { label: "Adjust stock", icon: <SlidersHorizontal />, onSelect: () => setAdjustFor(p.id) },
              { label: "Create purchase order", icon: <ShoppingCart />, href: `/purchases/new?product=${p.id}` },
              { label: "Delete product", icon: <Trash2 />, danger: true, separatorBefore: true, onSelect: () => setToDelete(p) },
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

  const exportCsv = () =>
    downloadCsv(
      `products-${formatDate(new Date(), "yyyy-MM-dd")}`,
      filtered.map((p) => ({
        Name: p.name,
        SKU: p.sku,
        Category: p.category,
        Unit: p.unit,
        "Selling Price": p.sellingPrice,
        "Cost Price": p.costPrice,
        "Available Stock": totalStock(p),
        "Min Stock": p.minStock,
        "Stock Value": stockValue(p),
        Status: productStatus(p),
        Supplier: supplierName(p.supplierId),
      })),
    );

  const filtersActive = query || category !== "all" || status !== "all";

  return (
    <>
      <PageHeader
        title="Products"
        description={`${state.products.length} products in your catalogue`}
        actions={
          <>
            <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={exportCsv} disabled={!filtered.length}>
              Export
            </Button>
            <ButtonLink href="/products/new" icon={<PackagePlus className="h-4 w-4" />}>
              Add product
            </ButtonLink>
          </>
        }
      />
      <Card className="overflow-hidden">
        <Toolbar>
          <SearchInput value={query} onChange={setQuery} placeholder="Search name, SKU or description" className="sm:w-[300px]" />
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <FilterSelect label="Category" value={category} onChange={setCategory} options={[{ value: "all", label: "All categories" }, ...categories.map((c) => ({ value: c, label: c }))]} />
            <FilterSelect
              label="Stock status"
              value={status}
              onChange={setStatus}
              options={[
                { value: "all", label: "All statuses" },
                { value: "In Stock", label: "In stock" },
                { value: "Low Stock", label: "Low stock" },
                { value: "Out of Stock", label: "Out of stock" },
              ]}
            />
          </div>
          {filtersActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuery("");
                setCategory("all");
                setStatus("all");
              }}
            >
              Clear filters
            </Button>
          )}
          <span className="text-label text-muted sm:ml-auto">
            {filtered.length} of {state.products.length}
          </span>
        </Toolbar>
        <DataTable
          rows={filtered}
          columns={columns}
          rowKey={(p) => p.id}
          onRowClick={(p) => navigate(`/products/${p.id}`)}
          resetKey={`${query}|${category}|${status}`}
          mobileTrailing="status"
          initialSort={{ key: "product", dir: "asc" }}
          empty={
            state.products.length === 0 ? (
              <EmptyState icon={<Package />} title="No products yet" description="Add your first product to start tracking stock." action={<ButtonLink href="/products/new">Add product</ButtonLink>} />
            ) : (
              <EmptyState icon={<Package />} title="No products match your filters" description="Try a different search term or clear the filters." />
            )
          }
        />
      </Card>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        blockedReason={toDelete ? productDeleteBlocker(state, toDelete.id) : null}
        title={`Delete ${toDelete?.name}?`}
        description={
          <>
            This removes the product from your catalogue. Past invoices and stock history keep their records.
            {toDelete && totalStock(toDelete) > 0 && (
              <span className="mt-2 block font-medium text-danger">
                {totalStock(toDelete)} {toDelete.unit} still in stock ({formatCurrency(stockValue(toDelete))}) will be written off.
              </span>
            )}
          </>
        }
        confirmLabel="Delete product"
        onConfirm={() => (toDelete ? actions.deleteProduct(toDelete.id) !== null : false)}
      />
      <AdjustStockDialog open={!!adjustFor} productId={adjustFor ?? undefined} onClose={() => setAdjustFor(null)} />
    </>
  );
}
