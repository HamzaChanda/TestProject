"use client";

import { useNavigate } from "@/hooks/useNavigate";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { AlertCircle, Minus, Plus, ReceiptText, Trash2, UserPlus, Warehouse } from "lucide-react";
import { useInventory } from "@/context/InventoryContext";
import { saleSchema, type SaleFormValues } from "@/lib/validations";
import { computeSaleTotals, lineTotal } from "@/lib/calc";
import { PAYMENT_METHODS, TAX_PRESETS } from "@/lib/constants";
import { cn, currencySymbol, formatCurrency, toIsoDate } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Avatar, EmptyState, PageHeader, ProductThumb } from "@/components/ui/Primitives";
import { FormSection } from "@/components/forms/FormSection";
import { ProductPicker } from "@/components/forms/ProductPicker";
import { CustomerFormPanel } from "@/components/forms/PartyForms";
import { getCustomerStats } from "@/lib/selectors";
import { useSubmitGuard } from "@/hooks/useSubmitGuard";

function NewSaleInner() {
  const { state, actions } = useInventory();
  const router = useRouter();
  const navigate = useNavigate();
  const params = useSearchParams();
  const [customerPanel, setCustomerPanel] = useState(false);
  const { guard, pending } = useSubmitGuard();
  const defaultWh = state.warehouses.find((w) => w.isDefault)?.id ?? state.warehouses[0].id;

  const form = useForm<SaleFormValues>({
    resolver: zodResolver(saleSchema),
    defaultValues: {
      customerId: params.get("customer") ?? "",
      date: format(new Date(), "yyyy-MM-dd"),
      warehouseId: defaultWh,
      items: [],
      discountType: "percent",
      discountValue: 0,
      taxRate: state.settings.defaultTaxRate,
      paymentMethod: "UPI",
      paymentStatus: "Paid",
      amountPaid: undefined,
      orderStatus: "Completed",
      notes: "",
    },
  });
  const { register, control, handleSubmit, setValue, setError, formState } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const errors = formState.errors;

  const watched = useWatch({ control });
  const items = watched.items ?? [];
  const warehouseId = watched.warehouseId ?? defaultWh;
  const customer = state.customers.find((c) => c.id === watched.customerId);
  const productMap = useMemo(() => new Map(state.products.map((p) => [p.id, p])), [state.products]);
  const availableOf = (productId: string) => productMap.get(productId)?.stock[warehouseId] ?? 0;

  const totals = computeSaleTotals(
    items.map((i) => ({ quantity: Number(i?.quantity) || 0, price: Number(i?.price) || 0 })),
    watched.discountType ?? "percent",
    Number(watched.discountValue) || 0,
    Number(watched.taxRate) || 0,
  );
  const stockIssues = items
    .map((i) => (i?.productId && (Number(i.quantity) || 0) > availableOf(i.productId) ? i.productId : null))
    .filter(Boolean) as string[];
  const units = items.reduce((s, i) => s + (Number(i?.quantity) || 0), 0);

  const onSubmit = (v: SaleFormValues) =>
    guard(() => {
    // Front-line check — the engine re-validates atomically.
    for (const [idx, line] of v.items.entries()) {
      const available = availableOf(line.productId);
      if (line.quantity > available) {
        setError(`items.${idx}.quantity`, { message: `Insufficient stock. Available quantity: ${available}` });
        return null;
      }
    }
    if (v.paymentStatus === "Partial" && !(v.amountPaid && v.amountPaid > 0 && v.amountPaid < totals.total)) {
      setError("amountPaid", { message: "Enter an amount between 0 and the grand total" });
      return null;
    }
    const sale = actions.createSale({
      customerId: v.customerId,
      date: toIsoDate(v.date),
      warehouseId: v.warehouseId,
      items: v.items.map((i) => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.price })),
      discountType: v.discountType,
      discountValue: v.discountValue,
      taxRate: v.taxRate,
      paymentMethod: v.paymentMethod,
      paymentStatus: v.paymentStatus,
      amountPaid: v.amountPaid,
      status: v.orderStatus,
      notes: v.notes,
    });
    if (sale) navigate(`/sales/${sale.id}`);
    return sale;
    });

  const sym = currencySymbol();
  const customerStats = customer ? getCustomerStats(state, customer.id) : null;

  return (
    <>
      <PageHeader title="New sale" description="Create an invoice. Stock is deducted from the selected warehouse when you confirm." />
      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          {/* 1. Customer */}
          <FormSection
            step={1}
            title="Customer"
            description="Who is this sale for?"
            complete={!!customer}
            actions={
              <Button size="sm" variant="ghost" icon={<UserPlus className="h-3.5 w-3.5" />} onClick={() => setCustomerPanel(true)}>
                New customer
              </Button>
            }
          >
            <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
              <Field label="Customer" required error={errors.customerId?.message}>
                <Select {...register("customerId")} invalid={!!errors.customerId}>
                  <option value="">Select a customer…</option>
                  {state.customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.company ? ` — ${c.company}` : ""}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Invoice date" required error={errors.date?.message}>
                <Input type="date" max={format(new Date(), "yyyy-MM-dd")} {...register("date")} />
              </Field>
            </div>
            {customer && customerStats && (
              <div className="mt-3 flex flex-wrap items-center gap-3 rounded-[10px] border border-line bg-subtle px-3.5 py-2.5">
                <Avatar name={customer.name} size={32} />
                <div className="min-w-0 flex-1 text-[12.5px]">
                  <div className="font-medium text-ink">{customer.company || customer.name}</div>
                  <div className="truncate text-muted">
                    {customer.email} · {customer.phone}
                  </div>
                </div>
                <div className="text-right text-[12px]">
                  <div className="text-muted">{customerStats.orders} orders</div>
                  {customerStats.outstanding > 0 ? (
                    <div className="font-medium text-danger">{formatCurrency(customerStats.outstanding)} due</div>
                  ) : (
                    <div className="font-medium text-success">No dues</div>
                  )}
                </div>
              </div>
            )}
          </FormSection>

          {/* 2. Products */}
          <FormSection
            step={2}
            title="Products"
            description="Search and add products. Quantities are checked against available stock."
            complete={fields.length > 0 && stockIssues.length === 0}
            actions={
              <label className="flex items-center gap-2 text-[12.5px] text-muted">
                <Warehouse className="h-3.5 w-3.5" />
                <select
                  {...register("warehouseId")}
                  className="h-8 cursor-pointer rounded-[8px] border border-line-strong bg-surface px-2 text-[12.5px] text-ink focus:border-brand focus:outline-none"
                >
                  {state.warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </label>
            }
          >
            <ProductPicker
              products={state.products}
              excludeIds={items.map((i) => i?.productId ?? "")}
              stockOf={(p) => p.stock[warehouseId] ?? 0}
              priceOf={(p) => p.sellingPrice}
              disableOutOfStock
              onPick={(p) => append({ productId: p.id, quantity: 1, price: p.sellingPrice })}
            />

            {fields.length === 0 ? (
              <div className="mt-3 rounded-[10px] border border-line">
                <EmptyState compact icon={<ReceiptText />} title="No products added" description="Use the search above to add products to this invoice." />
              </div>
            ) : (
              <div className="mt-3 overflow-hidden rounded-[10px] border border-line">
                <div className="hidden grid-cols-[minmax(0,1fr)_130px_120px_110px_36px] gap-3 border-b border-line bg-subtle px-3.5 py-2 text-[11px] font-medium tracking-wide text-muted uppercase md:grid">
                  <span>Product</span>
                  <span>Quantity</span>
                  <span>Unit price</span>
                  <span className="text-right">Line total</span>
                  <span />
                </div>
                <ul className="divide-y divide-line">
                  {fields.map((field, idx) => {
                    const p = productMap.get(field.productId);
                    const line = items[idx];
                    const qty = Number(line?.quantity) || 0;
                    const available = availableOf(field.productId);
                    const over = qty > available;
                    const qtyError = errors.items?.[idx]?.quantity?.message;
                    return (
                      <li key={field.id} className={cn("grid grid-cols-2 items-start gap-3 px-3.5 py-3 md:grid-cols-[minmax(0,1fr)_130px_120px_110px_36px] md:items-center", over && "bg-danger-bg/40")}>
                        <div className="col-span-2 flex min-w-0 items-center gap-3 md:col-span-1">
                          {p && <ProductThumb name={p.name} category={p.category} size={32} />}
                          <div className="min-w-0">
                            <div className="truncate text-[13px] font-medium text-ink">{p?.name ?? "Unknown product"}</div>
                            <div className={cn("text-[11.5px]", over ? "font-medium text-danger" : available - qty <= (p?.minStock ?? 0) ? "text-warning" : "text-muted")}>
                              <span className="font-mono">{p?.sku}</span> · {available} available
                            </div>
                          </div>
                        </div>
                        <div>
                          <div className="flex h-9 items-center rounded-[9px] border border-line-strong bg-surface focus-within:border-brand focus-within:ring-[3px] focus-within:ring-brand/15" aria-invalid={over || !!qtyError}>
                            <button type="button" className="grid h-full w-8 place-items-center text-muted hover:text-ink disabled:opacity-40" onClick={() => setValue(`items.${idx}.quantity`, Math.max(1, qty - 1), { shouldValidate: true })} disabled={qty <= 1} aria-label="Decrease quantity">
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <input
                              type="number"
                              min={1}
                              step={1}
                              inputMode="numeric"
                              {...register(`items.${idx}.quantity`, { valueAsNumber: true })}
                              className={cn("h-full w-full min-w-0 bg-transparent text-center text-[13px] font-medium tabular focus:outline-none", over && "text-danger")}
                            />
                            <button type="button" className="grid h-full w-8 place-items-center text-muted hover:text-ink" onClick={() => setValue(`items.${idx}.quantity`, qty + 1, { shouldValidate: true })} aria-label="Increase quantity">
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          {(over || qtyError) && <p className="mt-1 text-[11.5px] text-danger">{over ? `Insufficient stock. Available quantity: ${available}` : qtyError}</p>}
                        </div>
                        <div>
                          <Input type="number" step="0.01" min={0} leading={sym} {...register(`items.${idx}.price`, { valueAsNumber: true })} invalid={!!errors.items?.[idx]?.price} className="tabular" />
                          {errors.items?.[idx]?.price && <p className="mt-1 text-[11.5px] text-danger">{errors.items[idx]?.price?.message}</p>}
                        </div>
                        <div className="self-center text-right text-[13.5px] font-semibold text-ink tabular md:text-right">{formatCurrency(lineTotal(qty, Number(line?.price) || 0))}</div>
                        <button type="button" onClick={() => remove(idx)} className="grid h-8 w-8 place-items-center justify-self-end rounded-md text-muted transition hover:bg-danger-bg hover:text-danger" aria-label={`Remove ${p?.name}`}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {errors.items?.message && <p className="mt-2 text-[12.5px] text-danger">{errors.items.message}</p>}
            {errors.items?.root?.message && <p className="mt-2 text-[12.5px] text-danger">{errors.items.root.message}</p>}
          </FormSection>

          {/* 3. Billing */}
          <FormSection step={3} title="Billing" description="Discount is applied before tax." complete={!!customer && fields.length > 0 && stockIssues.length === 0}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Discount" error={errors.discountValue?.message}>
                <div className="flex gap-2">
                  <div className="flex shrink-0 rounded-[9px] bg-[#eef0f3] p-[3px]">
                    {(["percent", "amount"] as const).map((t) => (
                      <button
                        type="button"
                        key={t}
                        onClick={() => setValue("discountType", t, { shouldValidate: true })}
                        className={cn("h-[30px] w-9 rounded-[7px] text-[12.5px] font-semibold transition", watched.discountType === t ? "bg-surface text-ink shadow-sm" : "text-muted")}
                      >
                        {t === "percent" ? "%" : sym}
                      </button>
                    ))}
                  </div>
                  <Input type="number" step="0.01" min={0} {...register("discountValue", { valueAsNumber: true })} invalid={!!errors.discountValue} />
                </div>
              </Field>
              <Field label="Tax (GST)" error={errors.taxRate?.message}>
                <div className="flex gap-2">
                  <Select value={String(watched.taxRate)} onChange={(e) => setValue("taxRate", Number(e.target.value), { shouldValidate: true })} className="w-full">
                    {[...new Set([...TAX_PRESETS, state.settings.defaultTaxRate])].sort((a, b) => a - b).map((t) => (
                      <option key={t} value={t}>
                        {t}%{t === state.settings.defaultTaxRate ? " (default)" : ""}
                      </option>
                    ))}
                  </Select>
                </div>
              </Field>
            </div>
          </FormSection>

          {/* 4. Payment */}
          <FormSection step={4} title="Payment" complete={!!customer && fields.length > 0 && stockIssues.length === 0}>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Payment method" required>
                <Select {...register("paymentMethod")}>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Payment status" required>
                <Select {...register("paymentStatus")}>
                  <option>Paid</option>
                  <option>Partial</option>
                  <option>Unpaid</option>
                </Select>
              </Field>
              <Field label="Order status" required hint={watched.orderStatus === "Pending" ? "Stock is reserved now" : undefined}>
                <Select {...register("orderStatus")}>
                  <option value="Completed">Completed (delivered)</option>
                  <option value="Pending">Pending (to deliver)</option>
                </Select>
              </Field>
              {watched.paymentStatus === "Partial" && (
                <Field label="Amount received" required error={errors.amountPaid?.message} className="sm:col-span-1">
                  <Input type="number" step="0.01" min={0} leading={sym} {...register("amountPaid", { setValueAs: (v) => (v === "" ? undefined : Number(v)) })} invalid={!!errors.amountPaid} />
                </Field>
              )}
              <Field label="Notes" className="sm:col-span-3">
                <Textarea rows={2} placeholder="Delivery instructions, PO reference from customer, etc." {...register("notes")} />
              </Field>
            </div>
          </FormSection>
        </div>

        {/* Summary */}
        <div className="xl:sticky xl:top-[76px] xl:self-start">
          <Card className="overflow-hidden">
            <div className="border-b border-line px-5 py-4">
              <h3 className="text-[14.5px] font-semibold text-ink">Summary</h3>
              <p className="text-[12.5px] text-muted">
                {fields.length} product{fields.length === 1 ? "" : "s"} · {units} unit{units === 1 ? "" : "s"}
              </p>
            </div>
            <dl className="space-y-2.5 px-5 py-4 text-[13px]">
              <Row label="Subtotal" value={formatCurrency(totals.subtotal)} />
              <Row label={`Discount${watched.discountType === "percent" && watched.discountValue ? ` (${watched.discountValue}%)` : ""}`} value={totals.discountAmount ? `− ${formatCurrency(totals.discountAmount)}` : formatCurrency(0)} />
              <Row label="Taxable amount" value={formatCurrency(totals.taxableAmount)} muted />
              <Row label={`GST (${watched.taxRate ?? 0}%)`} value={formatCurrency(totals.taxAmount)} />
              <div className="flex items-baseline justify-between border-t border-line pt-3">
                <dt className="text-[13.5px] font-semibold text-ink">Grand total</dt>
                <dd className="text-[20px] font-semibold tracking-[-0.01em] text-ink tabular">{formatCurrency(totals.total)}</dd>
              </div>
              {watched.paymentStatus === "Partial" && watched.amountPaid ? (
                <Row label="Balance due" value={formatCurrency(Math.max(totals.total - (Number(watched.amountPaid) || 0), 0))} />
              ) : null}
            </dl>
            {stockIssues.length > 0 && (
              <div className="mx-5 mb-4 flex gap-2 rounded-[10px] border border-danger-line bg-danger-bg px-3 py-2.5 text-[12.5px] text-danger">
                <AlertCircle className="mt-px h-4 w-4 shrink-0" />
                {stockIssues.length} product{stockIssues.length > 1 ? "s exceed" : " exceeds"} available stock in {state.warehouses.find((w) => w.id === warehouseId)?.name}.
              </div>
            )}
            <div className="flex gap-2 border-t border-line bg-subtle px-5 py-3.5">
              <Button variant="secondary" className="flex-1" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={fields.length === 0 || stockIssues.length > 0} loading={pending}>
                Create Sale
              </Button>
            </div>
          </Card>
        </div>
      </form>

      <CustomerFormPanel open={customerPanel} onClose={() => setCustomerPanel(false)} onSaved={(c) => setValue("customerId", c.id, { shouldValidate: true })} />
    </>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className={muted ? "text-faint" : "text-muted"}>{label}</dt>
      <dd className={cn("tabular", muted ? "text-muted" : "font-medium text-ink")}>{value}</dd>
    </div>
  );
}

export default function NewSalePage() {
  return (
    <Suspense>
      <NewSaleInner />
    </Suspense>
  );
}
