"use client";

import { useEffect, useState } from "react";
import type { Sale } from "@/types";
import { useInventory } from "@/context/InventoryContext";
import { currencySymbol, formatCurrency, round2 } from "@/lib/utils";
import { Modal } from "@/components/ui/Overlay";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { useSubmitGuard } from "@/hooks/useSubmitGuard";

export function RecordPaymentDialog({ open, onClose, sale }: { open: boolean; onClose: () => void; sale: Sale | null }) {
  const { actions } = useInventory();
  const due = sale ? round2(sale.total - sale.amountPaid) : 0;
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const { guard, pending, release } = useSubmitGuard();

  useEffect(() => {
    // Initialise once per opening.
    if (open) {
      setAmount(String(due));
      setError("");
      release();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!sale) return null;

  const submit = () =>
    guard(() => {
      const n = Number(amount);
      if (!(n > 0)) {
        setError("Enter an amount greater than 0");
        return null;
      }
      if (round2(n) > due) {
        setError(`Cannot exceed balance due of ${formatCurrency(due)}`);
        return null;
      }
      const updated = actions.recordPayment(sale.id, n);
      if (updated) onClose();
      return updated;
    });

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Record payment"
      description={`${sale.invoiceNo} · ${sale.customerName}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={pending}>Record payment</Button>
        </>
      }
    >
      <dl className="mb-4 grid grid-cols-3 gap-3 rounded-panel bg-subtle p-3 text-small">
        <div>
          <dt className="text-muted">Invoice total</dt>
          <dd className="mt-0.5 font-medium text-ink tabular">{formatCurrency(sale.total)}</dd>
        </div>
        <div>
          <dt className="text-muted">Paid</dt>
          <dd className="mt-0.5 font-medium text-ink tabular">{formatCurrency(sale.amountPaid)}</dd>
        </div>
        <div>
          <dt className="text-muted">Balance due</dt>
          <dd className="mt-0.5 font-semibold text-danger tabular">{formatCurrency(due)}</dd>
        </div>
      </dl>
      <Field label="Amount received" required error={error}>
        <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} invalid={!!error} leading={currencySymbol()} />
      </Field>
    </Modal>
  );
}
