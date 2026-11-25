"use client";

import { BookOpen, Keyboard, Mail, Workflow } from "lucide-react";
import { Modal } from "@/components/ui/Overlay";
import { Button } from "@/components/ui/Button";
import { GO_SHORTCUTS } from "./nav";

const WORKFLOWS = [
  { title: "Selling stock", body: "Sales → New sale. Stock is deducted from the chosen warehouse when the invoice is created. Cancelling restores it exactly once." },
  { title: "Restocking", body: "Purchases → New purchase order. Stock does not change until you receive items — receive all at once or in partial deliveries." },
  { title: "Corrections", body: "Stock → Adjust stock for damaged goods, audits or returns. Every change is written to stock history with a reference." },
  { title: "Moving stock", body: "Transfers moves quantity between Main and Retail warehouses, either instantly or as an in-transit shipment." },
];

export function HelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Help & Support"
      description="How StockFlow works, and how to reach us."
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-body font-semibold text-ink">
            <Workflow className="h-4 w-4 text-brand" /> Core workflows
          </h3>
          <ol className="space-y-3">
            {WORKFLOWS.map((w, i) => (
              <li key={w.title} className="flex gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-50 text-caption font-semibold text-brand">{i + 1}</span>
                <div>
                  <div className="text-body font-medium text-ink">{w.title}</div>
                  <p className="text-small leading-relaxed text-muted">{w.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <div className="space-y-5">
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-body font-semibold text-ink">
              <Keyboard className="h-4 w-4 text-brand" /> Shortcuts
            </h3>
            <dl className="space-y-2 text-small">
              {[
                ["Search anything", "Ctrl K"],
                ["Show shortcuts", "?"],
                ["Toggle sidebar", "Ctrl \\"],
                ["Close dialogs", "Esc"],
                ...GO_SHORTCUTS.map((g) => [`Go to ${g.label}`, `G ${g.key.toUpperCase()}`]),
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between">
                  <dt className="text-ink-2">{k}</dt>
                  <dd>
                    <kbd className="rounded border border-line bg-subtle px-1.5 py-px text-micro font-medium text-muted">{v}</kbd>
                  </dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="rounded-panel border border-line bg-subtle p-3.5">
            <h3 className="mb-1 flex items-center gap-2 text-body font-semibold text-ink">
              <BookOpen className="h-4 w-4 text-brand" /> About this demo
            </h3>
            <p className="text-small leading-relaxed text-muted">
              All data lives in your browser (localStorage). Use “Reset demo data” from the profile menu to start over.
            </p>
          </section>
          <a href="mailto:support@stockflow.demo" className="flex items-center gap-2 text-body font-medium text-brand hover:underline">
            <Mail className="h-4 w-4" /> support@stockflow.demo
          </a>
        </div>
      </div>
    </Modal>
  );
}
