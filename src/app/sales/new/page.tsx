"use client";

/**
 * New sale — one sheet, four ruled sections (Customer · Items · Billing · Payment),
 * the line-items table as the centre of gravity, and a sticky summary that owns
 * the single primary action. Below xl the summary becomes a bottom bar.
 * All stock/price rules are enforced by the engine (createSale); this form only
 * pre-checks and explains.
 */
import { Suspense, useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { AlertCircle, ChevronUp, Minus, Plus, ReceiptText, Trash2, UserPlus } from "lucide-react";
import { useInventory } from "@/context/InventoryContext";
import { useNavigate } from "@/hooks/useNavigate";
import { useSubmitGuard } from "@/hooks/useSubmitGuard";
import { saleSchema, type SaleFormValues } from "@/lib/validations";
import { computeSaleTotals, lineTotal } from "@/lib/calc";
import { PAYMENT_METHODS, TAX_PRESETS } from "@/lib/constants";
import { getCustomerStats } from "@/lib/selectors";
import { cn, currencySymbol, formatCurrency, toIsoDate } from "@/lib/utils";
import { Sheet } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Combobox";
import { DatePicker } from "@/components/ui/DatePicker";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { EmptyState, PageHeader, Segmented } from "@/components/ui/Primitives";
import { Code, LocationTag, Overline } from "@/components/ui/Stockroom";
import { ProductPicker } from "@/components/forms/ProductPicker";
import { CustomerFormPanel } from "@/components/forms/PartyForms";

function Section({ title, description, actions, children, id }: { title: string; description?: string; actions?: ReactNode; children: ReactNode; id: string }) {
  return (
    <section aria-labelledby={id} className="border-b border-line px-4 py-5 last:border-b-0 md:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div>
          <h2 id={id} className="text-h3 font-semibold text-ink">
            {title}
          </h2>
          {description && <p className="text-label text-muted">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

function NewSaleInner() {
  const { state, actions } = useInventory();
  const router = useRouter();
  const navigate = useNavigate();
  const params = useSearchParams();
  const [customerPanel, setCustomerPanel] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [mobileSummary, setMobileSummary] = useState(false);
  const { guard, pending } = useSubmitGuard();
  const defaultWh = state.warehouses.find((w) => w.isDefault)?.id ?? state.warehouses[0].id;
  const today = format(new Date(), "yyyy-MM-dd");
  const initialCustomer = params.get("customer");

  const form = useForm<SaleFormValues>({
    resolver: zodResolver(saleSchema),
    defaultValues: {
      customerId: initialCustomer && state.customers.some((c) => c.id === initialCustomer) ? initialCustomer : "",
      date: today,
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
  const warehouse = state.warehouses.find((w) => w.id === warehouseId);
  const customer = state.customers.find((c) => c.id === watched.customerId);
  const productMap = useMemo(() => new Map(state.products.map((p) => [p.id, p])), [state.products]);
  const availableOf = (productId: string) => productMap.get(productId)?.stock[warehouseId] ?? 0;

  const totals = computeSaleTotals(
    items.map((i) => ({ quantity: Number(i?.quantity) || 0, price: Number(i?.price) || 0 })),
    watched.discountType ?? "percent",
    Number(watched.discountValue) || 0,
    Number(watched.taxRate) || 0,
  );
  const stockIssues = items.filter((i) => i?.productId && (Number(i.quantity) || 0) > availableOf(i.productId)).length;
  const units = items.reduce((s, i) => s + (Number(i?.quantity) || 0), 0);
  const partialAmount = Number(watched.amountPaid) || 0;
  const partialInvalid = watched.paymentStatus === "Partial" && !(partialAmount > 0 && partialAmount < totals.total);

  // Why the primary action can't run yet — shown next to it, in order of the form.
  const blockedReason = !customer
    ? "Select a customer"
    : fields.length === 0
      ? "Add at least one product"
      : stockIssues
        ? `${stockIssues} line${stockIssues === 1 ? " exceeds" : "s exceed"} stock in ${warehouse?.code ?? "this location"}`
        : partialInvalid
          ? "Enter the amount received"
          : null;
  const hardBlocked = fields.length === 0 || stockIssues > 0;
  const reasonIsStock = !!blockedReason && blockedReason.includes("exceed");

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
        setPaymentOpen(true);
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
  const taxOptions = [...new Set([...TAX_PRESETS, state.settings.defaultTaxRate])].sort((a, b) => a - b);
  const paymentSummary = `${watched.paymentStatus}${watched.paymentStatus === "Partial" && partialAmount ? ` ${formatCurrency(partialAmount)}` : ""} · ${watched.paymentMethod} · ${watched.orderStatus === "Completed" ? "Delivered now" : "Deliver later"}`;

  const summaryRows = (
    <dl className="space-y-2 text-body-sm">
      <Row label="Subtotal" value={formatCurrency(totals.subtotal)} />
      <Row
        label={`Discount${watched.discountType === "percent" && watched.discountValue ? ` (${watched.discountValue}%)` : ""}`}
        value={totals.discountAmount ? `− ${formatCurrency(totals.discountAmount)}` : formatCurrency(0)}
      />
      <Row label="Taxable amount" value={formatCurrency(totals.taxableAmount)} muted />
      <Row label={`GST (${watched.taxRate ?? 0}%)`} value={formatCurrency(totals.taxAmount)} />
      {watched.paymentStatus === "Partial" && partialAmount > 0 && <Row label="Balance due" value={formatCurrency(Math.max(totals.total - partialAmount, 0))} />}
      {watched.paymentStatus === "Unpaid" && <Row label="Balance due" value={formatCurrency(totals.total)} />}
    </dl>
  );

  return (
    <>
      <PageHeader back={{ href: "/sales", label: "Sales" }} title="New sale" description="Creates an invoice and deducts stock from the selected location." />

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-6 pb-28 xl:grid-cols-[minmax(0,1fr)_340px] xl:pb-0">
        <Sheet className="min-w-0">
          {/* Customer */}
          <Section
            id="sec-customer"
            title="Customer"
            actions={
              <Button size="sm" variant="ghost" icon={<UserPlus />} onClick={() => setCustomerPanel(true)}>
                New customer
              </Button>
            }
          >
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_190px]">
              <Field label="Customer" htmlFor="customer" required error={errors.customerId?.message}>
                <Controller
                  control={control}
                  name="customerId"
                  render={({ field }) => (
                    <Combobox
                      id="customer"
                      value={field.value || null}
                      onChange={(v) => field.onChange(v ?? "")}
                      placeholder="Select a customer…"
                      invalid={!!errors.customerId}
                      clearable
                      options={state.customers.map((c) => ({
                        value: c.id,
                        label: c.name,
                        description: c.company || c.email,
                        keywords: `${c.company} ${c.email} ${c.phone}`,
                      }))}
                    />
                  )}
                />
              </Field>
              <Field label="Invoice date" htmlFor="sale-date" required error={errors.date?.message}>
                <Controller
                  control={control}
                  name="date"
                  render={({ field }) => <DatePicker id="sale-date" value={field.value} onChange={field.onChange} max={today} invalid={!!errors.date} />}
                />
              </Field>
            </div>
            {customer && customerStats && (
              <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-label text-muted" data-testid="customer-context">
                <span className="truncate">{[customer.company, customer.email, customer.phone].filter(Boolean).join(" · ")}</span>
                <span aria-hidden>·</span>
                <span>
                  <span className="font-mono">{customerStats.orders}</span> orders
                </span>
                <span aria-hidden>·</span>
                {customerStats.outstanding > 0 ? (
                  <span className="font-medium text-danger">
                    <span className="font-mono">{formatCurrency(customerStats.outstanding)}</span> outstanding
                  </span>
                ) : (
                  <span className="text-success">No dues</span>
                )}
              </p>
            )}
          </Section>

          {/* Items */}
          <Section
            id="sec-items"
            title="Items"
            description="Quantities are checked against stock at the selected location."
            actions={
              <div className="flex items-center gap-2">
                <span className="text-label text-muted">Ship from</span>
                <Controller
                  control={control}
                  name="warehouseId"
                  render={({ field }) => (
                    <Combobox
                      size="sm"
                      ariaLabel="Ship from location"
                      value={field.value}
                      onChange={(v) => v && field.onChange(v)}
                      panelWidth={240}
                      className="w-[200px]"
                      options={state.warehouses.map((w) => ({ value: w.id, label: w.name, description: w.location, meta: <LocationTag code={w.code} /> }))}
                    />
                  )}
                />
              </div>
            }
          >
            <ProductPicker
              products={state.products}
              excludeIds={items.map((i) => i?.productId ?? "")}
              stockOf={(p) => p.stock[warehouseId] ?? 0}
              stockLabel={(n) => `${n} in ${warehouse?.code ?? ""}`}
              priceOf={(p) => p.sellingPrice}
              disableOutOfStock
              onPick={(p) => append({ productId: p.id, quantity: 1, price: p.sellingPrice })}
            />

            {fields.length === 0 ? (
              <div className="mt-3 rounded-panel border border-dashed border-line-strong">
                <EmptyState compact icon={<ReceiptText />} title="No items yet" description="Search above to add products. Press Enter to add the highlighted one." />
              </div>
            ) : (
              <div className="mt-3 overflow-clip rounded-panel border border-line">
                <div
                  className="hidden h-8 grid-cols-[minmax(0,1fr)_128px_132px_112px_32px] items-center gap-3 border-b border-line bg-subtle px-3 lg:grid"
                  aria-hidden
                >
                  <Overline>Product</Overline>
                  <Overline>Qty</Overline>
                  <Overline>Unit price</Overline>
                  <Overline className="text-right">Line total</Overline>
                  <span />
                </div>
                <ul className="divide-y divide-line" aria-label="Invoice lines">
                  {fields.map((field, idx) => {
                    const p = productMap.get(field.productId);
                    const line = items[idx];
                    const qty = Number(line?.quantity) || 0;
                    const available = availableOf(field.productId);
                    const over = qty > available;
                    const low = !over && available - qty <= (p?.minStock ?? 0);
                    const qtyError = errors.items?.[idx]?.quantity?.message;
                    return (
                      <li
                        key={field.id}
                        className={cn(
                          "relative grid grid-cols-[128px_minmax(0,1fr)] items-center gap-x-3 gap-y-2 px-3 py-2.5 lg:min-h-12 lg:grid-cols-[minmax(0,1fr)_128px_132px_112px_32px] lg:py-2",
                          over && "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-danger-solid before:content-['']",
                        )}
                      >
                        <div className="col-span-2 min-w-0 pr-9 lg:col-span-1 lg:pr-0">
                          <div className="truncate text-body-sm font-medium text-ink">{p?.name ?? "Unknown product"}</div>
                          <div className="flex items-center gap-1.5 text-label">
                            <Code className="text-muted">{p?.sku}</Code>
                            <span className="text-faint" aria-hidden>
                              ·
                            </span>
                            <span className={cn(over ? "font-medium text-danger" : low ? "text-warning" : "text-muted")}>
                              <span className="font-mono">{available}</span> in {warehouse?.code}
                            </span>
                          </div>
                        </div>
                        <div>
                          <div
                            className={cn(
                              "flex h-8 w-[128px] items-center rounded-control border bg-surface focus-within:border-petrol-500 focus-within:ring-[3px] focus-within:ring-petrol-500/20",
                              over || qtyError ? "border-danger-solid" : "border-control",
                            )}
                          >
                            <button
                              type="button"
                              className="grid h-full w-8 place-items-center text-muted hover:text-ink disabled:opacity-40"
                              onClick={() => setValue(`items.${idx}.quantity`, Math.max(1, qty - 1), { shouldValidate: true })}
                              disabled={qty <= 1}
                              aria-label={`Decrease quantity of ${p?.name}`}
                            >
                              <Minus className="size-3.5" />
                            </button>
                            <input
                              type="number"
                              min={1}
                              step={1}
                              inputMode="numeric"
                              aria-label={`Quantity of ${p?.name}`}
                              aria-invalid={over || !!qtyError}
                              {...register(`items.${idx}.quantity`, { valueAsNumber: true })}
                              className={cn(
                                "h-full w-full min-w-0 bg-transparent text-center font-mono text-[13px] [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none",
                                over ? "text-danger" : "text-ink",
                              )}
                            />
                            <button
                              type="button"
                              className="grid h-full w-8 place-items-center text-muted hover:text-ink"
                              onClick={() => setValue(`items.${idx}.quantity`, qty + 1, { shouldValidate: true })}
                              aria-label={`Increase quantity of ${p?.name}`}
                            >
                              <Plus className="size-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="min-w-0 lg:w-[132px]">
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
                            leading={sym}
                            aria-label={`Unit price of ${p?.name}`}
                            {...register(`items.${idx}.price`, { valueAsNumber: true })}
                            invalid={!!errors.items?.[idx]?.price}
                            compact
                            className="font-mono"
                          />
                        </div>
                        <div className="col-span-2 flex items-baseline justify-between font-mono text-[13px] font-medium text-ink lg:col-span-1 lg:block lg:text-right">
                          <span className="font-sans text-label font-normal text-muted lg:hidden">Line total</span>
                          {formatCurrency(lineTotal(qty, Number(line?.price) || 0))}
                        </div>
                        <button
                          type="button"
                          onClick={() => remove(idx)}
                          className="grid size-8 place-items-center justify-self-end rounded-control text-muted transition-colors duration-[80ms] hover:bg-danger-bg hover:text-danger max-lg:absolute max-lg:top-2 max-lg:right-2"
                          aria-label={`Remove ${p?.name}`}
                        >
                          <Trash2 className="size-4" />
                        </button>
                        {(over || qtyError || errors.items?.[idx]?.price) && (
                          <p className="col-span-full text-label text-danger" role="alert">
                            {over ? `Insufficient stock. Available quantity: ${available}` : (qtyError ?? errors.items?.[idx]?.price?.message)}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <div className="flex h-9 items-center justify-between border-t border-line bg-subtle px-3 text-label text-muted">
                  <span>
                    <span className="font-mono text-ink-2">{fields.length}</span> line{fields.length === 1 ? "" : "s"} · <span className="font-mono text-ink-2">{units}</span> unit
                    {units === 1 ? "" : "s"}
                  </span>
                  <span>
                    Subtotal <span className="ml-1 font-mono text-[12.5px] text-ink">{formatCurrency(totals.subtotal)}</span>
                  </span>
                </div>
              </div>
            )}
            {errors.items?.message && <p className="mt-2 text-label text-danger">{errors.items.message}</p>}
            {errors.items?.root?.message && <p className="mt-2 text-label text-danger">{errors.items.root.message}</p>}
          </Section>

          {/* Billing */}
          <Section id="sec-billing" title="Billing" description="Discount is applied before tax.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Discount" htmlFor="discount" error={errors.discountValue?.message}>
                <div className="flex gap-2">
                  <Segmented
                    size="md"
                    ariaLabel="Discount type"
                    value={watched.discountType ?? "percent"}
                    onChange={(t) => setValue("discountType", t, { shouldValidate: true })}
                    options={[
                      { value: "percent", label: "%" },
                      { value: "amount", label: sym },
                    ]}
                    className="shrink-0 self-center"
                  />
                  <Input id="discount" type="number" step="0.01" min={0} {...register("discountValue", { valueAsNumber: true })} invalid={!!errors.discountValue} className="font-mono" />
                </div>
              </Field>
              <Field label="Tax (GST)" htmlFor="tax" error={errors.taxRate?.message}>
                <Combobox
                  id="tax"
                  value={String(watched.taxRate ?? 0)}
                  onChange={(v) => v !== null && setValue("taxRate", Number(v), { shouldValidate: true })}
                  options={taxOptions.map((t) => ({ value: String(t), label: `${t}%`, description: t === state.settings.defaultTaxRate ? "Default rate" : undefined }))}
                />
              </Field>
            </div>
          </Section>

          {/* Payment */}
          <Section
            id="sec-payment"
            title="Payment"
            actions={
              !paymentOpen && (
                <Button size="sm" variant="ghost" onClick={() => setPaymentOpen(true)} aria-controls="payment-fields" aria-expanded={false}>
                  Change
                </Button>
              )
            }
          >
            {!paymentOpen ? (
              <p className="text-body text-ink-2" data-testid="payment-summary">
                {paymentSummary}
              </p>
            ) : (
              <div id="payment-fields" className="grid gap-4 sm:grid-cols-3">
                <Field label="Payment status" htmlFor="pay-status" required>
                  <Controller
                    control={control}
                    name="paymentStatus"
                    render={({ field }) => (
                      <Combobox
                        id="pay-status"
                        value={field.value}
                        onChange={(v) => v && field.onChange(v)}
                        options={[
                          { value: "Paid", label: "Paid", description: "Full amount received" },
                          { value: "Partial", label: "Partial", description: "Part received now" },
                          { value: "Unpaid", label: "Unpaid", description: "Invoice on credit" },
                        ]}
                      />
                    )}
                  />
                </Field>
                <Field label="Payment method" htmlFor="pay-method" required>
                  <Controller
                    control={control}
                    name="paymentMethod"
                    render={({ field }) => <Combobox id="pay-method" value={field.value} onChange={(v) => v && field.onChange(v)} options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))} />}
                  />
                </Field>
                <Field label="Delivery" htmlFor="order-status" required hint={watched.orderStatus === "Pending" ? "Stock is reserved now" : undefined}>
                  <Controller
                    control={control}
                    name="orderStatus"
                    render={({ field }) => (
                      <Combobox
                        id="order-status"
                        value={field.value}
                        onChange={(v) => v && field.onChange(v)}
                        options={[
                          { value: "Completed", label: "Delivered now", description: "Order completed" },
                          { value: "Pending", label: "Deliver later", description: "Order pending" },
                        ]}
                      />
                    )}
                  />
                </Field>
                {watched.paymentStatus === "Partial" && (
                  <Field label="Amount received" htmlFor="amount-paid" required error={errors.amountPaid?.message}>
                    <Input
                      id="amount-paid"
                      type="number"
                      step="0.01"
                      min={0}
                      leading={sym}
                      {...register("amountPaid", { setValueAs: (v) => (v === "" ? undefined : Number(v)) })}
                      invalid={!!errors.amountPaid}
                      className="font-mono"
                    />
                  </Field>
                )}
              </div>
            )}
            <Field label="Notes" htmlFor="notes" className="mt-4">
              <Textarea id="notes" rows={2} placeholder="Delivery instructions, customer PO reference…" {...register("notes")} />
            </Field>
          </Section>
        </Sheet>

        {/* Summary — desktop */}
        <aside className="hidden xl:sticky xl:top-[76px] xl:block xl:self-start" aria-label="Invoice summary">
          <Sheet className="overflow-clip">
            <div className="border-b border-line px-5 py-3.5">
              <h2 className="text-h3 font-semibold text-ink">Summary</h2>
              <p className="text-label text-muted">
                <span className="font-mono">{fields.length}</span> line{fields.length === 1 ? "" : "s"} · <span className="font-mono">{units}</span> unit{units === 1 ? "" : "s"}
                {warehouse && (
                  <>
                    {" "}
                    · from <LocationTag code={warehouse.code} />
                  </>
                )}
              </p>
            </div>
            <div className="px-5 py-4">
              {summaryRows}
              <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
                <span className="text-body font-semibold text-ink">Total</span>
                <span className="font-mono text-[22px] font-medium tracking-[-0.01em] text-ink" data-testid="grand-total">
                  {formatCurrency(totals.total)}
                </span>
              </div>
            </div>
            <div className="space-y-2 border-t border-line bg-subtle px-5 py-4">
              <Button type="submit" size="lg" className="w-full" disabled={hardBlocked} loading={pending}>
                Create invoice
              </Button>
              {blockedReason && (
                <p className={cn("flex items-center gap-1.5 text-label", reasonIsStock ? "text-danger" : "text-muted")} role="status">
                  {reasonIsStock ? <AlertCircle className="size-3.5 shrink-0" /> : null}
                  {blockedReason}
                </p>
              )}
              <Button variant="ghost" size="sm" className="w-full" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
          </Sheet>
        </aside>

        {/* Summary — below xl: bottom bar */}
        <div className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface shadow-[0_-4px_16px_-8px_rgba(17,22,20,0.12)] md:left-rail xl:hidden">
          {mobileSummary && (
            <div id="mobile-summary" className="border-b border-line px-4 py-3">
              {summaryRows}
            </div>
          )}
          <div className="flex items-center gap-3 px-4 py-2.5">
            <button
              type="button"
              onClick={() => setMobileSummary((o) => !o)}
              aria-expanded={mobileSummary}
              aria-controls="mobile-summary"
              className="flex min-w-0 flex-1 items-center gap-2 rounded-control text-left focus-visible:outline-2 focus-visible:outline-brand"
            >
              <ChevronUp className={cn("size-4 shrink-0 text-muted transition-transform duration-[160ms]", !mobileSummary && "rotate-180")} />
              <span className="min-w-0">
                <span className="block font-mono text-[17px] font-medium text-ink">{formatCurrency(totals.total)}</span>
                <span className={cn("block truncate text-label", reasonIsStock ? "text-danger" : "text-muted")}>
                  {blockedReason ?? `${fields.length} line${fields.length === 1 ? "" : "s"} · ${units} units`}
                </span>
              </span>
            </button>
            <Button type="submit" disabled={hardBlocked} loading={pending}>
              Create invoice
            </Button>
          </div>
        </div>
      </form>

      <CustomerFormPanel open={customerPanel} onClose={() => setCustomerPanel(false)} onSaved={(c) => setValue("customerId", c.id, { shouldValidate: true })} />
    </>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={muted ? "text-faint" : "text-muted"}>{label}</dt>
      <dd className={cn("font-mono text-[12.5px]", muted ? "text-muted" : "text-ink")}>{value}</dd>
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
