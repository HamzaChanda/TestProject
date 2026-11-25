"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CornerDownLeft, Search } from "lucide-react";
import type { Product } from "@/types";
import { productStatus } from "@/lib/calc";
import { cn, formatCurrency } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/Badge";

/**
 * Search-as-you-type product selector (a combobox over the catalogue).
 * `stockOf` shows stock for the relevant warehouse, `stockLabel` names it
 * ("12 in MWH"); `priceOf` chooses selling vs. cost price.
 */
export function ProductPicker({
  products,
  onPick,
  excludeIds,
  stockOf,
  stockLabel,
  priceOf,
  disableOutOfStock,
  placeholder = "Add a product — search by name or SKU",
  inputId,
}: {
  products: Product[];
  onPick: (p: Product) => void;
  excludeIds: string[];
  stockOf: (p: Product) => number;
  stockLabel?: (qty: number) => string;
  priceOf: (p: Product) => number;
  disableOutOfStock?: boolean;
  placeholder?: string;
  inputId?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
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
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const isDisabled = (p: Product) => !!disableOutOfStock && stockOf(p) <= 0;

  const pick = (p: Product | undefined) => {
    if (!p || isDisabled(p)) return;
    onPick(p);
    setQuery("");
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-faint" aria-hidden />
      <input
        id={inputId}
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
            if (open) pick(results[active]);
            else setOpen(true);
          } else if (e.key === "Escape") {
            if (open) e.stopPropagation();
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        aria-label={inputId ? undefined : placeholder}
        className="h-9 w-full rounded-control border border-control bg-surface pr-3 pl-8 text-body text-ink placeholder:text-faint transition-[border-color,box-shadow] duration-[80ms] hover:border-ink-2 focus:border-petrol-500 focus:ring-[3px] focus:ring-petrol-500/20 focus:outline-none"
        role="combobox"
        aria-controls={listId}
        aria-expanded={open}
        aria-autocomplete="list"
        aria-activedescendant={open && results[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
      />
      {open && (
        <div
          ref={listRef}
          className="scrollbar-thin absolute top-[calc(100%+4px)] right-0 left-0 z-30 max-h-[340px] animate-pop-in overflow-y-auto rounded-panel border border-line bg-surface p-1 shadow-pop"
          role="listbox"
          id={listId}
          aria-label="Products"
        >
          {results.length === 0 ? (
            <div className="px-3 py-6 text-center text-body-sm text-muted">{query ? `No products match “${query}”` : "All products have been added"}</div>
          ) : (
            results.map((p, i) => {
              const stock = stockOf(p);
              const disabled = isDisabled(p);
              return (
                <div
                  key={p.id}
                  id={`${listId}-${i}`}
                  data-idx={i}
                  role="option"
                  aria-selected={i === active}
                  aria-disabled={disabled || undefined}
                  onMouseMove={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(p)}
                  className={cn(
                    "flex h-11 cursor-pointer items-center gap-3 rounded-control px-2.5 text-left transition-colors duration-[80ms]",
                    i === active && !disabled && "bg-hover",
                    disabled && "cursor-not-allowed opacity-50",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body-sm font-medium text-ink">{p.name}</span>
                    <span className="block text-label text-muted">
                      <span className="font-mono text-ink-2">{p.sku}</span> · <span className="font-mono">{stock}</span>
                      {stockLabel ? stockLabel(stock).replace(/^\d+/, "") : " available"}
                    </span>
                  </span>
                  <span className="hidden sm:block">
                    {stock <= 0 || productStatus(p) !== "In Stock" ? <StatusBadge status={stock <= 0 ? "Out of Stock" : productStatus(p)} /> : null}
                  </span>
                  <span className="w-[88px] text-right font-mono text-[12.5px] text-ink">{formatCurrency(priceOf(p))}</span>
                  <CornerDownLeft className={cn("size-3.5", i === active && !disabled ? "text-muted" : "text-transparent")} aria-hidden />
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
