"use client";

import Link from "next/link";
import { History } from "lucide-react";
import type { InventoryState, MovementType, StockMovement } from "@/types";
import { cn, formatDate } from "@/lib/utils";
import { Badge, type Tone } from "@/components/ui/Badge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/Primitives";

const TYPE_TONE: Record<MovementType, Tone> = {
  Opening: "neutral",
  Purchase: "success",
  Sale: "brand",
  "Sale Cancellation": "warning",
  Adjustment: "warning",
  Transfer: "info",
};

/** Resolve a movement reference to its source document. */
function referenceHref(state: InventoryState, m: StockMovement) {
  if (m.type === "Sale" || m.type === "Sale Cancellation") {
    const s = state.sales.find((x) => x.invoiceNo === m.reference);
    return s ? `/sales/${s.id}` : null;
  }
  if (m.type === "Purchase") {
    const p = state.purchases.find((x) => x.poNumber === m.reference);
    return p ? `/purchases/${p.id}` : null;
  }
  if (m.type === "Transfer") return "/transfers";
  return null;
}

export function MovementsTable({
  state,
  movements,
  showProduct = true,
  pageSize = 12,
  resetKey,
  compact,
}: {
  state: InventoryState;
  movements: StockMovement[];
  showProduct?: boolean;
  pageSize?: number;
  resetKey?: string;
  /** Narrow container (e.g. product detail): drop secondary columns until there is room. */
  compact?: boolean;
}) {
  const whName = (id: string) => state.warehouses.find((w) => w.id === id)?.name ?? "—";
  const columns: Column<StockMovement>[] = [
    {
      key: "date",
      header: "Date",
      sortValue: (m) => m.date,
      cell: (m) => (
        <div>
          <div className="text-ink">{formatDate(m.date)}</div>
          <div className="text-[11.5px] text-muted">{formatDate(m.date, "h:mm a")}</div>
        </div>
      ),
    },
    ...(showProduct
      ? [
          {
            key: "product",
            header: "Product",
            sortValue: (m: StockMovement) => m.productName,
            cell: (m: StockMovement) => {
              const exists = state.products.some((p) => p.id === m.productId);
              return (
                <div className="min-w-0">
                  {exists ? (
                    <Link href={`/products/${m.productId}`} className="block max-w-[200px] truncate font-medium text-ink hover:text-brand">
                      {m.productName}
                    </Link>
                  ) : (
                    <span className="block max-w-[200px] truncate font-medium text-ink-2">{m.productName}</span>
                  )}
                  <span className="font-mono text-[11.5px] text-muted">{m.sku}</span>
                </div>
              );
            },
          } satisfies Column<StockMovement>,
        ]
      : []),
    { key: "type", header: "Type", sortValue: (m) => m.type, cell: (m) => <Badge tone={TYPE_TONE[m.type]}>{m.type}</Badge> },
    {
      key: "ref",
      header: "Reference",
      cell: (m) => {
        const href = referenceHref(state, m);
        return (
          <div className="min-w-0">
            {href ? (
              <Link href={href} className="font-mono text-[12px] font-medium text-brand hover:underline">
                {m.reference}
              </Link>
            ) : (
              <span className="font-mono text-[12px] text-ink-2">{m.reference}</span>
            )}
            <div className="max-w-[220px] truncate text-[11.5px] text-muted" title={m.note}>
              {whName(m.warehouseId)}
              {m.note ? ` · ${m.note}` : ""}
            </div>
          </div>
        );
      },
    },
    {
      key: "qty",
      header: "Change",
      align: "right",
      sortValue: (m) => m.quantity,
      cell: (m) => (
        <span className={cn("font-semibold tabular", m.quantity > 0 ? "text-success" : "text-danger")}>
          {m.quantity > 0 ? "+" : "−"}
          {Math.abs(m.quantity)}
        </span>
      ),
    },
    { key: "prev", header: "Previous", align: "right", hideBelow: compact ? "wide" : "desktop", cell: (m) => <span className="text-muted tabular">{m.previousStock}</span> },
    { key: "new", header: "New stock", align: "right", cell: (m) => <span className="font-medium text-ink tabular">{m.newStock}</span> },
  ];

  return (
    <DataTable
      rows={movements}
      columns={columns}
      rowKey={(m) => m.id}
      pageSize={pageSize}
      resetKey={resetKey}
      mobilePrimary={showProduct ? "product" : "type"}
      mobileTrailing="qty"
      empty={<EmptyState icon={<History />} title="No stock movements" description="Sales, receipts, adjustments and transfers will be recorded here." />}
    />
  );
}
