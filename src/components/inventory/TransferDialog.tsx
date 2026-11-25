"use client";

import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, ArrowUpDown, Truck, Zap } from "lucide-react";
import { useInventory } from "@/context/InventoryContext";
import { transferSchema, type TransferFormValues } from "@/lib/validations";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/Overlay";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { useSubmitGuard } from "@/hooks/useSubmitGuard";

export function TransferDialog({ open, onClose, productId }: { open: boolean; onClose: () => void; productId?: string }) {
  const { state, actions } = useInventory();
  const [w1, w2] = state.warehouses;
  const { guard, pending, release } = useSubmitGuard();
  const defaults = (): TransferFormValues => ({
    productId: productId ?? "",
    fromWarehouseId: w1?.id ?? "",
    toWarehouseId: w2?.id ?? "",
    quantity: undefined as unknown as number,
    completeNow: true,
    notes: "",
  });
  const { register, handleSubmit, reset, control, setValue, setError, getValues, formState } = useForm<TransferFormValues>({
    resolver: zodResolver(transferSchema),
    defaultValues: defaults(),
  });
  const errors = formState.errors;

  useEffect(() => {
    if (open) {
      reset(defaults());
      release();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, productId]);

  const [pid, from, to, qty, completeNow] = useWatch({ control, name: ["productId", "fromWarehouseId", "toWarehouseId", "quantity", "completeNow"] });
  const product = state.products.find((p) => p.id === pid);
  const avail = product ? product.stock[from] ?? 0 : 0;
  const q = Number.isFinite(qty) ? qty : 0;
  const nameOf = (id: string) => state.warehouses.find((w) => w.id === id)?.name ?? "—";

  const swap = () => {
    const v = getValues();
    setValue("fromWarehouseId", v.toWarehouseId);
    setValue("toWarehouseId", v.fromWarehouseId);
  };

  const onSubmit = (v: TransferFormValues) =>
    guard(() => {
      if (v.quantity > avail) {
        setError("quantity", { message: `Only ${avail} available in ${nameOf(v.fromWarehouseId)}` });
        return null;
      }
      const t = actions.createTransfer(v);
      if (t) onClose();
      return t;
    });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New stock transfer"
      description="Move stock between warehouses. Totals stay the same; locations change."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} loading={pending}>{completeNow ? "Transfer stock" : "Dispatch transfer"}</Button>
        </>
      }
    >
      <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
        <Field label="Product" required error={errors.productId?.message}>
          <Select {...register("productId")} invalid={!!errors.productId}>
            <option value="">Select a product…</option>
            {state.products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.sku}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <Field label="From" required error={errors.fromWarehouseId?.message}>
            <Select {...register("fromWarehouseId")}>
              {state.warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          </Field>
          <button
            type="button"
            onClick={swap}
            className="mx-auto mb-0.5 grid h-8 w-8 place-items-center rounded-full border border-line bg-surface text-muted transition hover:text-brand"
            aria-label="Swap warehouses"
            title="Swap warehouses"
          >
            <ArrowUpDown className="h-4 w-4 sm:rotate-90" />
          </button>
          <Field label="To" required error={errors.toWarehouseId?.message}>
            <Select {...register("toWarehouseId")} invalid={!!errors.toWarehouseId}>
              {state.warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Quantity" required error={errors.quantity?.message} hint={product ? `${avail} available in ${nameOf(from)}` : undefined}>
          <Input type="number" min={1} step={1} inputMode="numeric" placeholder="0" {...register("quantity", { valueAsNumber: true })} invalid={!!errors.quantity} />
        </Field>

        {product && from !== to && (
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-[10px] border border-line bg-subtle p-3 text-center text-[12.5px]">
            <div>
              <div className="text-muted">{nameOf(from)}</div>
              <div className="mt-0.5 font-medium text-ink tabular">
                {avail} → <span className={cn(avail - q < 0 && "text-danger")}>{avail - q}</span>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-faint" />
            <div>
              <div className="text-muted">{nameOf(to)}</div>
              <div className="mt-0.5 font-medium text-ink tabular">
                {product.stock[to] ?? 0} → <span className="text-success">{completeNow ? (product.stock[to] ?? 0) + q : `${product.stock[to] ?? 0} (+${q} in transit)`}</span>
              </div>
            </div>
          </div>
        )}

        <Field label="Delivery">
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { v: true, icon: Zap, title: "Complete now", body: "Stock moves immediately" },
              { v: false, icon: Truck, title: "In transit", body: "Receive at destination later" },
            ].map((o) => (
              <button
                type="button"
                key={String(o.v)}
                onClick={() => setValue("completeNow", o.v)}
                className={cn(
                  "flex items-start gap-2.5 rounded-[10px] border p-3 text-left transition",
                  completeNow === o.v ? "border-brand bg-brand-50/50 ring-[3px] ring-brand/10" : "border-line hover:border-line-strong",
                )}
              >
                <o.icon className={cn("mt-0.5 h-4 w-4", completeNow === o.v ? "text-brand" : "text-muted")} />
                <span>
                  <span className="block text-[13px] font-medium text-ink">{o.title}</span>
                  <span className="block text-[12px] text-muted">{o.body}</span>
                </span>
              </button>
            ))}
          </div>
        </Field>

        <Field label="Notes">
          <Textarea rows={2} placeholder="Vehicle, handler, or reason (optional)" {...register("notes")} />
        </Field>
      </form>
    </Modal>
  );
}
