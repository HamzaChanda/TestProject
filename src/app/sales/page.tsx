"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { endOfDay, parseISO, startOfDay } from "date-fns";
import { Ban, CheckCircle2, CircleDollarSign, Download, Eye, FileText, MoreHorizontal, Plus, Printer } from "lucide-react";
import type { Sale } from "@/types";
import { useInventory } from "@/context/InventoryContext";
import { useNavigate } from "@/hooks/useNavigate";
import { useListState, type ListStateConfig } from "@/hooks/useListState";
import { getSalesSummary, isSaleOverdue, RANGE_PRESETS, rangeFromPreset, saleAgeDays, type RangePreset } from "@/lib/selectors";
import { cn, formatCurrency, formatDate, formatNumber, round2 } from "@/lib/utils";
import { downloadCsv } from "@/lib/csv";
import { Sheet } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Badge, StatusText } from "@/components/ui/Badge";
import { Dropdown } from "@/components/ui/Dropdown";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DatePicker } from "@/components/ui/DatePicker";
import { MetricStrip } from "@/components/ui/MetricStrip";
import { Tabs } from "@/components/ui/Tabs";
import { Code } from "@/components/ui/Stockroom";
import { EmptyState, FilterSelect, PageHeader, SearchInput, Toolbar } from "@/components/ui/Primitives";
import { RecordPaymentDialog } from "@/components/inventory/RecordPaymentDialog";

type Tab = "all" | "unpaid" | "pending" | "overdue" | "cancelled";
const TABS: readonly Tab[] = ["all", "unpaid", "pending", "overdue", "cancelled"];
const RANGES = ["all", ...RANGE_PRESETS.filter((r) => r.value !== "all").map((r) => r.value), "custom"] as const;

const LIST_CONFIG: ListStateConfig<"tab" | "payment" | "range" | "from" | "to"> = {
  filters: {
    tab: TABS,
    payment: ["all", "Paid", "Partial", "Unpaid"],
    range: RANGES,
    from: null,
    to: null,
  },
  sortKeys: ["invoice", "customer", "date", "amount", "balance", "status"],
  defaultSort: { key: "date", dir: "desc" },
  pageSizes: [25, 50, 100],
};

const balance = (s: Sale) => (s.status === "Cancelled" ? 0 : round2(s.total - s.amountPaid));

const matchesTab = (s: Sale, tab: Tab) => {
  switch (tab) {
    case "all":
      return true;
    case "unpaid":
      return s.status !== "Cancelled" && s.paymentStatus !== "Paid";
    case "pending":
      return s.status === "Pending";
    case "overdue":
      return isSaleOverdue(s);
    case "cancelled":
      return s.status === "Cancelled";
  }
};

export default function SalesPage() {
  return (
    <Suspense>
      <SalesList />
    </Suspense>
  );
}

/** One combined status: payment state (badge when it needs action) · delivery state (text). */
function SaleStatus({ s }: { s: Sale }) {
  if (s.status === "Cancelled") return <StatusText tone="neutral">Cancelled</StatusText>;
  const overdue = isSaleOverdue(s);
  const age = saleAgeDays(s);
  const delivery = s.status === "Completed" ? "Delivered" : "Pending delivery";
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      {s.paymentStatus === "Paid" ? (
        <StatusText tone="success">Paid</StatusText>
      ) : overdue ? (
        <Badge tone="danger">
          <span>
            Overdue · <span className="font-mono">{age}d</span>
          </span>
        </Badge>
      ) : (
        <Badge tone={s.paymentStatus === "Partial" ? "warning" : "danger"}>{s.paymentStatus}</Badge>
      )}
      <span className="text-faint" aria-hidden>
        ·
      </span>
      <span className={cn("text-label", s.status === "Pending" ? "font-medium text-warning" : "text-muted")}>{delivery}</span>
    </span>
  );
}

