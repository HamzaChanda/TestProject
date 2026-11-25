"use client";

import { useNavigate } from "@/hooks/useNavigate";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Info, Wand2 } from "lucide-react";
import type { Product } from "@/types";
import { useInventory } from "@/context/InventoryContext";
import { productSchema, type ProductFormValues } from "@/lib/validations";
import { CATEGORIES, UNITS } from "@/lib/constants";
import { totalStock } from "@/lib/calc";
import { currencySymbol, formatCurrency } from "@/lib/utils";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { useSubmitGuard } from "@/hooks/useSubmitGuard";

function suggestSku(name: string, category: string) {
  const cat = (category || "GEN").slice(0, 3).toUpperCase();
  const words = name.toUpperCase().replace(/[^A-Z0-9 ]/g, "").split(/\s+/).filter(Boolean);
  const core = words.map((w) => w.slice(0, words.length > 1 ? 2 : 4)).join("").slice(0, 5) || "ITEM";
  const n = Math.floor(100 + Math.random() * 900);
  return `${cat}-${core}-${n}`;
}

export function ProductForm({ product }: { product?: Product }) {
  const router = useRouter();
  const navigate = useNavigate();
  const { state, actions } = useInventory();
  const editing = !!product;
  const { guard, pending } = useSubmitGuard();
  const existingSkus = useMemo(
    () => new Set(state.products.filter((p) => p.id !== product?.id).map((p) => p.sku.toUpperCase())),
    [state.products, product?.id],
  );

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    mode: "onTouched",
    defaultValues: product
      ? {
          name: product.name,
          sku: product.sku,
          category: product.category,
          description: product.description,
          unit: product.unit,
          sellingPrice: product.sellingPrice,
          costPrice: product.costPrice,
          openingStock: totalStock(product),
          minStock: product.minStock,
          supplierId: product.supplierId ?? "",
        }
      : {
          name: "",
          sku: "",
          category: "",
          description: "",
          unit: "pcs",
          sellingPrice: undefined as unknown as number,
          costPrice: undefined as unknown as number,
          openingStock: 0,
          minStock: 10,
          supplierId: "",
        },
  });
  const { register, handleSubmit, setValue, setError, control, formState } = form;
  const errors = formState.errors;
  const [name, category, sell, cost] = useWatch({ control, name: ["name", "category", "sellingPrice", "costPrice"] });
  const margin = Number.isFinite(sell) && Number.isFinite(cost) && sell > 0 ? ((sell - cost) / sell) * 100 : null;

  const onSubmit = (v: ProductFormValues) =>
    guard(() => {
    if (existingSkus.has(v.sku.trim().toUpperCase())) {
      setError("sku", { message: "This SKU is already used by another product" });
      return null;
    }
    const base = {
      name: v.name,
      sku: v.sku,
      category: v.category,
      description: v.description,
      unit: v.unit,
      sellingPrice: v.sellingPrice,
      costPrice: v.costPrice,
      minStock: v.minStock,
      supplierId: v.supplierId || null,
    };
    if (editing && product) {
      const updated = actions.updateProduct(product.id, base);
      if (updated) navigate(`/products/${product.id}`);
      return updated;
    }
    const created = actions.addProduct({ ...base, openingStock: v.openingStock });
    if (created) navigate(`/products/${created.id}`);
    return created;
    });

  const sym = currencySymbol();

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <div className="space-y-5">
        <Card>
          <CardHeader title="Basic information" description="How this product appears across invoices and reports." />
          <CardBody className="grid gap-4">
            <Field label="Product name" required error={errors.name?.message}>
              <Input placeholder="e.g. Wireless Mouse" {...register("name")} invalid={!!errors.name} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="SKU"
                required
                error={errors.sku?.message}
                hint="Unique stock-keeping code"
                aside={
                  <button
                    type="button"
                    onClick={() => setValue("sku", suggestSku(name, category), { shouldValidate: true })}
                    className="inline-flex items-center gap-1 text-[12px] font-medium text-brand hover:underline"
                  >
                    <Wand2 className="h-3 w-3" /> Generate
                  </button>
                }
              >
                <Input placeholder="PER-WM-235" className="font-mono uppercase" {...register("sku")} invalid={!!errors.sku} />
              </Field>
              <Field label="Category" required error={errors.category?.message}>
                <Select {...register("category")} invalid={!!errors.category}>
                  <option value="">Select category…</option>
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Description" error={errors.description?.message}>
              <Textarea placeholder="Key specs, model, or notes for your team" {...register("description")} />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Pricing" description="Prices exclude tax. Tax is applied on invoices." />
          <CardBody className="grid gap-4 sm:grid-cols-3">
            <Field label="Selling price" required error={errors.sellingPrice?.message}>
              <Input type="number" step="0.01" min={0} leading={sym} placeholder="0.00" {...register("sellingPrice", { valueAsNumber: true })} invalid={!!errors.sellingPrice} />
            </Field>
            <Field label="Purchase price" required error={errors.costPrice?.message}>
              <Input type="number" step="0.01" min={0} leading={sym} placeholder="0.00" {...register("costPrice", { valueAsNumber: true })} invalid={!!errors.costPrice} />
            </Field>
            <Field label="Gross margin" hint={margin !== null && margin < 0 ? "Selling below cost — allowed, but check this is intended" : undefined}>
              <div className="flex h-9 items-center rounded-[9px] border border-dashed border-line-strong bg-subtle px-3 text-[13.5px] font-medium tabular">
                {margin === null ? (
                  <span className="text-faint">—</span>
                ) : (
                  <span className={margin < 0 ? "text-danger" : margin < 15 ? "text-warning" : "text-success"}>
                    {margin.toFixed(1)}% · {formatCurrency(sell - cost)}
                  </span>
                )}
              </div>
            </Field>
          </CardBody>
        </Card>
      </div>

      <div className="space-y-5">
        <Card>
          <CardHeader title="Inventory" />
          <CardBody className="grid gap-4">
            <Field label="Unit" required error={errors.unit?.message}>
              <Select {...register("unit")}>
                {UNITS.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </Select>
            </Field>
            <Field
              label="Opening stock"
              required={!editing}
              error={errors.openingStock?.message}
              hint={editing ? "Use Stock → Adjust stock to change quantities" : `Added to ${state.warehouses.find((w) => w.isDefault)?.name ?? "the default warehouse"}`}
            >
              <Input
                type="number"
                min={0}
                step={1}
                readOnly={editing}
                tabIndex={editing ? -1 : undefined}
                className={editing ? "cursor-not-allowed bg-subtle text-muted" : undefined}
                {...register("openingStock", { valueAsNumber: true })}
                invalid={!!errors.openingStock}
              />
            </Field>
            <Field label="Minimum stock level" required error={errors.minStock?.message} hint="You'll be alerted at or below this level">
              <Input type="number" min={0} step={1} {...register("minStock", { valueAsNumber: true })} invalid={!!errors.minStock} />
            </Field>
            <Field label="Preferred supplier">
              <Select {...register("supplierId")}>
                <option value="">No preferred supplier</option>
                {state.suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          </CardBody>
        </Card>
        {editing && (
          <div className="flex gap-2.5 rounded-[12px] border border-info-line bg-info-bg p-3.5 text-[12.5px] text-info">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            Stock quantities are changed only through transactions (sales, purchases, adjustments, transfers) so history stays accurate.
          </div>
        )}
        <div className="flex gap-2 lg:sticky lg:top-[76px]">
          <Button variant="secondary" className="flex-1" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" loading={pending}>
            {editing ? "Save changes" : "Add product"}
          </Button>
        </div>
      </div>
    </form>
  );
}
