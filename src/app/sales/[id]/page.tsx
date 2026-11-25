"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Ban, CheckCircle2, CircleDollarSign, Printer } from "lucide-react";
import { useInventory } from "@/context/InventoryContext";
import { cn, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { NotFoundState } from "@/components/ui/NotFoundState";
import { PageHeader } from "@/components/ui/Primitives";
import { RecordPaymentDialog } from "@/components/inventory/RecordPaymentDialog";
import { Logo } from "@/components/layout/Logo";

function InvoiceInner() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const { state, actions } = useInventory();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const sale = state.sales.find((s) => s.id === id);

  const printed = useRef(false);
  const found = !!sale;
  useEffect(() => {
    if (found && params.get("print") === "1" && !printed.current) {
      printed.current = true;
      // Not cleared on cleanup: React strict mode re-runs effects in dev.
      setTimeout(() => window.print(), 350);
    }
  }, [found, params]);

  if (!sale) return <NotFoundState entity="Invoice" backHref="/sales" />;

  const customer = state.customers.find((c) => c.id === sale.customerId);
  const warehouse = state.warehouses.find((w) => w.id === sale.warehouseId);
  const biz = state.settings;
  const due = Math.max(0, sale.total - sale.amountPaid);
  const cancelled = sale.status === "Cancelled";
  const halfTax = sale.taxAmount / 2;

  return (
    <>
      <PageHeader
        className="no-print"
        back={{ href: "/sales", label: "Sales" }}
        meta={
          <>
            <StatusBadge status={sale.status} />
            {!cancelled && <StatusBadge status={sale.paymentStatus} />}
          </>
        }
        title={sale.invoiceNo}
        description={`${sale.customerName} · created ${formatDateTime(sale.createdAt)} · ${warehouse?.name ?? ""}`}
        actions={
        <>
          {sale.status === "Pending" && (
            <Button variant="secondary" icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => actions.completeSale(sale.id)}>
              Mark completed
            </Button>
          )}
          {!cancelled && due > 0 && (
            <Button variant="secondary" icon={<CircleDollarSign className="h-4 w-4" />} onClick={() => setPayOpen(true)}>
              Record payment
            </Button>
          )}
          {!cancelled && (
            <Button variant="secondary" icon={<Ban className="h-4 w-4" />} onClick={() => setCancelOpen(true)} className="text-danger hover:text-danger">
              Cancel sale
            </Button>
          )}
          <Button icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>
            Print invoice
          </Button>
        </>
        }
      />

      {cancelled && (
        <div className="no-print mb-5 rounded-card border border-line bg-surface px-4 py-3 text-body text-ink-2">
          <span className="font-medium text-ink">Cancelled {formatDateTime(sale.cancelledAt)}</span>
          {sale.cancelReason ? ` — ${sale.cancelReason}` : ""}. Stock for all items was returned to {warehouse?.name}.
        </div>
      )}

      <Card className="print-area relative mx-auto max-w-[880px] overflow-hidden">
        {cancelled && (
          <div className="pointer-events-none absolute top-24 right-[-48px] rotate-[30deg] border-y-2 border-danger/30 px-16 py-1 text-[22px] font-bold tracking-[0.3em] text-danger/30">
            CANCELLED
          </div>
        )}
        <div className="h-1.5 bg-brand" />
        <div className="p-6 sm:p-10">
          {/* Header */}
          <div className="flex flex-col justify-between gap-6 sm:flex-row">
            <div>
              <div className="flex items-center gap-2.5">
                <Logo size={34} />
                <div>
                  <div className="text-title font-semibold tracking-[-0.01em] text-ink">{biz.businessName}</div>
                  <div className="text-small text-muted">{biz.legalName}</div>
                </div>
              </div>
              <div className="mt-3 max-w-[280px] text-small leading-relaxed text-muted">
                {biz.address}
                <br />
                {biz.phone} · {biz.email}
                {biz.gstin && (
                  <>
                    <br />
                    GSTIN <span className="font-mono text-ink-2">{biz.gstin}</span>
                  </>
                )}
              </div>
            </div>
            <div className="sm:text-right">
              <div className="text-micro font-semibold tracking-[0.14em] text-brand uppercase">Tax invoice</div>
              <div className="mt-1 font-mono text-[20px] font-semibold text-ink">{sale.invoiceNo}</div>
              <dl className="mt-3 grid grid-cols-[auto_auto] gap-x-4 gap-y-1 text-small sm:justify-end">
                <dt className="text-muted">Invoice date</dt>
                <dd className="font-medium text-ink">{formatDate(sale.date)}</dd>
                <dt className="text-muted">Payment</dt>
                <dd className="font-medium text-ink">{sale.paymentMethod}</dd>
                <dt className="text-muted">Status</dt>
                <dd className={cn("font-medium", cancelled ? "text-muted" : sale.paymentStatus === "Paid" ? "text-success" : "text-warning")}>{cancelled ? "Cancelled" : sale.paymentStatus}</dd>
              </dl>
            </div>
          </div>

          {/* Bill to */}
          <div className="mt-8 grid gap-6 rounded-card bg-subtle p-5 sm:grid-cols-2">
            <div>
              <div className="text-micro font-semibold tracking-[0.1em] text-faint uppercase">Bill to</div>
              <div className="mt-1.5 text-title-sm font-semibold text-ink">
                {customer ? (
                  <Link href={`/customers/${customer.id}`} className="hover:text-brand">
                    {customer.company || sale.customerName}
                  </Link>
                ) : (
                  sale.customerName
                )}
              </div>
              {customer?.company && <div className="text-small text-ink-2">Attn: {customer.name}</div>}
              {customer && <div className="mt-1 max-w-[300px] text-small leading-relaxed text-muted">{customer.address}</div>}
            </div>
            {customer && (
              <div className="text-small sm:text-right">
                <div className="text-micro font-semibold tracking-[0.1em] text-faint uppercase">Contact</div>
                <div className="mt-1.5 text-ink-2">{customer.email}</div>
                <div className="text-ink-2">{customer.phone}</div>
                {customer.gstin && (
                  <div className="mt-1 text-muted">
                    GSTIN <span className="font-mono text-ink-2">{customer.gstin}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Items */}
          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[520px] text-body">
              <thead>
                <tr className="border-b-2 border-ink text-left text-micro font-semibold tracking-wide text-ink uppercase">
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">Item</th>
                  <th className="py-2 pr-3 text-right">Qty</th>
                  <th className="py-2 pr-3 text-right">Rate</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {sale.items.map((i, idx) => (
                  <tr key={i.productId} className="border-b border-line">
                    <td className="py-3 pr-3 text-muted tabular">{idx + 1}</td>
                    <td className="py-3 pr-3">
                      <div className="font-medium text-ink">{i.name}</div>
                      <div className="font-mono text-caption text-muted">{i.sku}</div>
                    </td>
                    <td className="py-3 pr-3 text-right tabular">
                      {i.quantity} <span className="text-muted">{i.unit}</span>
                    </td>
                    <td className="py-3 pr-3 text-right tabular">{formatCurrency(i.unitPrice)}</td>
                    <td className="py-3 text-right font-medium text-ink tabular">{formatCurrency(i.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="mt-6 flex flex-col-reverse justify-between gap-6 sm:flex-row">
            <div className="max-w-[340px] text-small leading-relaxed text-muted">
              {sale.notes && (
                <>
                  <div className="text-micro font-semibold tracking-[0.1em] text-faint uppercase">Notes</div>
                  <p className="mt-1 text-ink-2">{sale.notes}</p>
                </>
              )}
              <p className="mt-4">Thank you for your business. Goods once sold will be exchanged only as per warranty terms.</p>
            </div>
            <dl className="w-full space-y-2 text-body sm:w-[300px]">
              <div className="flex justify-between">
                <dt className="text-muted">Subtotal</dt>
                <dd className="tabular">{formatCurrency(sale.subtotal)}</dd>
              </div>
              {sale.discountAmount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted">Discount{sale.discountType === "percent" ? ` (${sale.discountValue}%)` : ""}</dt>
                  <dd className="tabular">− {formatCurrency(sale.discountAmount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted">CGST ({sale.taxRate / 2}%)</dt>
                <dd className="tabular">{formatCurrency(halfTax)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">SGST ({sale.taxRate / 2}%)</dt>
                <dd className="tabular">{formatCurrency(sale.taxAmount - halfTax)}</dd>
              </div>
              <div className="flex items-baseline justify-between border-t-2 border-ink pt-2.5">
                <dt className="font-semibold text-ink">Grand total</dt>
                <dd className="text-[19px] font-semibold text-ink tabular">{formatCurrency(sale.total)}</dd>
              </div>
              {!cancelled && (
                <>
                  <div className="flex justify-between pt-1">
                    <dt className="text-muted">Amount paid</dt>
                    <dd className="text-success tabular">{formatCurrency(sale.amountPaid)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="font-medium text-ink">Balance due</dt>
                    <dd className={cn("font-semibold tabular", due > 0 ? "text-danger" : "text-ink")}>{formatCurrency(due)}</dd>
                  </div>
                </>
              )}
            </dl>
          </div>

          <div className="mt-10 flex items-end justify-between border-t border-line pt-5 text-caption text-faint">
            <span>Computer-generated invoice · {biz.businessName}</span>
            <span className="text-right">
              For {biz.businessName}
              <br />
              <span className="mt-6 inline-block border-t border-line-strong pt-1">Authorised signatory</span>
            </span>
          </div>
        </div>
      </Card>

      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title={`Cancel ${sale.invoiceNo}?`}
        description={`${sale.items.reduce((n, i) => n + i.quantity, 0)} units will be returned to ${warehouse?.name}. This cannot be undone.`}
        reasonLabel="Reason for cancellation"
        confirmLabel="Cancel sale"
        onConfirm={(reason) => actions.cancelSale(sale.id, reason) !== null}
      />
      <RecordPaymentDialog open={payOpen} sale={sale} onClose={() => setPayOpen(false)} />
    </>
  );
}

export default function InvoicePage() {
  return (
    <Suspense>
      <InvoiceInner />
    </Suspense>
  );
}
