"use client";

import { useNavigate } from "@/hooks/useNavigate";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { CircleDollarSign, Mail, MapPin, Pencil, Phone, ReceiptText, ShoppingBag, Trash2, Wallet, FileText } from "lucide-react";
import type { Sale } from "@/types";
import { useInventory } from "@/context/InventoryContext";
import { customerDeleteBlocker } from "@/lib/inventory";
import { getCustomerStats, getTopProducts } from "@/lib/selectors";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Avatar, EmptyState, PageHeader, StatCard } from "@/components/ui/Primitives";
import { NotFoundState } from "@/components/ui/NotFoundState";
import { CustomerFormPanel } from "@/components/forms/PartyForms";
import { RankedBars } from "@/components/charts/Charts";

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { state, actions } = useInventory();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const customer = state.customers.find((c) => c.id === id);
  const stats = useMemo(() => getCustomerStats(state, id), [state, id]);

  const topProducts = useMemo(() => getTopProducts(state, stats.sales, { limit: 5 }), [state, stats.sales]);

  if (!customer) return <NotFoundState entity="Customer" backHref="/customers" />;

  const columns: Column<Sale>[] = [
    { key: "invoice", header: "Invoice", sortValue: (s) => s.invoiceNo, cell: (s) => <span className="font-mono text-[12.5px] font-medium text-ink">{s.invoiceNo}</span> },
    { key: "date", header: "Date", sortValue: (s) => s.date, cell: (s) => formatDate(s.date) },
    { key: "items", header: "Items", cell: (s) => <span className="block max-w-[260px] truncate text-muted">{s.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}</span>, hideOnMobile: true },
    { key: "amount", header: "Amount", align: "right", sortValue: (s) => s.total, cell: (s) => <span className="font-semibold text-ink tabular">{formatCurrency(s.total)}</span> },
    { key: "payment", header: "Payment", cell: (s) => (s.status === "Cancelled" ? <span className="text-faint">—</span> : <StatusBadge status={s.paymentStatus} />) },
    { key: "status", header: "Status", cell: (s) => <StatusBadge status={s.status} /> },
  ];

  const avg = stats.orders ? stats.spent / stats.orders : 0;

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Avatar name={customer.name} size={40} />
            <span>
              {customer.name}
              {customer.company && <span className="block text-[13px] font-normal tracking-normal text-muted">{customer.company}</span>}
            </span>
          </span>
        }
        actions={
          <>
            <Button variant="secondary" size="icon" onClick={() => setDeleteOpen(true)} aria-label="Delete customer">
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button variant="secondary" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            <ButtonLink href={`/sales/new?customer=${customer.id}`} icon={<ReceiptText className="h-4 w-4" />}>
              New sale
            </ButtonLink>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Total orders" value={stats.orders} icon={<ShoppingBag />} accent="brand" hint={stats.lastOrder ? `Last on ${formatDate(stats.lastOrder)}` : "No orders yet"} />
        <StatCard label="Total spent" value={formatCurrency(stats.spent, { whole: true })} icon={<Wallet />} accent="success" hint="Excludes cancelled invoices" />
        <StatCard label="Average order" value={formatCurrency(avg, { whole: true })} icon={<FileText />} accent="info" />
        <StatCard label="Outstanding" value={formatCurrency(stats.outstanding, { whole: true })} icon={<CircleDollarSign />} accent={stats.outstanding > 0 ? "danger" : "neutral"} hint={stats.outstanding > 0 ? "Unpaid balance" : "All settled"} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="overflow-hidden">
          <CardHeader title="Purchase history" description={`${stats.sales.length} invoice${stats.sales.length === 1 ? "" : "s"}`} />
          <DataTable
            rows={stats.sales}
            columns={columns}
            rowKey={(s) => s.id}
            onRowClick={(s) => navigate(`/sales/${s.id}`)}
            initialSort={{ key: "date", dir: "desc" }}
            mobileTrailing="amount"
            pageSize={8}
            empty={<EmptyState icon={<ReceiptText />} title="No purchases yet" description="Invoices for this customer will appear here." action={<ButtonLink href={`/sales/new?customer=${customer.id}`}>Create first sale</ButtonLink>} />}
          />
        </Card>
        <div className="space-y-5">
          <Card>
            <CardHeader title="Contact information" />
            <CardBody className="space-y-3 text-[13px]">
              <a href={`mailto:${customer.email}`} className="flex items-center gap-2.5 text-ink-2 hover:text-brand">
                <Mail className="h-4 w-4 text-muted" /> {customer.email}
              </a>
              <a href={`tel:${customer.phone.replace(/\s/g, "")}`} className="flex items-center gap-2.5 text-ink-2 hover:text-brand">
                <Phone className="h-4 w-4 text-muted" /> {customer.phone}
              </a>
              {(customer.address || customer.city) && (
                <div className="flex gap-2.5 text-ink-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                  <span className="leading-relaxed">{customer.address || customer.city}</span>
                </div>
              )}
              {customer.gstin && (
                <div className="border-t border-line pt-3 text-[12px] text-muted">
                  GSTIN <span className="font-mono text-ink-2">{customer.gstin}</span>
                </div>
              )}
              <div className="text-[12px] text-muted">Customer since {formatDate(customer.createdAt, "MMM yyyy")}</div>
            </CardBody>
          </Card>
          {topProducts.length > 0 && (
            <Card>
              <CardHeader title="Top products" description="By revenue from this customer" />
              <CardBody>
                <RankedBars data={topProducts.map((p) => ({ name: p.name, value: p.value, sub: `${p.units} units` }))} />
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      <CustomerFormPanel open={editOpen} customer={customer} onClose={() => setEditOpen(false)} />
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={`Delete ${customer.name}?`}
        blockedReason={customerDeleteBlocker(state, customer.id)}
        description="This customer will be permanently removed."
        confirmLabel="Delete customer"
        onConfirm={() => {
          const ok = actions.deleteCustomer(customer.id) !== null;
          if (ok) navigate("/customers");
          return ok;
        }}
      />
    </>
  );
}
