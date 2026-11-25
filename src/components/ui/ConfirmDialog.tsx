"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { Modal } from "./Overlay";
import { Button } from "./Button";
import { Field, Textarea } from "./Field";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  /** Return false to keep the dialog open (e.g. the action failed). */
  onConfirm: (reason: string) => boolean | void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  tone?: "danger" | "primary";
  reasonLabel?: string;
  /**
   * When set, the action is not allowed: the dialog explains why and offers
   * only a dismiss button, so there is never a dead destructive button.
   */
  blockedReason?: string | null;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  tone = "danger",
  reasonLabel,
  blockedReason,
}: ConfirmDialogProps) {
  const [reason, setReason] = useState("");
  const busy = useRef(false);
  // Keep the variant stable while the dialog animates out (callers clear their selection on close).
  const frozenBlocked = useRef(blockedReason);
  if (open) frozenBlocked.current = blockedReason;

  useEffect(() => {
    if (open) {
      setReason("");
      busy.current = false;
    }
  }, [open]);

  const handle = () => {
    if (busy.current) return; // ignore double clicks
    busy.current = true;
    const ok = onConfirm(reason.trim());
    if (ok === false) busy.current = false;
    else onClose();
  };

  if (frozenBlocked.current) {
    return (
      <Modal open={open} onClose={onClose} size="sm" title={title.replace(/^Delete\b/, "Can't delete").replace(/\?$/, "")} footer={<Button onClick={onClose} data-autofocus>Got it</Button>}>
        <div className="flex gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-info-bg text-info">
            <Info className="h-[18px] w-[18px]" />
          </div>
          <p className="pt-1 text-body leading-relaxed text-ink-2">{frozenBlocked.current}</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} data-autofocus={reasonLabel ? undefined : true}>
            Keep it
          </Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} onClick={handle}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3">
        <div className={tone === "danger" ? "grid h-9 w-9 shrink-0 place-items-center rounded-full bg-danger-bg text-danger" : "grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-brand"}>
          <AlertTriangle className="h-[18px] w-[18px]" />
        </div>
        <div className="min-w-0 flex-1 space-y-3 pt-1 text-body leading-relaxed text-ink-2">
          <div>{description}</div>
          {reasonLabel && (
            <Field label={reasonLabel}>
              <Textarea rows={2} className="min-h-[64px]" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional — visible on the invoice record" data-autofocus />
            </Field>
          )}
        </div>
      </div>
    </Modal>
  );
}
