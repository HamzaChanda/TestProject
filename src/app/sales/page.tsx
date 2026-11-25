"use client";

import { useNavigate } from "@/hooks/useNavigate";
import { useMemo, useState } from "react";
import Link from "next/link";

import { Ban, Banknote, CheckCircle2, CircleDollarSign, Clock, Download, Eye, FileText, IndianRupee, MoreHorizontal, Plus, Printer, ReceiptText, XCircle } from "lucide-react";
import { endOfDay, parseISO, startOfDay } from "date-fns";
import type { Sale } from "@/types";
import { useInventory } from "@/context/InventoryContext";
import { getSalesSummary, RANGE_PRESETS, rangeFromPreset, type RangePreset } from "@/lib/selectors";
import { formatCurrency, formatDate } from "@/lib/utils";
import { downloadCsv } from "@/lib/csv";
import { Card } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { Dropdown } from "@/components/ui/Dropdown";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState, FilterSelect, PageHeader, SearchInput, StatCard, Toolbar } from "@/components/ui/Primitives";
import { RecordPaymentDialog } from "@/components/inventory/RecordPaymentDialog";

type Period = RangePreset | "custom";

export default function SalesPage() {
  const { state, actions } = useInventory();
  const navigate = useNavigate();
  const MoneyIcon = state.settings.currency === "INR" ? IndianRupee : Banknote;
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [payment, setPayment] = useState("all");
  const [period, setPeriod] = useState<Period>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [toCancel, setToCancel] = useState<Sale | null>(null);
  const [toPay, setToPay] = useState<Sale | null>(null);

  const range = useMemo(() => {
    if (period === "custom") {
      return from || to ? { from: from ? startOfDay(parseISO(from)) : new Date(2000, 0, 1), to: to ? endOfDay(parseISO(to)) : endOfDay(new Date()) } : null;
    }
    return period === "all" ? null : rangeFromPreset(period);
  }, [period, from, to]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.sales.filter((s) => {
      const d = parseISO(s.date);
      return (
        (!q || s.invoiceNo.toLowerCase().includes(q) || s.customerName.toLowerCase().includes(q)) &&
        (status === "all" || s.status === status) &&
        (payment === "all" || s.paymentStatus === payment) &&
        (!range || (d >= range.from && d <= range.to))
      );
    });
  }, [state.sales, query, status, payment, range]);

  const summary = useMemo(() => getSalesSummary(filtered), [filtered]);

  const columns: Column<Sale>[] = [
    {
      key: "invoice",
      header: "Invoice",
      sortValue: (s) => s.invoiceNo,
      cell: (s) => (
        <Link href={`/sales/${s.id}`} onClick={(e) => e.stopPropagation()} className="font-mono text-small font-medium text-ink hover:text-brand">
          {s.invoiceNo}
        </Link>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      sortValue: (s) => s.customerName,
      cell: (s) => {
        const c = state.customers.find((x) => x.id === s.customerId);
        return (
          <div className="min-w-0">
            <div className="max-w-[200px] truncate font-medium text-ink">{s.customerName}</div>
            {c?.company && <div className="max-w-[200px] truncate text-small text-muted">{c.company}</div>}
          </div>
        );
      },
    },
    { key: "date", header: "Date", sortValue: (s) => s.date, cell: (s) => formatDate(s.date) },
    {
      key: "items", hideBelow: "laptop",
      header: "Items",
      align: "right",
      sortValue: (s) => s.items.reduce((n, i) => n + i.quantity, 0),
      cell: (s) => (
        <span className="tabular" title={s.items.map((i) => `${i.quantity} × ${i.name}`).join("\n")}>
          {s.items.reduce((n, i) => n + i.quantity, 0)} <span className="text-small text-muted">({s.items.length})</span>
        </span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      sortValue: (s) => s.total,
      cell: (s) => <span className={s.status === "Cancelled" ? "text-faint line-through tabular" : "font-semibold text-ink tabular"}>{formatCurrency(s.total)}</span>,
    },
    { key: "payment", header: "Payment", sortValue: (s) => s.paymentStatus, cell: (s) => (s.status === "Cancelled" ? <span className="text-faint">—</span> : <StatusBadge status={s.paymentStatus} />) },
    { key: "status", header: "Status", sortValue: (s) => s.status, cell: (s) => <StatusBadge status={s.status} /> },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (s) => (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <Dropdown
            width={200}
            items={[
              { label: "View invoice", icon: <Eye />, href: `/sales/${s.id}` },
              { label: "Print invoice", icon: <Printer />, href: `/sales/${s.id}?print=1` },
              { label: "Record payment", icon: <CircleDollarSign />, onSelect: () => setToPay(s), disabled: s.status === "Cancelled" || s.paymentStatus === "Paid" },
              { label: "Mark as completed", icon: <CheckCircle2 />, onSelect: () => actions.completeSale(s.id), disabled: s.status !== "Pending" },
              { label: "Cancel sale", icon: <Ban />, danger: true, separatorBefore: true, onSelect: () => setToCancel(s), disabled: s.status === "Cancelled" },
            ]}
            trigger={({ toggle }) => (
              <Button size="icon-sm" variant="ghost" onClick={toggle} aria-label={`Actions for ${s.invoiceNo}`}>
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
      `sales-${formatDate(new Date(), "yyyy-MM-dd")}`,
      filtered.map((s) => ({
        Invoice: s.invoiceNo,
        Customer: s.customerName,
        Date: formatDate(s.date, "yyyy-MM-dd"),
        Items: s.items.reduce((n, i) => n + i.quantity, 0),
        Subtotal: s.subtotal,
        Discount: s.discountAmount,
        Tax: s.taxAmount,
        Total: s.total,
        Paid: s.amountPaid,
        "Payment Status": s.paymentStatus,
        "Payment Method": s.paymentMethod,
        "Order Status": s.status,
      })),
    );

  const filtersActive = query || status !== "all" || payment !== "all" || period !== "all";

  return (
    <>
      <PageHeader
        title="Sales"
        description="Invoices, payments and fulfilment."
        actions={
          <>
            <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={exportCsv} disabled={!filtered.length}>
              Export
            </Button>
            <ButtonLink href="/sales/new" icon={<Plus className="h-4 w-4" />}>
              New sale
            </ButtonLink>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Total sales" value={summary.total} icon={<ReceiptText />} accent="brand" hint={filtersActive ? "Matching filters" : "All invoices"} />
        <StatCard label="Completed" value={summary.completed} icon={<CheckCircle2 />} accent="success" hint="Delivered orders" onClick={() => setStatus("Completed")} />
        <StatCard label="Pending" value={summary.pending} icon={<Clock />} accent="warning" hint="Awaiting delivery" onClick={() => setStatus("Pending")} />
        <StatCard label="Cancelled" value={summary.cancelled} icon={<XCircle />} accent="neutral" hint="Stock restored" onClick={() => setStatus("Cancelled")} />
        <div className="col-span-2 lg:col-span-1">
          <StatCard label="Total revenue" value={formatCurrency(summary.revenue, { whole: true })} icon={<MoneyIcon />} accent="info" hint={summary.outstanding > 0 ? `${formatCurrency(summary.outstanding)} outstanding` : "Fully collected"} />
        </div>
      </div>

      <Card className="mt-5 overflow-hidden">
        <Toolbar>
          <SearchInput value={query} onChange={setQuery} placeholder="Search invoice # or customer" />
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <FilterSelect
              label="Order status"
              value={status}
              onChange={setStatus}
              options={[
                { value: "all", label: "All statuses" },
                { value: "Completed", label: "Completed" },
                { value: "Pending", label: "Pending" },
                { value: "Cancelled", label: "Cancelled" },
              ]}
            />
            <FilterSelect
              label="Payment status"
              value={payment}
              onChange={setPayment}
              options={[
                { value: "all", label: "All payments" },
                { value: "Paid", label: "Paid" },
                { value: "Partial", label: "Partial" },
                { value: "Unpaid", label: "Unpaid" },
              ]}
            />
            <FilterSelect
              label="Date"
              value={period}
              onChange={(v) => setPeriod(v as Period)}
              options={[{ value: "all", label: "Any date" }, ...RANGE_PRESETS.filter((r) => r.value !== "all"), { value: "custom", label: "Custom range…" }]}
            />
          </div>
          {period === "custom" && (
            <div className="flex items-center gap-2">
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 rounded-control border border-line-strong px-2.5 text-body focus:border-brand focus:outline-none" aria-label="From date" />
              <span className="text-muted">–</span>
              <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="h-9 rounded-control border border-line-strong px-2.5 text-body focus:border-brand focus:outline-none" aria-label="To date" />
            </div>
          )}
          {filtersActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuery("");
                setStatus("all");
                setPayment("all");
                setPeriod("all");
                setFrom("");
                setTo("");
              }}
            >
              Clear filters
            </Button>
          )}
        </Toolbar>
        <DataTable
          rows={filtered}
          columns={columns}
          rowKey={(s) => s.id}
          onRowClick={(s) => navigate(`/sales/${s.id}`)}
          resetKey={`${query}|${status}|${payment}|${period}|${from}|${to}`}
          mobilePrimary="customer"
          mobileTrailing="amount"
          initialSort={{ key: "date", dir: "desc" }}
          rowClassName={(s) => (s.status === "Cancelled" ? "bg-surface text-faint opacity-75 hover:bg-row-hover" : undefined)}
          empty={
            state.sales.length === 0 ? (
              <EmptyState icon={<FileText />} title="No sales yet" description="Create your first invoice to start tracking revenue." action={<ButtonLink href="/sales/new">New sale</ButtonLink>} />
            ) : (
              <EmptyState icon={<FileText />} title="No invoices match your filters" description="Try changing the date range or status filters." />
            )
          }
        />
      </Card>

      <ConfirmDialog
        open={!!toCancel}
        onClose={() => setToCancel(null)}
        title={`Cancel ${toCancel?.invoiceNo}?`}
        description={
          <>
            {toCancel?.items.reduce((n, i) => n + i.quantity, 0)} units will be returned to stock. A cancelled invoice cannot be reopened.
          </>
        }
        reasonLabel="Reason for cancellation"
        confirmLabel="Cancel sale"
        onConfirm={(reason) => (toCancel ? actions.cancelSale(toCancel.id, reason) !== null : false)}
      />
      <RecordPaymentDialog open={!!toPay} sale={toPay} onClose={() => setToPay(null)} />
    </>
  );
}
