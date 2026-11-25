"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeftRight, ArrowRight, Ban, CheckCircle2, MapPin, MoreHorizontal, PackageCheck, Plus, Star, Truck, Warehouse as WarehouseIcon } from "lucide-react";
import type { Transfer } from "@/types";
import { useInventory } from "@/context/InventoryContext";
import { getWarehouseStats } from "@/lib/selectors";
import { cn, formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { Dropdown } from "@/components/ui/Dropdown";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState, FilterSelect, PageHeader, SearchInput, Segmented, Toolbar } from "@/components/ui/Primitives";
import { TransferDialog } from "@/components/inventory/TransferDialog";

export default function TransfersPage() {
  const { state, actions } = useInventory();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [route, setRoute] = useState("all");
  const [toCancel, setToCancel] = useState<Transfer | null>(null);

  const whName = (id: string) => state.warehouses.find((w) => w.id === id)?.name ?? "—";

  const warehouseStats = useMemo(() => getWarehouseStats(state), [state]);
  const inTransit = state.transfers.filter((t) => t.status === "In Transit");
  const inTransitUnits = inTransit.reduce((s, t) => s + t.quantity, 0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.transfers.filter(
      (t) =>
        (!q || t.reference.toLowerCase().includes(q) || t.productName.toLowerCase().includes(q) || t.sku.toLowerCase().includes(q)) &&
        (status === "all" || t.status === status) &&
        (route === "all" || `${t.fromWarehouseId}>${t.toWarehouseId}` === route),
    );
  }, [state.transfers, query, status, route]);

  const routes = state.warehouses.flatMap((a) => state.warehouses.filter((b) => b.id !== a.id).map((b) => ({ value: `${a.id}>${b.id}`, label: `${a.name.replace(" Warehouse", "")} → ${b.name.replace(" Warehouse", "")}` })));

  const columns: Column<Transfer>[] = [
    { key: "ref", header: "Reference", sortValue: (t) => t.reference, cell: (t) => <span className="font-mono text-label font-medium text-ink">{t.reference}</span> },
    {
      key: "product",
      header: "Product",
      sortValue: (t) => t.productName,
      cell: (t) => (
        <div className="min-w-0">
          {state.products.some((p) => p.id === t.productId) ? (
            <Link href={`/products/${t.productId}`} className="block max-w-[200px] truncate font-medium text-ink hover:text-brand">
              {t.productName}
            </Link>
          ) : (
            <span className="block max-w-[200px] truncate font-medium text-ink">{t.productName}</span>
          )}
          <span className="font-mono text-label text-muted">{t.sku}</span>
        </div>
      ),
    },
    {
      key: "route",
      header: "From → To",
      cell: (t) => (
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex items-center rounded-md border border-line bg-subtle px-1.5 py-0.5 text-label text-ink-2" title={`From ${whName(t.fromWarehouseId)}`}>
            <span className="sr-only">From </span>
            {whName(t.fromWarehouseId).replace(" Warehouse", "")}
          </span>
          <ArrowRight className="h-3.5 w-3.5 text-faint" />
          <span className="inline-flex items-center rounded-md border border-brand-100 bg-brand-50 px-1.5 py-0.5 text-label font-medium text-brand-700" title={`To ${whName(t.toWarehouseId)}`}>
            <span className="sr-only">To </span>
            {whName(t.toWarehouseId).replace(" Warehouse", "")}
          </span>
        </span>
      ),
    },
    { key: "qty", header: "Quantity", align: "right", sortValue: (t) => t.quantity, cell: (t) => <span className="font-semibold text-ink tabular">{t.quantity}</span> },
    { key: "date", hideBelow: "laptop", header: "Dispatched", sortValue: (t) => t.date, cell: (t) => formatDate(t.date) },
    {
      key: "status",
      header: "Status",
      sortValue: (t) => t.status,
      cell: (t) => (
        <div className="flex flex-col items-start gap-0.5">
          <StatusBadge status={t.status} />
          {t.completedAt && t.status === "Completed" && <span className="text-label text-faint">Received {formatDate(t.completedAt, "dd MMM")}</span>}
        </div>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (t) =>
        t.status === "In Transit" ? (
          <div className="flex items-center justify-end gap-1">
            <Button size="xs" variant="subtle" icon={<PackageCheck className="h-3.5 w-3.5" />} onClick={() => actions.completeTransfer(t.id)}>
              Receive
            </Button>
            <Dropdown
              width={190}
              items={[
                { label: "Mark as received", icon: <CheckCircle2 />, onSelect: () => actions.completeTransfer(t.id) },
                { label: "Cancel transfer", icon: <Ban />, danger: true, onSelect: () => setToCancel(t) },
              ]}
              trigger={({ toggle }) => (
                <Button size="icon-sm" variant="ghost" onClick={toggle} aria-label={`Actions for ${t.reference}`}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              )}
            />
          </div>
        ) : (
          <span className="sr-only">No actions</span>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Transfers"
        description="Move stock between your warehouses."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>
            New transfer
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {warehouseStats.map((w) => (
          <Card key={w.id}>
            <CardBody className="pt-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-panel bg-brand-50 text-brand">
                    <WarehouseIcon className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="flex items-center gap-1.5 text-h3 font-semibold text-ink">
                      {w.name}
                      {w.isDefault && <Star className="h-3.5 w-3.5 fill-warning-solid text-warning-solid" aria-label="Default warehouse" />}
                    </div>
                    <div className="flex items-center gap-1 text-label text-muted">
                      <MapPin className="h-3 w-3" /> {w.location} · {w.code}
                    </div>
                  </div>
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4">
                <div>
                  <dt className="text-label text-muted">Units</dt>
                  <dd className="text-h3 font-semibold text-ink tabular">{formatNumber(w.units)}</dd>
                </div>
                <div>
                  <dt className="text-label text-muted">SKUs</dt>
                  <dd className="text-h3 font-semibold text-ink tabular">{w.skus}</dd>
                </div>
                <div>
                  <dt className="text-label text-muted">Value</dt>
                  <dd className="text-h3 font-semibold text-ink tabular">{formatCurrency(w.value, { whole: true })}</dd>
                </div>
              </dl>
            </CardBody>
          </Card>
        ))}
        <Card className={cn(inTransit.length ? "border-info-line" : "")}>
          <CardBody className="pt-5">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-panel bg-info-bg text-info">
                <Truck className="h-5 w-5" />
              </span>
              <div>
                <div className="text-h3 font-semibold text-ink">In transit</div>
                <div className="text-label text-muted">Dispatched, not yet received</div>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4">
              <div>
                <dt className="text-label text-muted">Transfers</dt>
                <dd className="text-h3 font-semibold text-ink tabular">{inTransit.length}</dd>
              </div>
              <div>
                <dt className="text-label text-muted">Units</dt>
                <dd className="text-h3 font-semibold text-ink tabular">{inTransitUnits}</dd>
              </div>
            </dl>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-5 overflow-hidden">
        <div className="px-4 pt-4 md:px-5">
          <Segmented
            value={status}
            onChange={setStatus}
            options={[
              { value: "all", label: "All", count: state.transfers.length },
              { value: "In Transit", label: "In transit", count: inTransit.length },
              { value: "Completed", label: "Completed", count: state.transfers.filter((t) => t.status === "Completed").length },
              { value: "Cancelled", label: "Cancelled", count: state.transfers.filter((t) => t.status === "Cancelled").length },
            ]}
          />
        </div>
        <Toolbar>
          <SearchInput value={query} onChange={setQuery} placeholder="Search reference or product" />
          <FilterSelect label="Route" value={route} onChange={setRoute} options={[{ value: "all", label: "All routes" }, ...routes]} />
        </Toolbar>
        <DataTable
          rows={filtered}
          columns={columns}
          rowKey={(t) => t.id}
          resetKey={`${query}|${status}|${route}`}
          mobilePrimary="product"
          mobileTrailing="status"
          initialSort={{ key: "date", dir: "desc" }}
          empty={
            <EmptyState
              icon={<ArrowLeftRight />}
              title={state.transfers.length ? "No transfers match" : "No transfers yet"}
              description="Transfers keep total stock the same while moving it between locations."
              action={<Button onClick={() => setOpen(true)}>New transfer</Button>}
            />
          }
        />
      </Card>

      <TransferDialog open={open} onClose={() => setOpen(false)} />
      <ConfirmDialog
        open={!!toCancel}
        onClose={() => setToCancel(null)}
        title={`Cancel ${toCancel?.reference}?`}
        description={toCancel ? `${toCancel.quantity} × ${toCancel.productName} will be returned to ${whName(toCancel.fromWarehouseId)}.` : ""}
        confirmLabel="Cancel transfer"
        onConfirm={() => (toCancel ? actions.cancelTransfer(toCancel.id) !== null : false)}
      />
    </>
  );
}
