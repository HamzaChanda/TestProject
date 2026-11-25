"use client";

import { useNavigate } from "@/hooks/useNavigate";
import { useMemo, useState } from "react";
import Link from "next/link";

import { Ban, CheckCircle2, ClipboardList, Clock, Download, Eye, MoreHorizontal, PackageCheck, Plus, Send, ShoppingCart, Trash2, Wallet } from "lucide-react";
import { parseISO } from "date-fns";
import type { Purchase } from "@/types";
import { useInventory } from "@/context/InventoryContext";
import { getPurchaseSummary, isOverdue, purchaseProgress, RANGE_PRESETS, rangeFromPreset, receivedValue, type RangePreset } from "@/lib/selectors";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { downloadCsv } from "@/lib/csv";
import { Card } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { Dropdown } from "@/components/ui/Dropdown";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState, FilterSelect, PageHeader, SearchInput, Segmented, StatCard, Toolbar } from "@/components/ui/Primitives";
import { ReceivePurchaseDialog } from "@/components/inventory/ReceivePurchaseDialog";

const STATUSES = ["Draft", "Pending", "Partially Received", "Received", "Cancelled"] as const;

export default function PurchasesPage() {
  const { state, actions } = useInventory();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [supplier, setSupplier] = useState("all");
  const [period, setPeriod] = useState<RangePreset | "all">("all");
  const [receiving, setReceiving] = useState<Purchase | null>(null);
  const [cancelling, setCancelling] = useState<Purchase | null>(null);
  const [deleting, setDeleting] = useState<Purchase | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const range = period === "all" ? null : rangeFromPreset(period);
    return state.purchases.filter((p) => {
      const d = parseISO(p.orderDate);
      return (
        (!q || p.poNumber.toLowerCase().includes(q) || p.supplierName.toLowerCase().includes(q)) &&
        (status === "all" || (status === "open" ? p.status === "Pending" || p.status === "Partially Received" : p.status === status)) &&
        (supplier === "all" || p.supplierId === supplier) &&
        (!range || (d >= range.from && d <= range.to))
      );
    });
  }, [state.purchases, query, status, supplier, period]);

  const summary = useMemo(() => getPurchaseSummary(state.purchases), [state.purchases]);
  const counts = useMemo(() => Object.fromEntries(STATUSES.map((s) => [s, state.purchases.filter((p) => p.status === s).length])), [state.purchases]);

  const columns: Column<Purchase>[] = [
    {
      key: "po",
      header: "Purchase order",
      sortValue: (p) => p.poNumber,
      cell: (p) => (
        <Link href={`/purchases/${p.id}`} onClick={(e) => e.stopPropagation()} className="font-mono text-[12.5px] font-medium text-ink hover:text-brand">
          {p.poNumber}
        </Link>
      ),
    },
    { key: "supplier", header: "Supplier", sortValue: (p) => p.supplierName, cell: (p) => <span className="block max-w-[180px] truncate font-medium text-ink" title={p.supplierName}>{p.supplierName}</span> },
    { key: "orderDate", hideBelow: "desktop", header: "Order date", sortValue: (p) => p.orderDate, cell: (p) => formatDate(p.orderDate) },
    {
      key: "expected",
      header: "Expected",
      sortValue: (p) => p.expectedDate,
      cell: (p) => (
        <div className="leading-tight">
          <div className={cn(isOverdue(p) && "font-medium text-danger")}>{formatDate(p.expectedDate)}</div>
          {isOverdue(p) && <div className="mt-0.5 text-[11px] font-medium text-danger">Overdue</div>}
        </div>
      ),
    },
    {
      key: "items", hideBelow: "laptop",
      header: "Received",
      sortValue: (p) => purchaseProgress(p).pct,
      cell: (p) => {
        const pr = purchaseProgress(p);
        return (
          <div className="w-[92px]">
            <div className="mb-1 flex justify-between text-[11.5px] tabular">
              <span className="text-ink-2">
                {pr.received}/{pr.ordered}
              </span>
              <span className="text-muted">{pr.pct}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[#eef0f3]">
              <div className={cn("h-full rounded-full", pr.pct === 100 ? "bg-[#22a157]" : "bg-info")} style={{ width: `${pr.pct}%` }} />
            </div>
          </div>
        );
      },
    },
    { key: "total", header: "Total", align: "right", sortValue: (p) => p.total, cell: (p) => <span className="font-semibold text-ink tabular">{formatCurrency(p.total)}</span> },
    {
      key: "status",
      header: "Status",
      sortValue: (p) => p.status,
      cell: (p) => (
<StatusBadge status={p.status} />
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (p) => {
        const open = p.status === "Pending" || p.status === "Partially Received";
        return (
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {open && (
              <span className="hidden 2xl:inline-flex">
                <Button size="xs" variant="subtle" icon={<PackageCheck className="h-3.5 w-3.5" />} onClick={() => setReceiving(p)}>
                  Receive
                </Button>
              </span>
            )}
            <Dropdown
              width={200}
              items={[
                { label: "View order", icon: <Eye />, href: `/purchases/${p.id}` },
                ...(p.status === "Draft" ? [{ label: "Place order", icon: <Send />, onSelect: () => actions.placePurchaseOrder(p.id) }] : []),
                { label: "Receive items", icon: <PackageCheck />, onSelect: () => setReceiving(p), disabled: !open },
                ...(p.status === "Draft"
                  ? [{ label: "Delete draft", icon: <Trash2 />, danger: true, separatorBefore: true, onSelect: () => setDeleting(p) }]
                  : [{ label: "Cancel order", icon: <Ban />, danger: true, separatorBefore: true, onSelect: () => setCancelling(p), disabled: p.status === "Received" || p.status === "Cancelled" }]),
              ]}
              trigger={({ toggle }) => (
                <Button size="icon-sm" variant="ghost" onClick={toggle} aria-label={`Actions for ${p.poNumber}`}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              )}
            />
          </div>
        );
      },
    },
  ];

  const exportCsv = () =>
    downloadCsv(
      `purchases-${formatDate(new Date(), "yyyy-MM-dd")}`,
      filtered.map((p) => ({
        "PO Number": p.poNumber,
        Supplier: p.supplierName,
        "Order Date": p.orderDate,
        "Expected Date": p.expectedDate,
        "Units Ordered": purchaseProgress(p).ordered,
        "Units Received": purchaseProgress(p).received,
        Total: p.total,
        "Received Value": receivedValue(p),
        Status: p.status,
      })),
    );

  return (
    <>
      <PageHeader
        title="Purchases"
        description="Purchase orders and goods receiving."
        actions={
          <>
            <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={exportCsv} disabled={!filtered.length}>
              Export
            </Button>
            <ButtonLink href="/purchases/new" icon={<Plus className="h-4 w-4" />}>
              New purchase order
            </ButtonLink>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Total purchases" value={summary.total} icon={<ClipboardList />} accent="brand" hint={`${summary.drafts} draft${summary.drafts === 1 ? "" : "s"}`} />
        <StatCard label="Pending orders" value={summary.pending} icon={<Clock />} accent="warning" hint="Awaiting full delivery" onClick={() => setStatus("open")} />
        <StatCard label="Received orders" value={summary.received} icon={<CheckCircle2 />} accent="success" hint="Fully received" onClick={() => setStatus("Received")} />
        <StatCard label="Total purchase value" value={formatCurrency(summary.value, { whole: true })} icon={<Wallet />} accent="info" hint={`${formatCurrency(summary.receivedValue)} received`} />
      </div>

      <Card className="mt-5 overflow-hidden">
        <div className="px-4 pt-4 md:px-5">
          <Segmented
            value={status}
            onChange={setStatus}
            options={[
              { value: "all", label: "All", count: state.purchases.length },
              { value: "open", label: "Open", count: summary.pending },
              ...STATUSES.map((s) => ({ value: s, label: s, count: counts[s] })),
            ]}
          />
        </div>
        <Toolbar>
          <SearchInput value={query} onChange={setQuery} placeholder="Search PO # or supplier" />
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <FilterSelect label="Supplier" value={supplier} onChange={setSupplier} options={[{ value: "all", label: "All suppliers" }, ...state.suppliers.map((s) => ({ value: s.id, label: s.name }))]} />
            <FilterSelect label="Order date" value={period} onChange={(v) => setPeriod(v as RangePreset | "all")} options={[{ value: "all", label: "Any date" }, ...RANGE_PRESETS.filter((r) => r.value !== "all")]} />
          </div>
        </Toolbar>
        <DataTable
          rows={filtered}
          columns={columns}
          rowKey={(p) => p.id}
          onRowClick={(p) => navigate(`/purchases/${p.id}`)}
          resetKey={`${query}|${status}|${supplier}|${period}`}
          mobilePrimary="supplier"
          mobileTrailing="total"
          initialSort={{ key: "orderDate", dir: "desc" }}
          empty={
            state.purchases.length === 0 ? (
              <EmptyState icon={<ShoppingCart />} title="No purchase orders yet" description="Create a purchase order to restock inventory." action={<ButtonLink href="/purchases/new">New purchase order</ButtonLink>} />
            ) : (
              <EmptyState icon={<ShoppingCart />} title="No orders match your filters" description="Try a different status, supplier or date range." />
            )
          }
        />
      </Card>

      <ReceivePurchaseDialog open={!!receiving} purchase={receiving} onClose={() => setReceiving(null)} />
      <ConfirmDialog
        open={!!cancelling}
        onClose={() => setCancelling(null)}
        title={`Cancel ${cancelling?.poNumber}?`}
        description={
          cancelling && purchaseProgress(cancelling).received > 0
            ? `${purchaseProgress(cancelling).received} units already received will stay in stock. The remaining ${purchaseProgress(cancelling).remaining} units will no longer be expected.`
            : "No stock has been received on this order, so inventory will not change."
        }
        confirmLabel="Cancel order"
        onConfirm={() => (cancelling ? actions.cancelPurchase(cancelling.id) !== null : false)}
      />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={`Delete draft ${deleting?.poNumber}?`}
        description="This draft has not been sent to the supplier. It will be permanently removed."
        confirmLabel="Delete draft"
        onConfirm={() => (deleting ? actions.deletePurchaseDraft(deleting.id) !== null : false)}
      />
    </>
  );
}
