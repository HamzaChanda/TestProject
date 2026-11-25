"use client";

import { useNavigate } from "@/hooks/useNavigate";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Eye, MoreHorizontal, Pencil, ReceiptText, Trash2, UserPlus, Users } from "lucide-react";
import type { Customer } from "@/types";
import { useInventory } from "@/context/InventoryContext";
import { customerDeleteBlocker } from "@/lib/inventory";
import { getCustomerStats } from "@/lib/selectors";
import { formatCurrency, formatDate, timeAgo } from "@/lib/utils";
import { downloadCsv } from "@/lib/csv";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Avatar, EmptyState, FilterSelect, PageHeader, SearchInput, Toolbar } from "@/components/ui/Primitives";
import { CustomerFormPanel } from "@/components/forms/PartyForms";

function CustomersInner() {
  const { state, actions } = useInventory();
  const router = useRouter();
  const navigate = useNavigate();
  const params = useSearchParams();
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("all");
  const [panel, setPanel] = useState<{ open: boolean; customer: Customer | null }>({ open: false, customer: null });
  const [toDelete, setToDelete] = useState<Customer | null>(null);

  useEffect(() => {
    if (params.get("new") === "1") {
      setPanel({ open: true, customer: null });
      router.replace("/customers");
    }
  }, [params, router]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.customers
      .filter((c) => (!q || [c.name, c.company, c.email, c.phone].some((f) => f.toLowerCase().includes(q))) && (city === "all" || c.city === city))
      .map((c) => ({ ...c, stats: getCustomerStats(state, c.id) }));
  }, [state, query, city]);
  type Row = (typeof rows)[number];

  const cities = [...new Set(state.customers.map((c) => c.city).filter(Boolean))].sort();

  const columns: Column<Row>[] = [
    {
      key: "name",
      header: "Customer",
      sortValue: (c) => c.name,
      cell: (c) => (
        <Link href={`/customers/${c.id}`} className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
          <Avatar name={c.name} size={32} />
          <span className="min-w-0">
            <span className="block max-w-[200px] truncate font-medium text-ink hover:text-brand">{c.name}</span>
            <span className="block max-w-[200px] truncate text-label text-muted">{c.company || c.city}</span>
          </span>
        </Link>
      ),
    },
    { key: "email", hideBelow: "laptop", header: "Email", sortValue: (c) => c.email, cell: (c) => <span className="text-ink-2">{c.email}</span> },
    { key: "phone", header: "Phone", cell: (c) => <span className="tabular">{c.phone}</span> },
    { key: "orders", header: "Orders", align: "right", sortValue: (c) => c.stats.orders, cell: (c) => <span className="tabular">{c.stats.orders}</span> },
    {
      key: "spent",
      header: "Total spent",
      align: "right",
      sortValue: (c) => c.stats.spent,
      cell: (c) => (
        <div>
          <div className="font-semibold text-ink tabular">{formatCurrency(c.stats.spent)}</div>
          {c.stats.outstanding > 0 && <div className="text-label text-danger tabular">{formatCurrency(c.stats.outstanding)} due</div>}
        </div>
      ),
    },
    {
      key: "last", hideBelow: "desktop",
      header: "Last order",
      sortValue: (c) => c.stats.lastOrder ?? "",
      cell: (c) => (c.stats.lastOrder ? <span title={formatDate(c.stats.lastOrder)}>{timeAgo(c.stats.lastOrder)}</span> : <span className="text-faint">No orders</span>),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (c) => (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <Dropdown
            width={190}
            items={[
              { label: "View details", icon: <Eye />, href: `/customers/${c.id}` },
              { label: "New sale", icon: <ReceiptText />, href: `/sales/new?customer=${c.id}` },
              { label: "Edit customer", icon: <Pencil />, onSelect: () => setPanel({ open: true, customer: c }) },
              { label: "Delete customer", icon: <Trash2 />, danger: true, separatorBefore: true, onSelect: () => setToDelete(c) },
            ]}
            trigger={({ toggle }) => (
              <Button size="icon-sm" variant="ghost" onClick={toggle} aria-label={`Actions for ${c.name}`}>
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
        title="Customers"
        description={`${state.customers.length} customers · ${formatCurrency(rows.reduce((s, r) => s + r.stats.spent, 0))} lifetime revenue`}
        actions={
          <>
            <Button
              variant="secondary"
              icon={<Download className="h-4 w-4" />}
              onClick={() =>
                downloadCsv(
                  "customers",
                  rows.map((c) => ({ Name: c.name, Company: c.company, Email: c.email, Phone: c.phone, City: c.city, GSTIN: c.gstin, Orders: c.stats.orders, "Total Spent": c.stats.spent, Outstanding: c.stats.outstanding, "Last Order": formatDate(c.stats.lastOrder) })),
                )
              }
              disabled={!rows.length}
            >
              Export
            </Button>
            <Button icon={<UserPlus className="h-4 w-4" />} onClick={() => setPanel({ open: true, customer: null })}>
              Add customer
            </Button>
          </>
        }
      />
      <Card className="overflow-hidden">
        <Toolbar>
          <SearchInput value={query} onChange={setQuery} placeholder="Search name, company, email or phone" className="sm:w-[320px]" />
          <FilterSelect label="City" value={city} onChange={setCity} options={[{ value: "all", label: "All cities" }, ...cities.map((c) => ({ value: c, label: c }))]} />
        </Toolbar>
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(c) => c.id}
          onRowClick={(c) => navigate(`/customers/${c.id}`)}
          resetKey={`${query}|${city}`}
          mobileTrailing="spent"
          initialSort={{ key: "spent", dir: "desc" }}
          empty={
            state.customers.length === 0 ? (
              <EmptyState icon={<Users />} title="No customers yet" description="Add customers to start creating invoices." action={<Button onClick={() => setPanel({ open: true, customer: null })}>Add customer</Button>} />
            ) : (
              <EmptyState icon={<Users />} title="No customers match" description="Try a different name, email or phone number." />
            )
          }
        />
      </Card>
      <CustomerFormPanel open={panel.open} customer={panel.customer} onClose={() => setPanel({ open: false, customer: null })} />
      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title={`Delete ${toDelete?.name}?`}
        blockedReason={toDelete ? customerDeleteBlocker(state, toDelete.id) : null}
        description="This customer has no invoices and will be permanently removed."
        confirmLabel="Delete customer"
        onConfirm={() => (toDelete ? actions.deleteCustomer(toDelete.id) !== null : false)}
      />
    </>
  );
}

export default function CustomersPage() {
  return (
    <Suspense>
      <CustomersInner />
    </Suspense>
  );
}
