"use client";

import { useNavigate } from "@/hooks/useNavigate";
import { Suspense, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { addDays, format } from "date-fns";
import { FileClock, Info, ShoppingCart, Trash2, Warehouse } from "lucide-react";
import { useInventory } from "@/context/InventoryContext";
import { purchaseSchema, type PurchaseFormValues } from "@/lib/validations";
import { computePurchaseTotals, lineTotal, totalStock } from "@/lib/calc";
import { TAX_PRESETS } from "@/lib/constants";
import { cn, currencySymbol, formatCurrency } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { EmptyState, PageHeader, ProductThumb } from "@/components/ui/Primitives";
import { FormSection } from "@/components/forms/FormSection";
import { ProductPicker } from "@/components/forms/ProductPicker";
import { useSubmitGuard } from "@/hooks/useSubmitGuard";

function suggestedQty(stock: number, min: number) {
  return Math.max(min * 2 - stock, min, 1);
}

function NewPurchaseInner() {
  const { state, actions } = useInventory();
  const navigate = useNavigate();
  const params = useSearchParams();
  const draftRef = useRef(false);
  const { guard, pending } = useSubmitGuard();
  const defaultWh = state.warehouses.find((w) => w.isDefault)?.id ?? state.warehouses[0].id;

  const initial = useMemo(() => {
    const p = state.products.find((x) => x.id === params.get("product"));
    return p
      ? { supplierId: params.get("supplier") ?? p.supplierId ?? "", items: [{ productId: p.id, quantity: suggestedQty(totalStock(p), p.minStock), price: p.costPrice }] }
      : { supplierId: params.get("supplier") ?? "", items: [] };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const today = format(new Date(), "yyyy-MM-dd");
  const { register, control, handleSubmit, setValue, formState } = useForm<PurchaseFormValues>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: {
      supplierId: initial.supplierId,
      orderDate: today,
      expectedDate: format(addDays(new Date(), 7), "yyyy-MM-dd"),
      warehouseId: defaultWh,
      items: initial.items,
      taxRate: state.settings.defaultTaxRate,
      notes: "",
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const errors = formState.errors;
  const watched = useWatch({ control });
  const items = watched.items ?? [];
  const productMap = useMemo(() => new Map(state.products.map((p) => [p.id, p])), [state.products]);
  const supplier = state.suppliers.find((s) => s.id === watched.supplierId);
  const totals = computePurchaseTotals(
    items.map((i) => ({ quantity: Number(i?.quantity) || 0, price: Number(i?.price) || 0 })),
    Number(watched.taxRate) || 0,
  );
  const units = items.reduce((s, i) => s + (Number(i?.quantity) || 0), 0);

  // Products from the chosen supplier are listed first.
  const pickerProducts = useMemo(
    () => [...state.products].sort((a, b) => Number(b.supplierId === watched.supplierId) - Number(a.supplierId === watched.supplierId)),
    [state.products, watched.supplierId],
  );
  const lowFromSupplier = supplier
    ? state.products.filter((p) => p.supplierId === supplier.id && totalStock(p) <= p.minStock && !items.some((i) => i?.productId === p.id))
    : [];

  const onSubmit = (v: PurchaseFormValues) =>
    guard(() => {
    const po = actions.createPurchase({
      supplierId: v.supplierId,
      orderDate: v.orderDate,
      expectedDate: v.expectedDate,
      warehouseId: v.warehouseId,
      items: v.items.map((i) => ({ productId: i.productId, quantity: i.quantity, unitCost: i.price })),
      taxRate: v.taxRate,
      notes: v.notes,
      asDraft: draftRef.current,
    });
    if (po) navigate(`/purchases/${po.id}`);
    return po;
    });

  const submitAs = (draft: boolean) => {
    draftRef.current = draft;
    handleSubmit(onSubmit)();
  };

  const sym = currencySymbol();

  return (
    <>
      <PageHeader title="New purchase order" description="Stock is not added until items are received against this order." />
      <form onSubmit={(e) => { e.preventDefault(); submitAs(false); }} className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          <FormSection step={1} title="Supplier & dates" complete={!!supplier}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Supplier" required error={errors.supplierId?.message} className="sm:col-span-2">
                <Select {...register("supplierId")} invalid={!!errors.supplierId}>
                  <option value="">Select a supplier…</option>
                  {state.suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Order date" required error={errors.orderDate?.message}>
                <Input type="date" {...register("orderDate")} invalid={!!errors.orderDate} />
              </Field>
              <Field label="Expected delivery" required error={errors.expectedDate?.message}>
                <Input type="date" min={watched.orderDate} {...register("expectedDate")} invalid={!!errors.expectedDate} />
              </Field>
            </div>
            {supplier && (
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 rounded-[10px] border border-line bg-subtle px-3.5 py-2.5 text-[12.5px]">
                <span className="text-muted">
                  Contact <span className="font-medium text-ink">{supplier.contactPerson}</span>
                </span>
                <span className="text-muted">
                  Terms <span className="font-medium text-ink">{supplier.paymentTerms}</span>
                </span>
                <span className="text-muted">{supplier.email}</span>
              </div>
            )}
          </FormSection>

          <FormSection
            step={2}
            title="Products"
            description="Quantities and agreed purchase prices."
            complete={fields.length > 0}
            actions={
              <label className="flex items-center gap-2 text-[12.5px] text-muted">
                <Warehouse className="h-3.5 w-3.5" /> Deliver to
                <select {...register("warehouseId")} className="h-8 cursor-pointer rounded-[8px] border border-line-strong bg-surface px-2 text-[12.5px] text-ink focus:border-brand focus:outline-none">
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
              products={pickerProducts}
              excludeIds={items.map((i) => i?.productId ?? "")}
              stockOf={(p) => totalStock(p)}
              priceOf={(p) => p.costPrice}
              onPick={(p) => append({ productId: p.id, quantity: suggestedQty(totalStock(p), p.minStock), price: p.costPrice })}
            />
            {lowFromSupplier.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-[10px] border border-warning-line bg-warning-bg px-3 py-2 text-[12.5px] text-warning">
                <Info className="h-4 w-4" />
                <span>Low stock from this supplier:</span>
                {lowFromSupplier.map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => append({ productId: p.id, quantity: suggestedQty(totalStock(p), p.minStock), price: p.costPrice })}
                    className="rounded-full border border-warning-line bg-surface px-2 py-0.5 font-medium text-ink-2 hover:border-warning"
                  >
                    + {p.name}
                  </button>
                ))}
              </div>
            )}
            {fields.length === 0 ? (
              <div className="mt-3 rounded-[10px] border border-line">
                <EmptyState compact icon={<ShoppingCart />} title="No products on this order" description="Search above to add products to restock." />
              </div>
            ) : (
              <div className="mt-3 overflow-hidden rounded-[10px] border border-line">
                <div className="hidden grid-cols-[minmax(0,1fr)_100px_130px_110px_36px] gap-3 border-b border-line bg-subtle px-3.5 py-2 text-[11px] font-medium tracking-wide text-muted uppercase md:grid">
                  <span>Product</span>
                  <span>Quantity</span>
                  <span>Purchase price</span>
                  <span className="text-right">Line total</span>
                  <span />
                </div>
                <ul className="divide-y divide-line">
                  {fields.map((field, idx) => {
                    const p = productMap.get(field.productId);
                    const line = items[idx];
                    const stock = p ? totalStock(p) : 0;
                    return (
                      <li key={field.id} className="grid grid-cols-2 items-start gap-3 px-3.5 py-3 md:grid-cols-[minmax(0,1fr)_100px_130px_110px_36px] md:items-center">
                        <div className="col-span-2 flex min-w-0 items-center gap-3 md:col-span-1">
                          {p && <ProductThumb name={p.name} category={p.category} size={32} />}
                          <div className="min-w-0">
                            <div className="truncate text-[13px] font-medium text-ink">{p?.name}</div>
                            <div className={cn("text-[11.5px]", p && stock <= p.minStock ? "text-warning" : "text-muted")}>
                              <span className="font-mono">{p?.sku}</span> · {stock} in stock · min {p?.minStock}
                            </div>
                          </div>
                        </div>
                        <div>
                          <Input type="number" min={1} step={1} inputMode="numeric" {...register(`items.${idx}.quantity`, { valueAsNumber: true })} invalid={!!errors.items?.[idx]?.quantity} className="tabular" />
                          {errors.items?.[idx]?.quantity && <p className="mt-1 text-[11.5px] text-danger">{errors.items[idx]?.quantity?.message}</p>}
                        </div>
                        <div>
                          <Input type="number" min={0} step="0.01" leading={sym} {...register(`items.${idx}.price`, { valueAsNumber: true })} invalid={!!errors.items?.[idx]?.price} className="tabular" />
                          {errors.items?.[idx]?.price && <p className="mt-1 text-[11.5px] text-danger">{errors.items[idx]?.price?.message}</p>}
                        </div>
                        <div className="self-center text-right text-[13.5px] font-semibold text-ink tabular">{formatCurrency(lineTotal(Number(line?.quantity) || 0, Number(line?.price) || 0))}</div>
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
          </FormSection>

          <FormSection step={3} title="Tax & notes" complete={!!supplier && fields.length > 0}>
            <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
              <Field label="Tax (GST)">
                <Select value={String(watched.taxRate)} onChange={(e) => setValue("taxRate", Number(e.target.value))}>
                  {[...new Set([...TAX_PRESETS, state.settings.defaultTaxRate])].sort((a, b) => a - b).map((t) => (
                    <option key={t} value={t}>
                      {t}%
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Notes for supplier">
                <Textarea rows={2} placeholder="Delivery window, packaging, reference quote…" {...register("notes")} />
              </Field>
            </div>
          </FormSection>
        </div>

        <div className="xl:sticky xl:top-[76px] xl:self-start">
          <Card className="overflow-hidden">
            <div className="border-b border-line px-5 py-4">
              <h3 className="text-[14.5px] font-semibold text-ink">Order summary</h3>
              <p className="text-[12.5px] text-muted">
                {fields.length} product{fields.length === 1 ? "" : "s"} · {units} unit{units === 1 ? "" : "s"}
              </p>
            </div>
            <dl className="space-y-2.5 px-5 py-4 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-muted">Subtotal</dt>
                <dd className="font-medium tabular">{formatCurrency(totals.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">GST ({watched.taxRate ?? 0}%)</dt>
                <dd className="font-medium tabular">{formatCurrency(totals.taxAmount)}</dd>
              </div>
              <div className="flex items-baseline justify-between border-t border-line pt-3">
                <dt className="text-[13.5px] font-semibold text-ink">Total amount</dt>
                <dd className="text-[20px] font-semibold tracking-[-0.01em] text-ink tabular">{formatCurrency(totals.total)}</dd>
              </div>
            </dl>
            <div className="mx-5 mb-4 flex gap-2 rounded-[10px] bg-info-bg px-3 py-2.5 text-[12px] text-info">
              <Info className="mt-px h-4 w-4 shrink-0" />
              Inventory increases only when you receive items on this order.
            </div>
            <div className="flex gap-2 border-t border-line bg-subtle px-5 py-3.5">
              <Button variant="secondary" className="flex-1" icon={<FileClock className="h-4 w-4" />} onClick={() => submitAs(true)} disabled={fields.length === 0 || pending}>
                Save draft
              </Button>
              <Button type="submit" className="flex-1" disabled={fields.length === 0} loading={pending}>
                Create order
              </Button>
            </div>
          </Card>
        </div>
      </form>
    </>
  );
}

export default function NewPurchasePage() {
  return (
    <Suspense>
      <NewPurchaseInner />
    </Suspense>
  );
}
