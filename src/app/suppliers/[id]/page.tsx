"use client";

import { useNavigate } from "@/hooks/useNavigate";
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Building2, ClipboardList, Clock, Mail, MapPin, Package, Pencil, Phone, ShoppingCart, Trash2, Wallet } from "lucide-react";
import type { Purchase } from "@/types";
import { useInventory } from "@/context/InventoryContext";
import { supplierDeleteBlocker } from "@/lib/inventory";
import { getSupplierStats, purchaseProgress } from "@/lib/selectors";
import { productStatus, totalStock } from "@/lib/calc";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState, PageHeader, ProductThumb, StatCard } from "@/components/ui/Primitives";
import { NotFoundState } from "@/components/ui/NotFoundState";
import { SupplierFormPanel } from "@/components/forms/PartyForms";

export default function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { state, actions } = useInventory();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const supplier = state.suppliers.find((s) => s.id === id);
  if (!supplier) return <NotFoundState entity="Supplier" backHref="/suppliers" />;

  const stats = getSupplierStats(state, supplier.id);
  const products = state.products.filter((p) => p.supplierId === supplier.id);

  const columns: Column<Purchase>[] = [
    { key: "po", header: "PO number", sortValue: (p) => p.poNumber, cell: (p) => <span className="font-mono text-small font-medium text-ink">{p.poNumber}</span> },
    { key: "date", header: "Order date", sortValue: (p) => p.orderDate, cell: (p) => formatDate(p.orderDate) },
    { key: "received", header: "Received", cell: (p) => `${purchaseProgress(p).received}/${purchaseProgress(p).ordered} units` },
    { key: "total", header: "Total", align: "right", sortValue: (p) => p.total, cell: (p) => <span className="font-semibold text-ink tabular">{formatCurrency(p.total)}</span> },
    { key: "status", header: "Status", cell: (p) => <StatusBadge status={p.status} /> },
  ];

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-panel bg-[#fff1ea] text-[#c2410c]">
              <Building2 className="h-5 w-5" />
            </span>
            <span>
              {supplier.name}
              <span className="block text-body font-normal tracking-normal text-muted">
                {supplier.contactPerson} · {supplier.paymentTerms}
              </span>
            </span>
          </span>
        }
        actions={
          <>
            <Button variant="secondary" size="icon" onClick={() => setDeleteOpen(true)} aria-label="Delete supplier">
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button variant="secondary" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            <ButtonLink href={`/purchases/new?supplier=${supplier.id}`} icon={<ShoppingCart className="h-4 w-4" />}>
              New purchase order
            </ButtonLink>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Purchase orders" value={stats.orders} icon={<ClipboardList />} accent="brand" />
        <StatCard label="Total purchases" value={formatCurrency(stats.total, { whole: true })} icon={<Wallet />} accent="info" hint="Excludes drafts & cancelled" />
        <StatCard label="Outstanding orders" value={stats.outstanding} icon={<Clock />} accent={stats.outstanding ? "warning" : "neutral"} hint="Pending or partially received" />
        <StatCard label="Products supplied" value={stats.products} icon={<Package />} accent="success" />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="overflow-hidden">
          <CardHeader title="Purchase history" />
          <DataTable
            rows={stats.purchases}
            columns={columns}
            rowKey={(p) => p.id}
            onRowClick={(p) => navigate(`/purchases/${p.id}`)}
            initialSort={{ key: "date", dir: "desc" }}
            mobileTrailing="total"
            pageSize={8}
            empty={<EmptyState icon={<ShoppingCart />} title="No purchase orders yet" action={<ButtonLink href={`/purchases/new?supplier=${supplier.id}`}>Create purchase order</ButtonLink>} />}
          />
        </Card>
        <div className="space-y-5">
          <Card>
            <CardHeader title="Contact" />
            <CardBody className="space-y-3 text-body">
              <a href={`mailto:${supplier.email}`} className="flex items-center gap-2.5 text-ink-2 hover:text-brand">
                <Mail className="h-4 w-4 text-muted" /> {supplier.email}
              </a>
              <a href={`tel:${supplier.phone.replace(/\s/g, "")}`} className="flex items-center gap-2.5 text-ink-2 hover:text-brand">
                <Phone className="h-4 w-4 text-muted" /> {supplier.phone}
              </a>
              <div className="flex gap-2.5 text-ink-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                <span className="leading-relaxed">{supplier.address || supplier.city}</span>
              </div>
              {supplier.gstin && (
                <div className="border-t border-line pt-3 text-small text-muted">
                  GSTIN <span className="font-mono text-ink-2">{supplier.gstin}</span>
                </div>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Products supplied" />
            <CardBody className="space-y-1">
              {products.length === 0 ? (
                <p className="text-body text-muted">No products linked to this supplier.</p>
              ) : (
                products.map((p) => (
                  <Link key={p.id} href={`/products/${p.id}`} className="-mx-2 flex items-center gap-3 rounded-control px-2 py-1.5 hover:bg-subtle">
                    <ProductThumb name={p.name} category={p.category} size={28} />
                    <span className="min-w-0 flex-1 truncate text-body text-ink">{p.name}</span>
                    <span className="text-small text-muted tabular">{totalStock(p)}</span>
                    <StatusBadge status={productStatus(p)} />
                  </Link>
                ))
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <SupplierFormPanel open={editOpen} supplier={supplier} onClose={() => setEditOpen(false)} />
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={`Delete ${supplier.name}?`}
        blockedReason={supplierDeleteBlocker(state, supplier.id)}
        description="This supplier will be removed and unlinked from its products."
        confirmLabel="Delete supplier"
        onConfirm={() => {
          const ok = actions.deleteSupplier(supplier.id) !== null;
          if (ok) navigate("/suppliers");
          return ok;
        }}
      />
    </>
  );
}
