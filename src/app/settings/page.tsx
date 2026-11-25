"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Bell, Building2, Coins, Database, Percent, RotateCcw, Star, Warehouse as WarehouseIcon } from "lucide-react";
import type { CurrencyCode, Warehouse } from "@/types";
import { useInventory } from "@/context/InventoryContext";
import { settingsSchema, type SettingsFormValues } from "@/lib/validations";
import { CURRENCIES, TAX_PRESETS } from "@/lib/constants";
import { cn, formatCurrency } from "@/lib/utils";
import { downloadCsv } from "@/lib/csv";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PageHeader } from "@/components/ui/Primitives";

const SECTIONS = [
  { id: "business", label: "Business profile", icon: Building2 },
  { id: "currency", label: "Currency", icon: Coins },
  { id: "tax", label: "Tax", icon: Percent },
  { id: "warehouses", label: "Warehouses", icon: WarehouseIcon },
  { id: "data", label: "Notifications & data", icon: Database },
];

/** Highlights the settings section currently in view. */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-90px 0px -55% 0px" },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [ids]);
  return [active, setActive] as const;
}

const SECTION_IDS = SECTIONS.map((s) => s.id);

export default function SettingsPage() {
  const [active, setActive] = useActiveSection(SECTION_IDS);
  return (
    <>
      <PageHeader title="Settings" description="Configure your business, currency, tax and warehouses." />
      <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav className="hidden lg:block">
          <ul className="sticky top-[84px] space-y-0.5">
            {SECTIONS.map((sec) => (
              <li key={sec.id}>
                <a
                  href={`#${sec.id}`}
                  onClick={() => setActive(sec.id)}
                  aria-current={active === sec.id ? "true" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-control px-2.5 py-2 text-body-sm font-medium transition-colors",
                    active === sec.id ? "bg-surface text-ink shadow-[var(--shadow-card)] ring-1 ring-line" : "text-muted hover:bg-surface/70 hover:text-ink",
                  )}
                >
                  <sec.icon className={cn("h-4 w-4", active === sec.id ? "text-brand" : "text-faint")} /> {sec.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0 space-y-5">
          <BusinessProfile />
          <CurrencySettings />
          <TaxSettings />
          <WarehouseSettings />
          <DataSettings />
        </div>
      </div>
    </>
  );
}

function BusinessProfile() {
  const { state, actions } = useInventory();
  const s = state.settings;
  const { register, handleSubmit, reset, formState } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: { businessName: s.businessName, legalName: s.legalName, email: s.email, phone: s.phone, address: s.address, gstin: s.gstin, invoicePrefix: s.invoicePrefix, purchasePrefix: s.purchasePrefix },
  });
  const errors = formState.errors;
  const onSubmit = (v: SettingsFormValues) => {
    if (actions.updateSettings(v, "Business profile saved.")) reset(v);
  };
  return (
    <Card id="business" className="scroll-mt-24">
      <CardHeader title="Business profile" description="Appears on invoices, purchase orders and printed reports." />
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Business name" required error={errors.businessName?.message}>
            <Input {...register("businessName")} invalid={!!errors.businessName} />
          </Field>
          <Field label="Legal name" error={errors.legalName?.message}>
            <Input {...register("legalName")} />
          </Field>
          <Field label="Email" required error={errors.email?.message}>
            <Input type="email" {...register("email")} invalid={!!errors.email} />
          </Field>
          <Field label="Phone" error={errors.phone?.message}>
            <Input {...register("phone")} />
          </Field>
          <Field label="Address" className="sm:col-span-2" error={errors.address?.message}>
            <Textarea rows={2} {...register("address")} />
          </Field>
          <Field label="GSTIN" error={errors.gstin?.message}>
            <Input className="font-mono uppercase" {...register("gstin")} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Invoice prefix" error={errors.invoicePrefix?.message} hint="e.g. INV-2026-0001">
              <Input className="font-mono uppercase" {...register("invoicePrefix", { setValueAs: (v: string) => v.toUpperCase() })} invalid={!!errors.invoicePrefix} />
            </Field>
            <Field label="PO prefix" error={errors.purchasePrefix?.message}>
              <Input className="font-mono uppercase" {...register("purchasePrefix", { setValueAs: (v: string) => v.toUpperCase() })} invalid={!!errors.purchasePrefix} />
            </Field>
          </div>
        </CardBody>
        <div className="flex items-center justify-end gap-2 border-t border-line bg-subtle px-5 py-3">
          {formState.isDirty && <span className="mr-auto text-label text-warning">Unsaved changes</span>}
          <Button variant="secondary" onClick={() => reset()} disabled={!formState.isDirty}>
            Discard
          </Button>
          <Button type="submit" disabled={!formState.isDirty}>
            Save changes
          </Button>
        </div>
      </form>
    </Card>
  );
}

function CurrencySettings() {
  const { state, actions } = useInventory();
  const s = state.settings;
  return (
    <Card id="currency" className="scroll-mt-24">
      <CardHeader title="Currency" description="Display currency for all amounts. Values are not converted." />
      <CardBody>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {CURRENCIES.map((c) => (
            <button
              key={c.code}
              onClick={() => c.code !== s.currency && actions.updateSettings({ currency: c.code as CurrencyCode }, `Currency set to ${c.label}.`)}
              className={cn(
                "flex items-center gap-3 rounded-panel border p-3 text-left transition",
                s.currency === c.code ? "border-brand bg-brand-50/50 ring-[3px] ring-brand/10" : "border-line hover:border-line-strong",
              )}
            >
              <span className="grid h-9 w-9 place-items-center rounded-control bg-surface text-body-sm font-semibold text-ink ring-1 ring-line">{c.symbol}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-body-sm font-medium text-ink">{c.code}</span>
                <span className="block text-label text-muted">{c.label}</span>
              </span>
              {s.currency === c.code && <Badge tone="brand">Active</Badge>}
            </button>
          ))}
        </div>
        <p className="mt-3 text-label text-muted">
          Preview: <span className="font-medium text-ink tabular">{formatCurrency(1284500)}</span>
        </p>
      </CardBody>
    </Card>
  );
}

function TaxSettings() {
  const { state, actions } = useInventory();
  const s = state.settings;
  const [rate, setRate] = useState(String(s.defaultTaxRate));
  const [error, setError] = useState("");
  const save = () => {
    const n = Number(rate);
    if (rate.trim() === "" || !Number.isFinite(n) || n < 0 || n > 100) return setError("Enter a rate between 0 and 100");
    setError("");
    actions.updateSettings({ defaultTaxRate: n }, `Default tax rate set to ${n}%.`);
  };
  return (
    <Card id="tax" className="scroll-mt-24">
      <CardHeader title="Tax" description="Default GST applied to new sales and purchase orders. Existing invoices keep their original rate." />
      <CardBody className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {TAX_PRESETS.map((t) => (
            <button
              key={t}
              onClick={() => setRate(String(t))}
              className={cn("h-8 rounded-full border px-3 text-label font-medium transition", Number(rate) === t ? "border-brand bg-brand-50 text-brand" : "border-line text-ink-2 hover:border-line-strong")}
            >
              {t}%
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Default tax rate" error={error} className="w-[180px]">
            <Input type="number" min={0} max={100} step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} trailing="%" invalid={!!error} />
          </Field>
          <Button onClick={save} disabled={Number(rate) === s.defaultTaxRate}>
            Save tax rate
          </Button>
        </div>
        <p className="text-label text-muted">
          Current default: <span className="font-medium text-ink">{s.defaultTaxRate}%</span> · split as CGST {s.defaultTaxRate / 2}% + SGST {s.defaultTaxRate / 2}% on invoices.
        </p>
      </CardBody>
    </Card>
  );
}

function WarehouseSettings() {
  const { state } = useInventory();
  return (
    <Card id="warehouses" className="scroll-mt-24">
      <CardHeader title="Warehouses" description="Rename locations and choose where new stock lands by default." />
      <CardBody className="space-y-3">
        {state.warehouses.map((w) => (
          <WarehouseRow key={w.id} warehouse={w} />
        ))}
      </CardBody>
    </Card>
  );
}

function WarehouseRow({ warehouse }: { warehouse: Warehouse }) {
  const { state, actions } = useInventory();
  const [name, setName] = useState(warehouse.name);
  const [location, setLocation] = useState(warehouse.location);
  const [code, setCode] = useState(warehouse.code);
  useEffect(() => {
    setName(warehouse.name);
    setLocation(warehouse.location);
    setCode(warehouse.code);
  }, [warehouse]);
  const dirty = name !== warehouse.name || location !== warehouse.location || code !== warehouse.code;
  const units = state.products.reduce((sum, p) => sum + (p.stock[warehouse.id] ?? 0), 0);
  return (
    <div className="rounded-panel border border-line p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-body-sm text-muted">
          <WarehouseIcon className="h-4 w-4" /> {units} units stored
          {warehouse.isDefault && (
            <Badge tone="brand" dot={false}>
              <Star className="h-3 w-3 fill-current" /> Default
            </Badge>
          )}
        </div>
        {!warehouse.isDefault && (
          <Button size="xs" variant="ghost" onClick={() => actions.setDefaultWarehouse(warehouse.id)}>
            Make default
          </Button>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_100px_auto] sm:items-end">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Location">
          <Input value={location} onChange={(e) => setLocation(e.target.value)} />
        </Field>
        <Field label="Code">
          <Input className="font-mono uppercase" maxLength={5} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
        </Field>
        <Button variant="secondary" disabled={!dirty} onClick={() => actions.updateWarehouse(warehouse.id, { name, location, code })}>
          Save
        </Button>
      </div>
    </div>
  );
}

function DataSettings() {
  const { state, actions } = useInventory();
  const s = state.settings;
  const [resetOpen, setResetOpen] = useState(false);
  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stockflow-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <Card id="data" className="scroll-mt-24">
      <CardHeader title="Notifications & data" />
      <CardBody className="space-y-4">
        <label className="flex cursor-pointer items-start justify-between gap-4 rounded-panel border border-line p-4">
          <span className="flex gap-3">
            <Bell className="mt-0.5 h-4 w-4 text-muted" />
            <span>
              <span className="block text-body-sm font-medium text-ink">Low-stock notifications</span>
              <span className="block text-label text-muted">Show alerts in the notification centre when products reach their minimum level.</span>
            </span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={s.lowStockNotifications}
            onClick={() => actions.updateSettings({ lowStockNotifications: !s.lowStockNotifications }, s.lowStockNotifications ? "Low-stock alerts turned off." : "Low-stock alerts turned on.")}
            className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", s.lowStockNotifications ? "bg-brand" : "bg-[#d4d7de]")}
          >
            <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", s.lowStockNotifications ? "left-[22px]" : "left-0.5")} />
          </button>
        </label>
        <div className="flex flex-col gap-3 rounded-panel border border-line p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-body-sm font-medium text-ink">Your data</div>
            <div className="text-label text-muted">
              Stored in this browser · {state.products.length} products, {state.sales.length} invoices, {state.purchases.length} POs, {state.movements.length} stock movements.
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="secondary" size="sm" onClick={exportBackup}>
              Download backup
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                downloadCsv(
                  "activity-log",
                  state.activities.map((a) => ({ Date: a.date, Activity: a.title, Description: a.description, Reference: a.reference ?? "" })),
                )
              }
            >
              Activity log
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-3 rounded-panel border border-danger-line bg-danger-bg/40 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-body-sm font-medium text-danger">Reset demo data</div>
            <div className="text-label text-muted">Replace everything in this browser with the original sample data.</div>
          </div>
          <Button variant="danger" size="sm" icon={<RotateCcw className="h-3.5 w-3.5" />} onClick={() => setResetOpen(true)}>
            Reset data
          </Button>
        </div>
      </CardBody>
      <ConfirmDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset demo data?"
        description="All products, invoices, purchase orders and history in this browser will be replaced with the original sample data."
        confirmLabel="Reset data"
        onConfirm={() => actions.resetDemoData()}
      />
    </Card>
  );
}
