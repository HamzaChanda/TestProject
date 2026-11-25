"use client";

import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { useInventory } from "@/context/InventoryContext";
import { adjustmentSchema, type AdjustmentFormValues } from "@/lib/validations";
import { ADJUSTMENT_REASONS } from "@/lib/constants";
import { totalStock } from "@/lib/calc";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/Overlay";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { useSubmitGuard } from "@/hooks/useSubmitGuard";

export function AdjustStockDialog({ open, onClose, productId }: { open: boolean; onClose: () => void; productId?: string }) {
  const { state, actions } = useInventory();
  const defaultWh = state.warehouses.find((w) => w.isDefault)?.id ?? state.warehouses[0]?.id ?? "";
  const { guard, pending, release } = useSubmitGuard();
  const form = useForm<AdjustmentFormValues>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: { productId: productId ?? "", warehouseId: defaultWh, direction: "decrease", quantity: undefined as unknown as number, reason: "", notes: "" },
  });
  const { register, handleSubmit, reset, setError, control, setValue, formState } = form;
  const errors = formState.errors;

  useEffect(() => {
    if (open) {
      reset({ productId: productId ?? "", warehouseId: defaultWh, direction: "decrease", quantity: undefined as unknown as number, reason: "", notes: "" });
      release();
    }
  }, [open, productId, defaultWh, reset, release]);

  const [pid, wid, direction, qty] = useWatch({ control, name: ["productId", "warehouseId", "direction", "quantity"] });
  const product = state.products.find((p) => p.id === pid);
  const current = product ? product.stock[wid] ?? 0 : 0;
  const q = Number.isFinite(qty) ? qty : 0;
  const next = direction === "increase" ? current + q : current - q;

  const onSubmit = (v: AdjustmentFormValues) =>
    guard(() => {
      if (v.direction === "decrease" && v.quantity > current) {
        setError("quantity", { message: `Only ${current} available in this warehouse` });
        return null;
      }
      const ref = actions.adjustStock(v);
      if (ref) onClose();
      return ref;
    });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Adjust stock"
      description="Record a manual correction. Every adjustment is written to stock history."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} loading={pending}>
            Save adjustment
          </Button>
        </>
      }
    >
      <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
        <Field label="Product" required error={errors.productId?.message}>
          <Select {...register("productId")} invalid={!!errors.productId}>
            <option value="">Select a product…</option>
            {state.products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.sku} ({totalStock(p)} on hand)
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Warehouse" required error={errors.warehouseId?.message}>
            <Select {...register("warehouseId")}>
              {state.warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Adjustment type" required>
            <div className="grid grid-cols-2 gap-1 rounded-[10px] bg-[#eef0f3] p-[3px]">
              {(["increase", "decrease"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setValue("direction", d)}
                  className={cn(
                    "inline-flex h-[30px] items-center justify-center gap-1 rounded-[8px] text-[12.5px] font-medium capitalize transition",
                    direction === d ? "bg-surface text-ink shadow-[0_1px_2px_rgba(16,24,40,0.08)]" : "text-muted hover:text-ink",
                  )}
                >
                  {d === "increase" ? <ArrowUpRight className="h-3.5 w-3.5 text-success" /> : <ArrowDownRight className="h-3.5 w-3.5 text-danger" />}
                  {d}
                </button>
              ))}
            </div>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Quantity" required error={errors.quantity?.message}>
            <Input type="number" min={1} step={1} inputMode="numeric" placeholder="0" {...register("quantity", { valueAsNumber: true })} invalid={!!errors.quantity} />
          </Field>
          <Field label="Reason" required error={errors.reason?.message}>
            <Select {...register("reason")} invalid={!!errors.reason}>
              <option value="">Select a reason…</option>
              {ADJUSTMENT_REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
          </Field>
        </div>

        {product && (
          <div className={cn("flex items-center justify-between rounded-[10px] border px-3.5 py-3 text-[13px]", next < 0 ? "border-danger-line bg-danger-bg" : "border-line bg-subtle")}>
            <span className="text-muted">Stock in {state.warehouses.find((w) => w.id === wid)?.name}</span>
            <span className="flex items-center gap-2 font-medium tabular">
              <span className="text-ink-2">{current}</span>
              <ArrowRight className="h-3.5 w-3.5 text-faint" />
              <span className={cn(next < 0 ? "text-danger" : next < current ? "text-ink" : "text-success")}>{next < 0 ? "Not allowed" : next}</span>
            </span>
          </div>
        )}

        <Field label="Notes" error={errors.notes?.message}>
          <Textarea rows={2} placeholder="Add context for your team (optional)" {...register("notes")} />
        </Field>
      </form>
    </Modal>
  );
}
