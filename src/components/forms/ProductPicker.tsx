"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Plus, Search } from "lucide-react";
import type { Product } from "@/types";
import { productStatus } from "@/lib/calc";
import { cn, formatCurrency } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/Badge";
import { ProductThumb } from "@/components/ui/Primitives";

/**
 * Search-as-you-type product selector. `stockOf` lets the caller show stock
 * for the relevant warehouse; `priceOf` chooses selling vs. cost price.
 */
export function ProductPicker({
  products,
  onPick,
  excludeIds,
  stockOf,
  priceOf,
  disableOutOfStock,
  placeholder = "Search products by name or SKU to add…",
}: {
  products: Product[];
  onPick: (p: Product) => void;
  excludeIds: string[];
  stockOf: (p: Product) => number;
  priceOf: (p: Product) => number;
  disableOutOfStock?: boolean;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => !excludeIds.includes(p.id))
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
      .slice(0, 8);
  }, [products, excludeIds, query]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const isDisabled = (p: Product) => !!disableOutOfStock && stockOf(p) <= 0;

  const pick = (p: Product | undefined) => {
    if (!p || isDisabled(p)) return;
    onPick(p);
    setQuery("");
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-faint" />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(a + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(results[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        className="h-10 w-full rounded-panel border border-dashed border-line-strong bg-subtle pr-3 pl-9 text-ui text-ink placeholder:text-muted transition focus:border-solid focus:border-brand focus:bg-surface focus:ring-[3px] focus:ring-brand/15 focus:outline-none"
        role="combobox"
        aria-controls={listId}
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {open && (
        <div className="scrollbar-thin absolute top-[calc(100%+6px)] right-0 left-0 z-30 max-h-[340px] animate-pop-in overflow-y-auto rounded-card border border-line bg-surface p-1 shadow-[var(--shadow-pop)]" role="listbox" id={listId}>
          {results.length === 0 ? (
            <div className="px-3 py-6 text-center text-body text-muted">{query ? `No products match “${query}”` : "All products have been added"}</div>
          ) : (
            results.map((p, i) => {
              const stock = stockOf(p);
              const disabled = isDisabled(p);
              return (
                <button
                  type="button"
                  key={p.id}
                  role="option"
                  aria-selected={i === active}
                  aria-disabled={disabled}
                  onMouseMove={() => setActive(i)}
                  onClick={() => pick(p)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-control px-2.5 py-2 text-left transition-colors",
                    i === active && !disabled && "bg-brand-50",
                    disabled && "cursor-not-allowed opacity-50",
                  )}
                >
                  <ProductThumb name={p.name} category={p.category} size={30} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-medium text-ink">{p.name}</span>
                    <span className="block text-caption text-muted">
                      <span className="font-mono">{p.sku}</span> · {stock} available
                    </span>
                  </span>
                  <span className="hidden sm:block">
                    <StatusBadge status={stock <= 0 ? "Out of Stock" : productStatus(p)} />
                  </span>
                  <span className="w-[84px] text-right text-body font-medium text-ink tabular">{formatCurrency(priceOf(p))}</span>
                  <Plus className={cn("h-4 w-4", i === active ? "text-brand" : "text-faint")} />
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
