"use client";

import { useNavigate } from "@/hooks/useNavigate";
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Ban, CheckCircle2, FileClock, PackageCheck, Printer, Send, Trash2, Truck } from "lucide-react";
import { useInventory } from "@/context/InventoryContext";
import { isOverdue, purchaseProgress, receivedValue } from "@/lib/selectors";
import { cn, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { KeyValue, PageHeader, ProductThumb } from "@/components/ui/Primitives";
import { NotFoundState } from "@/components/ui/NotFoundState";
import { ReceivePurchaseDialog } from "@/components/inventory/ReceivePurchaseDialog";

const STEPS = ["Draft", "Ordered", "Receiving", "Received"] as const;

export default function PurchaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { state, actions } = useInventory();
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const po = state.purchases.find((p) => p.id === id);
  if (!po) return <NotFoundState entity="Purchase order" backHref="/purchases" />;

  const supplier = state.suppliers.find((s) => s.id === po.supplierId);
  const warehouse = state.warehouses.find((w) => w.id === po.warehouseId);
  const progress = purchaseProgress(po);
  const open = po.status === "Pending" || po.status === "Partially Received";
  const overdue = isOverdue(po);
  const stepIndex = po.status === "Draft" ? 0 : po.status === "Pending" ? 1 : po.status === "Partially Received" ? 2 : po.status === "Received" ? 3 : -1;

  return (
    <>
      <PageHeader
        className="no-print"
        back={{ href: "/purchases", label: "Purchases" }}
        meta={
          <>
            <StatusBadge status={po.status} />
            {overdue && <Badge tone="danger">Overdue</Badge>}
          </>
        }
        title={po.poNumber}
        description={`${po.supplierName} · created ${formatDateTime(po.createdAt)}`}
        actions={
        <>
          {po.status === "Draft" && (
            <>
              <Button variant="secondary" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDeleteOpen(true)} className="text-danger hover:text-danger">
                Delete draft
              </Button>
              <Button icon={<Send className="h-4 w-4" />} onClick={() => actions.placePurchaseOrder(po.id)}>
                Place order
              </Button>
            </>
          )}
          {open && (
            <Button variant="secondary" icon={<Ban className="h-4 w-4" />} onClick={() => setCancelOpen(true)} className="text-danger hover:text-danger">
              Cancel order
            </Button>
          )}
          <Button variant="secondary" icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>
            Print
          </Button>
          {open && (
            <Button icon={<PackageCheck className="h-4 w-4" />} onClick={() => setReceiveOpen(true)}>
              Receive items
            </Button>
          )}
        </>
        }
      />

      {/* Progress tracker */}
      {po.status !== "Cancelled" ? (
        <Card className="no-print mb-5 px-5 py-4">
          <ol className="grid grid-cols-4 gap-2">
            {STEPS.map((s, i) => {
              const done = i < stepIndex || (i === stepIndex && po.status === "Received");
              const current = i === stepIndex && po.status !== "Received";
              return (
                <li key={s} className="flex flex-col gap-2">
                  <div className={cn("h-1.5 rounded-full", done ? "bg-success-solid" : current ? "bg-brand" : "bg-pressed")} />
                  <span className={cn("text-small font-medium", done ? "text-success" : current ? "text-brand" : "text-faint")}>
                    {s}
                    {s === "Receiving" && progress.received > 0 && progress.remaining > 0 && <span className="ml-1 text-muted">({progress.pct}%)</span>}
                  </span>
                </li>
              );
            })}
          </ol>
        </Card>
      ) : (
        <div className="no-print mb-5 rounded-card border border-line bg-surface px-4 py-3 text-body text-ink-2">
          <span className="font-medium text-ink">Cancelled {formatDateTime(po.cancelledAt)}.</span>{" "}
          {progress.received > 0 ? `${progress.received} units received before cancellation remain in stock.` : "No stock was received on this order."}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <Card className="print-area overflow-hidden">
            <CardHeader title="Order items" description={`${progress.received} of ${progress.ordered} units received · ${progress.remaining} remaining`} />
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full min-w-[640px] text-body">
                <thead>
                  <tr className="border-y border-line bg-subtle text-left text-caption font-medium tracking-wide text-muted uppercase">
                    <th className="h-9 px-5">Product</th>
                    <th className="px-3 text-right">Ordered</th>
                    <th className="px-3 text-right">Received</th>
                    <th className="px-3 text-right">Remaining</th>
                    <th className="px-3 text-right">Unit cost</th>
                    <th className="px-5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {po.items.map((i) => {
                    const remaining = i.quantity - i.receivedQty;
                    const p = state.products.find((x) => x.id === i.productId);
                    return (
                      <tr key={i.productId} className="border-b border-line last:border-0">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <ProductThumb name={i.name} category={p?.category ?? ""} size={30} />
                            <div>
                              {p ? (
                                <Link href={`/products/${p.id}`} className="font-medium text-ink hover:text-brand">
                                  {i.name}
                                </Link>
                              ) : (
                                <span className="font-medium text-ink">{i.name}</span>
                              )}
                              <div className="font-mono text-caption text-muted">{i.sku}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 text-right tabular">{i.quantity}</td>
                        <td className="px-3 text-right tabular">
                          <span className={i.receivedQty > 0 ? "font-medium text-success" : "text-muted"}>{i.receivedQty}</span>
                        </td>
                        <td className="px-3 text-right tabular">
                          {remaining === 0 ? <CheckCircle2 className="ml-auto h-4 w-4 text-success" /> : <span className={po.status === "Cancelled" ? "text-faint line-through" : "font-medium text-ink"}>{remaining}</span>}
                        </td>
                        <td className="px-3 text-right tabular">{formatCurrency(i.unitCost)}</td>
                        <td className="px-5 text-right font-medium text-ink tabular">{formatCurrency(i.total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <dl className="ml-auto w-full max-w-[320px] space-y-2 border-t border-line px-5 py-4 text-body">
              <div className="flex justify-between">
                <dt className="text-muted">Subtotal</dt>
                <dd className="tabular">{formatCurrency(po.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">GST ({po.taxRate}%)</dt>
                <dd className="tabular">{formatCurrency(po.taxAmount)}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-2">
                <dt className="font-semibold text-ink">Total amount</dt>
                <dd className="text-title font-semibold text-ink tabular">{formatCurrency(po.total)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Received value</dt>
                <dd className="font-medium text-success tabular">{formatCurrency(receivedValue(po))}</dd>
              </div>
            </dl>
          </Card>

          <Card>
            <CardHeader title="Receiving history" description="Each goods receipt (GRN) added stock to inventory." />
            <CardBody>
              {po.receipts.length === 0 ? (
                <div className="flex items-center gap-3 rounded-panel border border-dashed border-line-strong px-4 py-5 text-body text-muted">
                  <Truck className="h-5 w-5 text-faint" />
                  {po.status === "Draft" ? "Place this order before receiving goods." : po.status === "Cancelled" ? "No goods were received." : "No goods received yet. Inventory is unchanged."}
                </div>
              ) : (
                <ol className="space-y-3">
                  {[...po.receipts].reverse().map((r) => (
                    <li key={r.id} className="rounded-panel border border-line p-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          <span className="grid h-7 w-7 place-items-center rounded-full bg-success-bg text-success">
                            <PackageCheck className="h-3.5 w-3.5" />
                          </span>
                          <span className="font-mono text-small font-medium text-ink">{r.reference}</span>
                        </span>
                        <span className="text-small text-muted">{formatDateTime(r.date)}</span>
                      </div>
                      <ul className="mt-2 space-y-1 pl-9 text-small">
                        {r.items.map((it) => (
                          <li key={it.productId} className="flex justify-between text-ink-2">
                            <span>{po.items.find((x) => x.productId === it.productId)?.name}</span>
                            <span className="font-medium text-success tabular">+{it.quantity}</span>
                          </li>
                        ))}
                      </ul>
                      {r.note && <p className="mt-2 pl-9 text-small text-muted">{r.note}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Order details" />
            <CardBody>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5">
                <KeyValue label="Order date">{formatDate(po.orderDate)}</KeyValue>
                <KeyValue label="Expected">
                  <span className={overdue ? "text-danger" : undefined}>{formatDate(po.expectedDate)}</span>
                </KeyValue>
                <KeyValue label="Deliver to">{warehouse?.name}</KeyValue>
                <KeyValue label="Progress">{progress.pct}%</KeyValue>
                {po.notes && (
                  <KeyValue label="Notes" className="col-span-2">
                    <span className="font-normal text-ink-2">{po.notes}</span>
                  </KeyValue>
                )}
              </dl>
            </CardBody>
          </Card>
          {supplier && (
            <Card>
              <CardHeader title="Supplier" actions={<ButtonLink href={`/suppliers/${supplier.id}`} variant="ghost" size="sm">View</ButtonLink>} />
              <CardBody className="space-y-1 text-body">
                <div className="font-medium text-ink">{supplier.name}</div>
                <div className="text-ink-2">{supplier.contactPerson}</div>
                <div className="text-muted">{supplier.email}</div>
                <div className="text-muted">{supplier.phone}</div>
                <div className="pt-1 text-small text-muted">
                  Terms: <span className="text-ink-2">{supplier.paymentTerms}</span>
                </div>
              </CardBody>
            </Card>
          )}
          {po.status === "Draft" && (
            <div className="flex gap-2.5 rounded-card border border-line bg-surface p-3.5 text-small text-muted">
              <FileClock className="mt-0.5 h-4 w-4 shrink-0 text-faint" />
              This is a draft. Place the order to start receiving stock against it.
            </div>
          )}
        </div>
      </div>

      <ReceivePurchaseDialog open={receiveOpen} purchase={po} onClose={() => setReceiveOpen(false)} />
      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title={`Cancel ${po.poNumber}?`}
        description={
          progress.received > 0
            ? `${progress.received} units already received stay in stock. The remaining ${progress.remaining} units will no longer be expected.`
            : "Nothing has been received, so inventory will not change."
        }
        confirmLabel="Cancel order"
        onConfirm={() => actions.cancelPurchase(po.id) !== null}
      />
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={`Delete draft ${po.poNumber}?`}
        description="This draft will be permanently removed."
        confirmLabel="Delete draft"
        onConfirm={() => {
          const ok = actions.deletePurchaseDraft(po.id) !== null;
          if (ok) navigate("/purchases");
          return ok;
        }}
      />
    </>
  );
}
