"use client";

import { useEffect, useState } from "react";
import { PackageCheck } from "lucide-react";
import type { Purchase } from "@/types";
import { useInventory } from "@/context/InventoryContext";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/Overlay";
import { Button } from "@/components/ui/Button";
import { Field, Textarea } from "@/components/ui/Field";
import { useSubmitGuard } from "@/hooks/useSubmitGuard";

/**
 * Receive goods against a purchase order. Supports full or partial receipt;
 * quantities are capped at the remaining ordered amount per line.
 */
export function ReceivePurchaseDialog({ open, onClose, purchase }: { open: boolean; onClose: () => void; purchase: Purchase | null }) {
  const { state, actions } = useInventory();
  const [qty, setQty] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { guard, pending, release } = useSubmitGuard();
  const purchaseId = purchase?.id;

  const remainingOf = (i: Purchase["items"][number]) => i.quantity - i.receivedQty;

  useEffect(() => {
    // Initialise once per opening, not on every state change while open.
    if (open && purchase) {
      setQty(Object.fromEntries(purchase.items.map((i) => [i.productId, String(remainingOf(i))])));
      setNote("");
      setErrors({});
      release();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, purchaseId]);

  if (!purchase) return null;
  const warehouse = state.warehouses.find((w) => w.id === purchase.warehouseId);
  const openLines = purchase.items.filter((i) => remainingOf(i) > 0);
  const totalUnits = openLines.reduce((s, i) => s + Math.min(Math.max(Number(qty[i.productId]) || 0, 0), remainingOf(i)), 0);
  const totals = {
    ordered: purchase.items.reduce((s, i) => s + i.quantity, 0),
    received: purchase.items.reduce((s, i) => s + i.receivedQty, 0),
  };

  const setAll = (mode: "all" | "none") =>
    setQty(Object.fromEntries(purchase.items.map((i) => [i.productId, mode === "all" ? String(remainingOf(i)) : "0"])));

  const submit = () =>
    guard(() => {
    const errs: Record<string, string> = {};
    const items: { productId: string; quantity: number }[] = [];
    for (const i of openLines) {
      const raw = qty[i.productId] ?? "0";
      const n = Number(raw);
      if (raw.trim() === "" || !Number.isInteger(n) || n < 0) errs[i.productId] = "Enter a whole number";
      else if (n > remainingOf(i)) errs[i.productId] = `Max ${remainingOf(i)}`;
      else if (n > 0) items.push({ productId: i.productId, quantity: n });
    }
    setErrors(errs);
    if (Object.keys(errs).length) return null;
    if (items.length === 0) {
      setErrors({ _form: "Enter a quantity for at least one product." });
      return null;
    }
    const po = actions.receivePurchaseItems({ purchaseId: purchase.id, items, note });
    if (po) onClose();
    return po;
    });

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={`Receive items · ${purchase.poNumber}`}
      description={`From ${purchase.supplierName} into ${warehouse?.name ?? "warehouse"}. Stock increases only by what you receive now.`}
      footer={
        <>
          <span className="mr-auto text-[12.5px] text-muted tabular">
            Receiving <span className="font-semibold text-ink">{totalUnits}</span> unit{totalUnits === 1 ? "" : "s"}
          </span>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} icon={<PackageCheck className="h-4 w-4" />} disabled={totalUnits <= 0} loading={pending}>
            Confirm receipt
          </Button>
        </>
      }
    >
      {/* Order-level picture: what has arrived, what this receipt adds, what is still to come. */}
      <div className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-[10px] border border-line bg-line sm:grid-cols-4">
        {[
          { label: "Ordered", value: totals.ordered, cls: "text-ink" },
          { label: "Already received", value: totals.received, cls: "text-success", dot: "bg-[#22a157]" },
          { label: "Receiving now", value: totalUnits, cls: "text-brand", dot: "bg-brand" },
          { label: "Still to come", value: Math.max(totals.ordered - totals.received - totalUnits, 0), cls: "text-ink-2", dot: "bg-[#d6d9e0]" },
        ].map((x) => (
          <div key={x.label} className="bg-surface px-3.5 py-2.5">
            <div className="flex items-center gap-1.5 text-[11.5px] text-muted">
              {x.dot && <span className={cn("h-2 w-2 rounded-[3px]", x.dot)} />}
              {x.label}
            </div>
            <div className={cn("mt-0.5 text-[17px] font-semibold tabular", x.cls)}>{x.value}</div>
          </div>
        ))}
      </div>

      <div className="mb-2 flex items-center justify-between">
        <span className="text-[12.5px] font-medium text-ink-2">
          {openLines.length} line{openLines.length === 1 ? "" : "s"} awaiting delivery
        </span>
        <div className="flex gap-1">
          <Button size="xs" variant="ghost" onClick={() => setAll("all")}>
            Receive all remaining
          </Button>
          <Button size="xs" variant="ghost" onClick={() => setAll("none")}>
            Clear
          </Button>
        </div>
      </div>
      <div className="overflow-hidden rounded-[10px] border border-line">
        <div className="hidden grid-cols-[minmax(0,1fr)_64px_84px_120px] gap-4 border-b border-line bg-subtle px-3.5 py-2 text-[11px] font-medium tracking-[0.06em] text-muted uppercase sm:grid">
          <span>Product</span>
          <span className="text-right">Ordered</span>
          <span className="text-right">Received</span>
          <span className="text-right">Receive now</span>
        </div>
        <ul className="divide-y divide-line">
          {purchase.items.map((i) => {
            const remaining = remainingOf(i);
            const done = remaining <= 0;
            const now = Math.min(Math.max(Number(qty[i.productId]) || 0, 0), remaining);
            const pct = (n: number) => `${i.quantity ? (n / i.quantity) * 100 : 0}%`;
            const after = i.receivedQty + now;
            return (
              <li key={i.productId} className={cn("px-3.5 py-3", done && "bg-subtle/60")}>
                <div className="grid grid-cols-2 items-center gap-x-4 gap-y-2 sm:grid-cols-[minmax(0,1fr)_64px_72px_120px]">
                  <div className="col-span-2 min-w-0 sm:col-span-1">
                    <div className="truncate text-[13px] font-medium text-ink" title={i.name}>
                      {i.name}
                    </div>
                    <div className="font-mono text-[11.5px] text-muted">{i.sku}</div>
                  </div>
                  <div className="text-[12.5px] text-ink-2 tabular sm:text-right">
                    <span className="text-muted sm:hidden">Ordered </span>
                    {i.quantity}
                  </div>
                  <div className="text-right text-[12.5px] tabular">
                    <span className="text-muted sm:hidden">Already received </span>
                    <span className={i.receivedQty > 0 ? "font-medium text-success" : "text-muted"}>{i.receivedQty}</span>
                  </div>
                  <div className="col-span-2 sm:col-span-1 sm:text-right">
                    {done ? (
                      <span className="inline-flex items-center gap-1 text-[12px] font-medium text-success">Fully received</span>
                    ) : (
                      <div>
                        <div className="relative sm:ml-auto sm:w-[120px]">
                          <input
                            type="number"
                            min={0}
                            max={remaining}
                            step={1}
                            inputMode="numeric"
                            value={qty[i.productId] ?? ""}
                            onChange={(e) => setQty((q) => ({ ...q, [i.productId]: e.target.value }))}
                            onWheel={(e) => e.currentTarget.blur()}
                            aria-label={`Quantity of ${i.name} to receive now (${remaining} remaining)`}
                            aria-invalid={!!errors[i.productId] || undefined}
                            className="h-8 w-full rounded-[8px] border border-line-strong pr-14 pl-2.5 text-right text-[13px] font-medium tabular focus:border-brand focus:ring-[3px] focus:ring-brand/15 focus:outline-none aria-[invalid=true]:border-danger"
                          />
                          <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[11px] text-faint tabular">of {remaining}</span>
                        </div>
                        {errors[i.productId] && <div className="mt-1 text-[11.5px] text-danger">{errors[i.productId]}</div>}
                      </div>
                    )}
                  </div>
                </div>
                {/* Segmented progress: received · receiving now · still to come */}
                <div className="mt-2.5 flex items-center gap-3">
                  <div className="flex h-1.5 flex-1 gap-px overflow-hidden rounded-full bg-[#eceef2]" aria-hidden>
                    <span className="h-full bg-[#22a157] transition-all" style={{ width: pct(i.receivedQty) }} />
                    <span className="h-full bg-brand transition-all" style={{ width: pct(now) }} />
                  </div>
                  <span className="w-[112px] shrink-0 text-right text-[11.5px] text-muted tabular">
                    {done ? (
                      `${i.quantity}/${i.quantity} received`
                    ) : (
                      <>
                        After: <span className={cn("font-medium", after === i.quantity ? "text-success" : "text-ink")}>{after}</span>/{i.quantity}
                      </>
                    )}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      {errors._form && <p className="mt-2 text-[12.5px] text-danger">{errors._form}</p>}
      <Field label="Receiving note" className="mt-4">
        <Textarea rows={2} placeholder="Delivery challan no., condition of goods… (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </Modal>
  );
}
