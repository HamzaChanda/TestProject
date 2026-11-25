"use client";

import { useNavigate } from "@/hooks/useNavigate";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeftRight, Boxes, MoreHorizontal, Pencil, ShoppingCart, SlidersHorizontal, Trash2, TrendingUp, Truck, Wallet } from "lucide-react";
import { useInventory } from "@/context/InventoryContext";
import { productDeleteBlocker } from "@/lib/inventory";
import { productStatus, stockValue, totalStock } from "@/lib/calc";
import { getLastStockUpdate, getProductSalesStats } from "@/lib/selectors";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { Dropdown } from "@/components/ui/Dropdown";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { KeyValue, PageHeader, ProductThumb, StatCard, StockBar } from "@/components/ui/Primitives";
import { NotFoundState } from "@/components/ui/NotFoundState";
import { MovementsTable } from "@/components/inventory/MovementsTable";
import { AdjustStockDialog } from "@/components/inventory/AdjustStockDialog";
import { TransferDialog } from "@/components/inventory/TransferDialog";

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { state, actions } = useInventory();
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const product = state.products.find((p) => p.id === id);
  const movements = useMemo(() => state.movements.filter((m) => m.productId === id), [state.movements, id]);
  const stats = useMemo(() => getProductSalesStats(state, id), [state, id]);

  if (!product) return <NotFoundState entity="Product" backHref="/products" />;

  const qty = totalStock(product);
  const status = productStatus(product);
  const supplier = state.suppliers.find((s) => s.id === product.supplierId);
  const margin = product.sellingPrice > 0 ? ((product.sellingPrice - product.costPrice) / product.sellingPrice) * 100 : 0;
  const openPOs = state.purchases.filter((p) => (p.status === "Pending" || p.status === "Partially Received") && p.items.some((i) => i.productId === id));

  return (
    <>
      <PageHeader
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-[#f2f3f6] px-1.5 py-0.5 font-mono text-[12px] text-ink-2">{product.sku}</span>
            <StatusBadge status={status} />
            <span className="text-[12.5px] text-muted">{product.category}</span>
          </div>
        }
        title={
          <span className="flex items-center gap-3">
            <ProductThumb name={product.name} category={product.category} size={40} />
            {product.name}
          </span>
        }
        actions={
          <>
            <Button variant="secondary" icon={<SlidersHorizontal className="h-4 w-4" />} onClick={() => setAdjustOpen(true)}>
              Adjust stock
            </Button>
            <ButtonLink href={`/purchases/new?product=${product.id}`} icon={<ShoppingCart className="h-4 w-4" />}>
              Reorder
            </ButtonLink>
            <Dropdown
              items={[
                { label: "Edit product", icon: <Pencil />, href: `/products/${product.id}/edit` },
                { label: "Transfer stock", icon: <ArrowLeftRight />, onSelect: () => setTransferOpen(true) },
                { label: "Delete product", icon: <Trash2 />, danger: true, separatorBefore: true, onSelect: () => setDeleteOpen(true) },
              ]}
              trigger={({ toggle }) => (
                <Button variant="secondary" size="icon" onClick={toggle} aria-label="More actions">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              )}
            />
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="On hand" value={`${qty} ${product.unit}`} icon={<Boxes />} accent={status === "In Stock" ? "success" : status === "Low Stock" ? "warning" : "danger"} hint={`Minimum level ${product.minStock}`} />
        <StatCard label="Stock value" value={formatCurrency(stockValue(product), { whole: true })} icon={<Wallet />} accent="info" hint={`Retail ${formatCurrency(qty * product.sellingPrice)}`} />
        <StatCard label="Units sold" value={stats.units} icon={<TrendingUp />} accent="brand" hint={`${formatCurrency(stats.revenue)} revenue`} />
        <StatCard label="Incoming" value={stats.incoming} icon={<Truck />} accent="neutral" hint={openPOs.length ? `${openPOs.length} open purchase order${openPOs.length > 1 ? "s" : ""}` : "No open orders"} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="order-2 overflow-hidden xl:order-1">
          <CardHeader title="Stock history" description={`${movements.length} movement${movements.length === 1 ? "" : "s"} recorded`} />
          <MovementsTable state={state} movements={movements} showProduct={false} pageSize={10} compact />
        </Card>

        <div className="order-1 space-y-5 xl:order-2">
          <Card>
            <CardHeader title="Stock by warehouse" />
            <CardBody className="space-y-4">
              {state.warehouses.map((w) => {
                const q = product.stock[w.id] ?? 0;
                return (
                  <div key={w.id}>
                    <div className="mb-1.5 flex items-baseline justify-between text-[13px]">
                      <span className="text-ink-2">
                        {w.name} <span className="text-[11.5px] text-faint">· {w.location}</span>
                      </span>
                      <span className="font-semibold text-ink tabular">{q}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[#eef0f3]">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${qty ? (q / qty) * 100 : 0}%` }} />
                    </div>
                  </div>
                );
              })}
              <div className="border-t border-line pt-3">
                <div className="mb-1.5 flex justify-between text-[12px] text-muted">
                  <span>Total vs. minimum ({product.minStock})</span>
                  <span>Last updated {formatDate(getLastStockUpdate(state, product.id))}</span>
                </div>
                <StockBar qty={qty} min={product.minStock} />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Details" actions={<ButtonLink href={`/products/${product.id}/edit`} variant="ghost" size="sm" icon={<Pencil className="h-3.5 w-3.5" />}>Edit</ButtonLink>} />
            <CardBody>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5">
                <KeyValue label="Selling price">{formatCurrency(product.sellingPrice)}</KeyValue>
                <KeyValue label="Cost price">{formatCurrency(product.costPrice)}</KeyValue>
                <KeyValue label="Margin">
                  <span className={margin < 15 ? "text-warning" : "text-success"}>{margin.toFixed(1)}%</span>
                </KeyValue>
                <KeyValue label="Unit">{product.unit}</KeyValue>
                <KeyValue label="Supplier" className="col-span-2">
                  {supplier ? (
                    <Link href={`/suppliers/${supplier.id}`} className="text-brand hover:underline">
                      {supplier.name}
                    </Link>
                  ) : (
                    "—"
                  )}
                </KeyValue>
                {product.description && (
                  <KeyValue label="Description" className="col-span-2">
                    <span className="font-normal leading-relaxed text-ink-2">{product.description}</span>
                  </KeyValue>
                )}
                <KeyValue label="Created">{formatDate(product.createdAt)}</KeyValue>
                <KeyValue label="Updated">{formatDateTime(product.updatedAt)}</KeyValue>
              </dl>
            </CardBody>
          </Card>

          {openPOs.length > 0 && (
            <Card>
              <CardHeader title="Open purchase orders" />
              <CardBody className="space-y-2">
                {openPOs.map((po) => {
                  const line = po.items.find((i) => i.productId === id)!;
                  return (
                    <Link key={po.id} href={`/purchases/${po.id}`} className="flex items-center justify-between rounded-[10px] border border-line px-3 py-2.5 text-[13px] transition hover:border-brand/40 hover:bg-brand-50/30">
                      <span>
                        <span className="font-mono font-medium text-ink">{po.poNumber}</span>
                        <span className="block text-[12px] text-muted">{po.supplierName}</span>
                      </span>
                      <span className="text-right">
                        <span className="font-semibold text-info tabular">+{line.quantity - line.receivedQty}</span>
                        <span className="block text-[11.5px] text-muted">due {formatDate(po.expectedDate, "dd MMM")}</span>
                      </span>
                    </Link>
                  );
                })}
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      <AdjustStockDialog open={adjustOpen} onClose={() => setAdjustOpen(false)} productId={product.id} />
      <TransferDialog open={transferOpen} onClose={() => setTransferOpen(false)} productId={product.id} />
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        blockedReason={productDeleteBlocker(state, product.id)}
        title={`Delete ${product.name}?`}
        description="The product will be removed from your catalogue. Invoices and stock history keep their records."
        confirmLabel="Delete product"
        onConfirm={() => {
          const ok = actions.deleteProduct(product.id) !== null;
          if (ok) navigate("/products");
          return ok;
        }}
      />
    </>
  );
}
