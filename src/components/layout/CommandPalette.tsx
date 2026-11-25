"use client";

import { useNavigate } from "@/hooks/useNavigate";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { ArrowRight, Building2, CornerDownLeft, FileText, Package, Plus, Search, ShoppingCart, Users } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { totalStock } from "@/lib/calc";
import { useInventory } from "@/context/InventoryContext";
import { NAV_SECTIONS } from "./nav";
import { usePresence } from "@/hooks/usePresence";
import { QUICK_CREATE } from "./Header";

interface Result {
  id: string;
  group: string;
  label: string;
  sub?: string;
  href: string;
  icon: React.ReactNode;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state } = useInventory();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { mounted, closing } = usePresence(open, 130);

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return [
        ...QUICK_CREATE.map((a) => ({ id: `qc-${a.href}`, group: "Quick actions", label: a.label, href: a.href, icon: <Plus /> })),
        ...NAV_SECTIONS.flatMap((s) => s.items).map((n) => ({ id: `nav-${n.href}`, group: "Go to", label: n.label, href: n.href, icon: <n.icon /> })),
      ];
    }
    const has = (...fields: string[]) => fields.some((f) => f.toLowerCase().includes(q));
    const out: Result[] = [];
    state.products
      .filter((p) => has(p.name, p.sku, p.category))
      .slice(0, 6)
      .forEach((p) => out.push({ id: p.id, group: "Products", label: p.name, sub: `${p.sku} · ${totalStock(p)} in stock`, href: `/products/${p.id}`, icon: <Package /> }));
    state.sales
      .filter((s) => has(s.invoiceNo, s.customerName))
      .slice(0, 5)
      .forEach((s) => out.push({ id: s.id, group: "Invoices", label: s.invoiceNo, sub: `${s.customerName} · ${formatCurrency(s.total)} · ${s.status}`, href: `/sales/${s.id}`, icon: <FileText /> }));
    state.purchases
      .filter((p) => has(p.poNumber, p.supplierName))
      .slice(0, 5)
      .forEach((p) => out.push({ id: p.id, group: "Purchase orders", label: p.poNumber, sub: `${p.supplierName} · ${p.status}`, href: `/purchases/${p.id}`, icon: <ShoppingCart /> }));
    state.customers
      .filter((c) => has(c.name, c.company, c.email, c.phone))
      .slice(0, 4)
      .forEach((c) => out.push({ id: c.id, group: "Customers", label: c.name, sub: c.company || c.email, href: `/customers/${c.id}`, icon: <Users /> }));
    state.suppliers
      .filter((s) => has(s.name, s.contactPerson, s.email))
      .slice(0, 4)
      .forEach((s) => out.push({ id: s.id, group: "Suppliers", label: s.name, sub: s.contactPerson, href: `/suppliers/${s.id}`, icon: <Building2 /> }));
    NAV_SECTIONS.flatMap((s) => s.items)
      .filter((n) => has(n.label))
      .forEach((n) => out.push({ id: `nav-${n.href}`, group: "Pages", label: n.label, href: n.href, icon: <n.icon /> }));
    return out;
  }, [query, state]);

  useEffect(() => setIndex(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: "nearest" });
  }, [index]);

  if (!mounted) return null;

  const go = (r: Result | undefined) => {
    if (!r) return;
    onClose();
    navigate(r.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[index]);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  let lastGroup = "";
  return createPortal(
    <div className={cn("fixed inset-0 z-[75] flex items-start justify-center px-3 pt-[10vh]", closing && "pointer-events-none")} onKeyDown={onKeyDown}>
      <div className={cn("absolute inset-0 bg-[#0f1220]/40 backdrop-blur-[2px]", closing ? "animate-fade-out" : "animate-fade-in")} onClick={onClose} />
      <div
        className={cn("relative w-full max-w-[600px] overflow-hidden rounded-[14px] border border-line bg-surface shadow-[var(--shadow-pop)]", closing ? "animate-pop-out" : "animate-pop-in")}
        role={closing ? undefined : "dialog"}
        aria-modal={closing ? undefined : true}
        aria-hidden={closing || undefined}
        inert={closing}
        aria-label="Search"
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="h-[18px] w-[18px] text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products, SKUs, invoices, customers, suppliers…"
            className="h-[52px] flex-1 bg-transparent text-[14.5px] text-ink placeholder:text-faint focus:outline-none"
            aria-label="Search"
          />
          <kbd className="rounded border border-line bg-subtle px-1.5 py-px text-[10.5px] font-medium text-muted">Esc</kbd>
        </div>
        <div ref={listRef} className="scrollbar-thin max-h-[min(420px,60vh)] overflow-y-auto p-1.5">
          {results.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <div className="text-[13.5px] font-medium text-ink">No results for “{query}”</div>
              <div className="mt-1 text-[12.5px] text-muted">Try a product name, SKU, invoice number or customer.</div>
            </div>
          ) : (
            results.map((r, i) => {
              const header = r.group !== lastGroup ? r.group : null;
              lastGroup = r.group;
              return (
                <div key={`${r.group}-${r.id}`}>
                  {header && <div className="px-2.5 pt-2.5 pb-1 text-[11px] font-semibold tracking-wide text-faint uppercase">{header}</div>}
                  <button
                    data-index={i}
                    onMouseMove={() => setIndex(i)}
                    onClick={() => go(r)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-[9px] px-2.5 py-2 text-left transition-colors [&_svg]:h-4 [&_svg]:w-4",
                      i === index ? "bg-brand-50 text-ink" : "text-ink-2",
                    )}
                  >
                    <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-[7px] border border-line bg-surface", i === index ? "text-brand" : "text-muted")}>{r.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium">{r.label}</span>
                      {r.sub && <span className="block truncate text-[12px] text-muted">{r.sub}</span>}
                    </span>
                    {i === index ? <CornerDownLeft className="text-brand" /> : <ArrowRight className="text-faint opacity-0" />}
                  </button>
                </div>
              );
            })
          )}
        </div>
        <div className="flex items-center gap-4 border-t border-line bg-subtle px-4 py-2 text-[11.5px] text-muted">
          <span>↑↓ to navigate</span>
          <span>↵ to open</span>
          <span className="ml-auto hidden sm:inline">Searches live inventory data</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