function SalesList() {
  const { state, actions } = useInventory();
  const navigate = useNavigate();
  const list = useListState(LIST_CONFIG);
  const { q, filters, sort, page, size } = list;
  const tab = filters.tab as Tab;
  const range = filters.range as RangePreset | "all" | "custom";

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toCancel, setToCancel] = useState<Sale | null>(null);
  const [toPay, setToPay] = useState<Sale | null>(null);
  const [bulkPay, setBulkPay] = useState<Sale[] | null>(null);

  const dateRange = useMemo(() => {
    if (range === "custom") {
      const { from, to } = filters;
      return from || to ? { from: from ? startOfDay(parseISO(from)) : new Date(2000, 0, 1), to: to ? endOfDay(parseISO(to)) : endOfDay(new Date()) } : null;
    }
    return range === "all" ? null : rangeFromPreset(range);
  }, [range, filters]);

  // Everything except the tab — tab counts are computed on this set.
  const base = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return state.sales.filter((s) => {
      const d = parseISO(s.date);
      return (
        (!needle || s.invoiceNo.toLowerCase().includes(needle) || s.customerName.toLowerCase().includes(needle)) &&
        (filters.payment === "all" || (s.status !== "Cancelled" && s.paymentStatus === filters.payment)) &&
        (!dateRange || (d >= dateRange.from && d <= dateRange.to))
      );
    });
  }, [state.sales, q, filters.payment, dateRange]);

  const rows = useMemo(() => base.filter((s) => matchesTab(s, tab)), [base, tab]);
  const counts = useMemo(() => Object.fromEntries(TABS.map((t) => [t, base.filter((s) => matchesTab(s, t)).length])) as Record<Tab, number>, [base]);
  const summary = useMemo(() => getSalesSummary(base), [base]);
  const overdueAmount = useMemo(() => round2(base.filter((s) => isSaleOverdue(s)).reduce((a, s) => a + balance(s), 0)), [base]);

  // Drop selections that are no longer visible under the current filters.
  useEffect(() => {
    setSelected((prev) => {
      if (!prev.size) return prev;
      const keep = new Set(rows.map((r) => r.id));
      const next = new Set([...prev].filter((id) => keep.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [rows]);

  const exportRows = (list: Sale[], name: string) =>
    downloadCsv(
      `${name}-${formatDate(new Date(), "yyyy-MM-dd")}`,
      list.map((s) => ({
        Invoice: s.invoiceNo,
        Customer: s.customerName,
        Date: formatDate(s.date, "yyyy-MM-dd"),
        Items: s.items.reduce((n, i) => n + i.quantity, 0),
        Subtotal: s.subtotal,
        Discount: s.discountAmount,
        Tax: s.taxAmount,
        Total: s.total,
        Paid: s.amountPaid,
        "Balance Due": balance(s),
        "Payment Status": s.status === "Cancelled" ? "" : s.paymentStatus,
        "Payment Method": s.paymentMethod,
        "Order Status": s.status,
      })),
    );

  const columns: Column<Sale>[] = [
    {
      key: "invoice",
      header: "Invoice",
      sortValue: (s) => s.invoiceNo,
      cell: (s) => (
        <Link href={`/sales/${s.id}`} onClick={(e) => e.stopPropagation()} className="rounded-tag font-mono text-code font-medium text-ink hover:text-petrol-700 focus-visible:outline-2 focus-visible:outline-brand">
          {s.invoiceNo}
        </Link>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      sortValue: (s) => s.customerName,
      cell: (s) => <span className="block max-w-[240px] truncate font-medium text-ink">{s.customerName}</span>,
    },
    { key: "date", header: "Date", sortValue: (s) => s.date, cell: (s) => <span className="text-ink-2">{formatDate(s.date, "d MMM yyyy")}</span> },
    {
      key: "items",
      header: "Items",
      align: "right",
      hideBelow: "desktop",
      cell: (s) => (
        <span className="font-mono text-[12px] text-muted" title={s.items.map((i) => `${i.quantity} × ${i.name}`).join("\n")}>
          {s.items.reduce((n, i) => n + i.quantity, 0)}
        </span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      sortValue: (s) => s.total,
      cell: (s) => <span className={cn("font-mono text-[12.5px]", s.status === "Cancelled" ? "text-faint line-through" : "text-ink")}>{formatCurrency(s.total)}</span>,
    },
    {
      key: "balance",
      header: "Balance due",
      align: "right",
      sortValue: balance,
      cell: (s) => {
        const b = balance(s);
        return b > 0 ? <span className="font-mono text-[12.5px] font-medium text-danger">{formatCurrency(b)}</span> : <span className="text-faint">—</span>;
      },
    },
    { key: "status", header: "Status", sortValue: (s) => `${s.status}-${s.paymentStatus}`, cell: (s) => <SaleStatus s={s} /> },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (s) => (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <Dropdown
            width={210}
            items={[
              { label: "View invoice", icon: <Eye />, href: `/sales/${s.id}` },
              { label: "Print invoice", icon: <Printer />, href: `/sales/${s.id}?print=1` },
              { label: "Record payment", icon: <CircleDollarSign />, onSelect: () => setToPay(s), disabled: s.status === "Cancelled" || s.paymentStatus === "Paid" },
              { label: "Mark as completed", icon: <CheckCircle2 />, onSelect: () => actions.completeSale(s.id), disabled: s.status !== "Pending" },
              { label: "Cancel sale", icon: <Ban />, danger: true, separatorBefore: true, onSelect: () => setToCancel(s), disabled: s.status === "Cancelled" },
            ]}
            trigger={({ toggle, open }) => (
              <Button size="icon-sm" variant="ghost" onClick={toggle} aria-label={`Actions for ${s.invoiceNo}`} aria-expanded={open} aria-haspopup="menu">
                <MoreHorizontal />
              </Button>
            )}
          />
        </div>
      ),
    },
  ];

  const tabLabel: Record<Tab, string> = { all: "All", unpaid: "Unpaid", pending: "Pending delivery", overdue: "Overdue", cancelled: "Cancelled" };

  return (
    <>
      <PageHeader
        title="Sales"
        description="Invoices, payments and fulfilment."
        actions={
          <>
            <Button variant="secondary" icon={<Download />} onClick={() => exportRows(rows, "sales")} disabled={!rows.length}>
              Export
            </Button>
            <ButtonLink href="/sales/new" icon={<Plus />}>
              New sale
            </ButtonLink>
          </>
        }
      />

      <MetricStrip
        metrics={[
          { label: "Revenue", value: formatCurrency(summary.revenue, { whole: true }), detail: `${formatNumber(summary.total - summary.cancelled)} invoices${list.isFiltered ? " · filtered" : ""}`, href: undefined },
          {
            label: "Collected",
            value: formatCurrency(summary.collected, { whole: true }),
            detail: summary.revenue ? `${Math.round((summary.collected / summary.revenue) * 100)}% of revenue` : "—",
          },
          {
            label: "Outstanding",
            value: formatCurrency(summary.outstanding, { whole: true }),
            detail: `${formatNumber(counts.unpaid)} unpaid or partial`,
            href: tab === "unpaid" ? undefined : "/sales?tab=unpaid",
            ariaLabel: "Show unpaid invoices",
          },
          {
            label: "Overdue > 7 days",
            value: formatCurrency(overdueAmount, { whole: true }),
            detail: counts.overdue ? `${formatNumber(counts.overdue)} invoice${counts.overdue === 1 ? "" : "s"}` : "Nothing overdue",
            tone: counts.overdue ? "warning" : undefined,
            href: tab === "overdue" ? undefined : "/sales?tab=overdue",
            ariaLabel: "Show overdue invoices",
          },
        ]}
      />

      <Sheet className="mt-6 overflow-clip">
        <Tabs<Tab>
          ariaLabel="Invoice views"
          value={tab}
          onChange={(v) => list.setFilter("tab", v)}
          items={TABS.map((t) => ({ value: t, label: tabLabel[t], count: counts[t], attention: t === "overdue" && counts.overdue > 0 }))}
        />
        <Toolbar>
          <SearchInput value={q} onChange={list.setQ} placeholder="Search invoice # or customer" />
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <FilterSelect
              label="Date"
              value={range}
              onChange={(v) => list.setFilter("range", v)}
              options={[{ value: "all", label: "Any date" }, ...RANGE_PRESETS.filter((r) => r.value !== "all"), { value: "custom", label: "Custom range…" }]}
            />
            <FilterSelect
              label="Payment"
              value={filters.payment}
              onChange={(v) => list.setFilter("payment", v)}
              options={[
                { value: "all", label: "Any payment" },
                { value: "Paid", label: "Paid" },
                { value: "Partial", label: "Partial" },
                { value: "Unpaid", label: "Unpaid" },
              ]}
            />
          </div>
          {range === "custom" && (
            <div className="flex items-center gap-2">
              <DatePicker size="sm" ariaLabel="From date" value={filters.from} max={filters.to || undefined} onChange={(v) => list.setFilter("from", v)} className="w-[150px]" />
              <span className="text-muted" aria-hidden>
                –
              </span>
              <DatePicker size="sm" ariaLabel="To date" value={filters.to} min={filters.from || undefined} onChange={(v) => list.setFilter("to", v)} className="w-[150px]" />
            </div>
          )}
          {list.isFiltered && (
            <Button variant="ghost" size="sm" onClick={list.reset}>
              Clear filters
            </Button>
          )}
        </Toolbar>
        <DataTable
          label="Invoices"
          noun="invoices"
          rows={rows}
          columns={columns}
          rowKey={(s) => s.id}
          onRowClick={(s) => navigate(`/sales/${s.id}`)}
          sort={sort}
          onSortChange={list.setSort}
          initialSort={LIST_CONFIG.defaultSort}
          page={page}
          onPageChange={list.setPage}
          pageSize={size}
          pageSizeOptions={LIST_CONFIG.pageSizes}
          onPageSizeChange={list.setSize}
          selected={selected}
          onSelectedChange={setSelected}
          rowTone={(s) => (s.status === "Cancelled" ? "muted" : isSaleOverdue(s) ? "warning" : undefined)}
          bulkActions={(sel, clear) => {
            const completable = sel.filter((s) => s.status === "Pending");
            const payable = sel.filter((s) => s.status !== "Cancelled" && s.paymentStatus !== "Paid");
            return (
              <>
                <Button size="sm" variant="secondary" icon={<Download />} onClick={() => exportRows(sel, "sales-selected")}>
                  Export
                </Button>
                {completable.length > 0 && (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<CheckCircle2 />}
                    onClick={() => {
                      if (actions.completeSales(completable.map((s) => s.id)) !== null) clear();
                    }}
                  >
                    <span>
                      Mark <span className="font-mono">{completable.length}</span> delivered
                    </span>
                  </Button>
                )}
                {payable.length > 0 && (
                  <Button size="sm" variant="secondary" icon={<CircleDollarSign />} onClick={() => setBulkPay(payable)}>
                    <span>
                      Record full payment · <span className="font-mono">{payable.length}</span>
                    </span>
                  </Button>
                )}
              </>
            );
          }}
          mobileCard={(s) => (
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium text-ink">{s.customerName}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-label text-muted">
                    <Code className="text-ink-2">{s.invoiceNo}</Code>
                    <span>{formatDate(s.date, "d MMM")}</span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className={cn("font-mono text-[13px]", s.status === "Cancelled" ? "text-faint line-through" : "text-ink")}>{formatCurrency(s.total)}</div>
                  {balance(s) > 0 && <div className="font-mono text-[12px] text-danger">{formatCurrency(balance(s))} due</div>}
                </div>
              </div>
              <div className="mt-2">
                <SaleStatus s={s} />
              </div>
            </div>
          )}
          empty={
            state.sales.length === 0 ? (
              <EmptyState icon={<FileText />} title="No sales yet" description="Create your first invoice to start tracking revenue." action={<ButtonLink href="/sales/new">New sale</ButtonLink>} />
            ) : (
              <EmptyState
                icon={<FileText />}
                title={tab === "overdue" && !list.isFiltered ? "Nothing overdue" : "No invoices match this view"}
                description={tab === "overdue" && !list.isFiltered ? "Every invoice older than 7 days has been paid." : "Try another tab, date range or payment filter."}
                action={
                  list.isFiltered ? (
                    <Button variant="secondary" size="sm" onClick={list.reset}>
                      Clear filters
                    </Button>
                  ) : undefined
                }
              />
            )
          }
        />
      </Sheet>

      <ConfirmDialog
        open={!!toCancel}
        onClose={() => setToCancel(null)}
        title={`Cancel ${toCancel?.invoiceNo}?`}
        description={<>{toCancel?.items.reduce((n, i) => n + i.quantity, 0)} units will be returned to stock. A cancelled invoice cannot be reopened.</>}
        reasonLabel="Reason for cancellation"
        confirmLabel="Cancel sale"
        onConfirm={(reason) => (toCancel ? actions.cancelSale(toCancel.id, reason) !== null : false)}
      />
      <ConfirmDialog
        open={!!bulkPay}
        onClose={() => setBulkPay(null)}
        tone="primary"
        title={`Record full payment on ${bulkPay?.length ?? 0} invoice${bulkPay?.length === 1 ? "" : "s"}?`}
        description={
          <>
            Marks the selected invoices as paid, collecting{" "}
            <span className="font-mono font-medium text-ink">{formatCurrency(round2((bulkPay ?? []).reduce((a, s) => a + balance(s), 0)))}</span> in total.
          </>
        }
        confirmLabel="Record payments"
        onConfirm={() => {
          const ok = bulkPay ? actions.recordFullPayments(bulkPay.map((s) => s.id)) !== null : false;
          if (ok) setSelected(new Set());
          return ok;
        }}
      />
      <RecordPaymentDialog open={!!toPay} sale={toPay} onClose={() => setToPay(null)} />
    </>
  );
}
