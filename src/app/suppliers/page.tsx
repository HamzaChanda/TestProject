"use client";

import { useNavigate } from "@/hooks/useNavigate";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, Download, Eye, MoreHorizontal, Pencil, Plus, ShoppingCart, Trash2 } from "lucide-react";
import type { Supplier } from "@/types";
import { useInventory } from "@/context/InventoryContext";
import { supplierDeleteBlocker } from "@/lib/inventory";
import { getSupplierStats } from "@/lib/selectors";
import { formatCurrency } from "@/lib/utils";
import { downloadCsv } from "@/lib/csv";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Dropdown } from "@/components/ui/Dropdown";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState, FilterSelect, PageHeader, SearchInput, Toolbar } from "@/components/ui/Primitives";
import { SupplierFormPanel } from "@/components/forms/PartyForms";

function SuppliersInner() {
  const { state, actions } = useInventory();
  const router = useRouter();
  const navigate = useNavigate();
  const params = useSearchParams();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [panel, setPanel] = useState<{ open: boolean; supplier: Supplier | null }>({ open: false, supplier: null });
  const [toDelete, setToDelete] = useState<Supplier | null>(null);

  useEffect(() => {
    if (params.get("new") === "1") {
      setPanel({ open: true, supplier: null });
      router.replace("/suppliers");
    }
  }, [params, router]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.suppliers
      .map((s) => ({ ...s, stats: getSupplierStats(state, s.id) }))
      .filter(
        (s) =>
          (!q || [s.name, s.contactPerson, s.email, s.city].some((f) => f.toLowerCase().includes(q))) &&
          (filter === "all" || (filter === "outstanding" ? s.stats.outstanding > 0 : s.paymentTerms === filter)),
      );
  }, [state, query, filter]);
  type Row = (typeof rows)[number];

  const columns: Column<Row>[] = [
    {
      key: "name",
      header: "Supplier",
      sortValue: (s) => s.name,
      cell: (s) => (
        <Link href={`/suppliers/${s.id}`} className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-[#fff1ea] text-[#c2410c]">
            <Building2 className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block max-w-[220px] truncate font-medium text-ink hover:text-brand">{s.name}</span>
            <span className="block text-[12px] text-muted">
              {s.city} · {s.paymentTerms}
            </span>
          </span>
        </Link>
      ),
    },
    { key: "contact", hideBelow: "laptop", header: "Contact person", sortValue: (s) => s.contactPerson, cell: (s) => s.contactPerson },
    { key: "email", hideBelow: "wide", header: "Email", cell: (s) => <span className="text-ink-2">{s.email}</span>, hideOnMobile: true },
    { key: "phone", header: "Phone", cell: (s) => <span className="tabular">{s.phone}</span> },
    { key: "total", header: "Total purchases", align: "right", sortValue: (s) => s.stats.total, cell: (s) => <span className="font-semibold text-ink tabular">{formatCurrency(s.stats.total)}</span> },
    {
      key: "outstanding",
      header: "Outstanding",
      align: "right",
      sortValue: (s) => s.stats.outstanding,
      cell: (s) => (s.stats.outstanding ? <Badge tone="warning">{s.stats.outstanding} open</Badge> : <span className="text-faint">—</span>),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (s) => (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <Dropdown
            width={200}
            items={[
              { label: "View details", icon: <Eye />, href: `/suppliers/${s.id}` },
              { label: "New purchase order", icon: <ShoppingCart />, href: `/purchases/new?supplier=${s.id}` },
              { label: "Edit supplier", icon: <Pencil />, onSelect: () => setPanel({ open: true, supplier: s }) },
              { label: "Delete supplier", icon: <Trash2 />, danger: true, separatorBefore: true, onSelect: () => setToDelete(s) },
            ]}
            trigger={({ toggle }) => (
              <Button size="icon-sm" variant="ghost" onClick={toggle} aria-label={`Actions for ${s.name}`}>
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
        title="Suppliers"
        description={`${state.suppliers.length} suppliers · ${rows.reduce((s, r) => s + r.stats.outstanding, 0)} open orders`}
        actions={
          <>
            <Button
              variant="secondary"
              icon={<Download className="h-4 w-4" />}
              onClick={() =>
                downloadCsv(
                  "suppliers",
                  rows.map((s) => ({ Name: s.name, "Contact Person": s.contactPerson, Email: s.email, Phone: s.phone, City: s.city, GSTIN: s.gstin, Terms: s.paymentTerms, "Total Purchases": s.stats.total, "Outstanding Orders": s.stats.outstanding })),
                )
              }
              disabled={!rows.length}
            >
              Export
            </Button>
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setPanel({ open: true, supplier: null })}>
              Add supplier
            </Button>
          </>
        }
      />
      <Card className="overflow-hidden">
        <Toolbar>
          <SearchInput value={query} onChange={setQuery} placeholder="Search supplier, contact or city" className="sm:w-[300px]" />
          <FilterSelect
            label="Filter"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All suppliers" },
              { value: "outstanding", label: "With open orders" },
              ...["Advance", "Net 15", "Net 30", "Net 45", "Net 60"].map((t) => ({ value: t, label: `Terms: ${t}` })),
            ]}
          />
        </Toolbar>
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(s) => s.id}
          onRowClick={(s) => navigate(`/suppliers/${s.id}`)}
          resetKey={`${query}|${filter}`}
          mobileTrailing="outstanding"
          initialSort={{ key: "total", dir: "desc" }}
          empty={
            state.suppliers.length === 0 ? (
              <EmptyState icon={<Building2 />} title="No suppliers yet" description="Add suppliers to create purchase orders." action={<Button onClick={() => setPanel({ open: true, supplier: null })}>Add supplier</Button>} />
            ) : (
              <EmptyState icon={<Building2 />} title="No suppliers match" description="Try a different search or filter." />
            )
          }
        />
      </Card>
      <SupplierFormPanel open={panel.open} supplier={panel.supplier} onClose={() => setPanel({ open: false, supplier: null })} />
      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title={`Delete ${toDelete?.name}?`}
        blockedReason={toDelete ? supplierDeleteBlocker(state, toDelete.id) : null}
        description="This supplier will be removed and unlinked from any products."
        confirmLabel="Delete supplier"
        onConfirm={() => (toDelete ? actions.deleteSupplier(toDelete.id) !== null : false)}
      />
    </>
  );
}

export default function SuppliersPage() {
  return (
    <Suspense>
      <SuppliersInner />
    </Suspense>
  );
}
