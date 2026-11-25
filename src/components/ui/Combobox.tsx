"use client";

/**
 * Combobox — the single select control for StockFlow (replaces native <select>).
 *
 * Keyboard: ↓/Enter/Space open · ↑↓ Home End move · Enter selects · Esc closes ·
 * Tab closes · typing while closed jumps to the next option starting with that
 * letter (type-ahead) · a search field appears automatically above 7 options.
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePopover } from "@/hooks/usePopover";
import { controlClass } from "./Field";

export interface ComboOption {
  value: string;
  label: string;
  /** Secondary line in the list (e.g. company, SKU). */
  description?: string;
  /** Extra text matched by search. */
  keywords?: string;
  disabled?: boolean;
  /** Right-aligned meta (e.g. "9 in stock"). */
  meta?: ReactNode;
}

export interface ComboboxProps {
  value: string | null;
  onChange: (value: string | null) => void;
  options: ComboOption[];
  placeholder?: string;
  /** Accessible name when there is no visible <label htmlFor>. */
  ariaLabel?: string;
  id?: string;
  size?: "sm" | "md";
  /** Toolbar filter style: renders "Label: Value" and highlights when not default. */
  filterLabel?: string;
  /** Value treated as "no filter" for the highlighted filter style. */
  defaultValue?: string;
  clearable?: boolean;
  searchable?: boolean;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
  panelWidth?: number;
  emptyText?: string;
}

export function Combobox({
  value,
  onChange,
  options,
  placeholder = "Select…",
  ariaLabel,
  id,
  size = "md",
  filterLabel,
  defaultValue,
  clearable,
  searchable,
  invalid,
  disabled,
  className,
  panelWidth,
  emptyText = "No matches",
}: ComboboxProps) {
  const autoId = useId();
  const listId = `${autoId}-list`;
  const { open, setOpen, anchorRef, panelRef, pos, mounted, closing } = usePopover({ width: panelWidth });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const showSearch = searchable ?? options.length > 7;

  const selected = options.find((o) => o.value === value) ?? null;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => `${o.label} ${o.description ?? ""} ${o.keywords ?? ""}`.toLowerCase().includes(q));
  }, [options, query]);

  // On open: reset search, highlight the current value, focus search (or list).
  useEffect(() => {
    if (!open) return;
    setQuery("");
    const i = Math.max(0, options.findIndex((o) => o.value === value));
    setActive(i);
    const t = window.setTimeout(() => (showSearch ? searchRef.current : listRef.current)?.focus(), 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per opening
  }, [open]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const commit = (o: ComboOption | undefined) => {
    if (!o || o.disabled) return;
    onChange(o.value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const move = (dir: 1 | -1, from = active) => {
    if (!filtered.length) return;
    let i = from;
    for (let n = 0; n < filtered.length; n++) {
      i = (i + dir + filtered.length) % filtered.length;
      if (!filtered[i].disabled) break;
    }
    setActive(i);
  };

  const onListKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      move(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      move(-1);
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(filtered.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      commit(filtered[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    } else if (!showSearch && e.key.length === 1 && /\S/.test(e.key)) {
      // type-ahead inside an open list without search
      const k = e.key.toLowerCase();
      const start = active + 1;
      const idx = [...filtered.slice(start), ...filtered.slice(0, start)].findIndex((o) => o.label.toLowerCase().startsWith(k));
      if (idx >= 0) setActive((start + idx) % filtered.length);
    }
  };

  const onTriggerKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (open) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
    } else if (e.key.length === 1 && /\S/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // type-ahead while closed: select the next option starting with the letter
      const k = e.key.toLowerCase();
      const cur = options.findIndex((o) => o.value === value);
      const order = [...options.slice(cur + 1), ...options.slice(0, cur + 1)];
      const hit = order.find((o) => !o.disabled && o.label.toLowerCase().startsWith(k));
      if (hit) {
        e.preventDefault();
        onChange(hit.value);
      }
    }
  };

  const isFiltered = filterLabel !== undefined && value !== (defaultValue ?? null);
  const display = selected?.label ?? placeholder;

  return (
    <div ref={anchorRef} className={cn("relative min-w-0", className)}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel ?? filterLabel}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKey}
        className={cn(
          controlClass,
          "flex items-center gap-2 text-left",
          size === "sm" ? "h-8 text-body-sm" : "h-9",
          filterLabel !== undefined && "border-line-strong",
          isFiltered && "border-petrol-100 bg-petrol-50/60",
          clearable && selected ? "pr-14" : "pr-8",
        )}
      >
        {filterLabel !== undefined && <span className="shrink-0 text-muted">{filterLabel}:</span>}
        <span className={cn("min-w-0 flex-1 truncate", !selected && filterLabel === undefined && "text-faint", isFiltered && "font-medium text-petrol-700")}>
          {display}
        </span>
      </button>
      {clearable && selected && !disabled && (
        <button
          type="button"
          onClick={() => {
            onChange(null);
            triggerRef.current?.focus();
          }}
          className="absolute top-1/2 right-7 grid size-5 -translate-y-1/2 place-items-center rounded-tag text-faint hover:bg-hover hover:text-ink"
          aria-label="Clear selection"
        >
          <X className="size-3.5" />
        </button>
      )}
      <ChevronDown
        className={cn("pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted transition-transform duration-[120ms]", open && "rotate-180")}
        aria-hidden
      />

      {mounted &&
        createPortal(
          <div
            ref={panelRef}
            style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: pos?.width, maxHeight: pos?.maxHeight }}
            className={cn(
              "fixed z-[85] flex flex-col overflow-hidden rounded-panel border border-line bg-surface shadow-pop",
              closing ? "pointer-events-none animate-pop-out" : "animate-pop-in",
            )}
            inert={closing}
          >
            {showSearch && (
              <div className="flex items-center gap-2 border-b border-line px-2.5">
                <Search className="size-4 text-faint" aria-hidden />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onListKey}
                  placeholder="Search…"
                  aria-label="Search options"
                  aria-controls={listId}
                  aria-activedescendant={filtered[active] ? `${listId}-${active}` : undefined}
                  className="h-9 min-w-0 flex-1 bg-transparent text-body-sm text-ink placeholder:text-faint focus:outline-none"
                />
              </div>
            )}
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              tabIndex={-1}
              aria-label={ariaLabel ?? filterLabel ?? placeholder}
              aria-activedescendant={!showSearch && filtered[active] ? `${listId}-${active}` : undefined}
              onKeyDown={onListKey}
              className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-1 focus:outline-none"
            >
              {filtered.length === 0 ? (
                <li className="px-2.5 py-3 text-center text-body-sm text-muted">{emptyText}</li>
              ) : (
                filtered.map((o, i) => {
                  const isSel = o.value === value;
                  return (
                    <li
                      key={o.value}
                      id={`${listId}-${i}`}
                      data-i={i}
                      role="option"
                      aria-selected={isSel}
                      aria-disabled={o.disabled || undefined}
                      onMouseMove={() => !o.disabled && setActive(i)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => commit(o)}
                      className={cn(
                        "flex min-h-8 cursor-pointer items-center gap-2 rounded-control px-2.5 py-1.5 text-body-sm text-ink-2",
                        i === active && "bg-hover text-ink",
                        o.disabled && "cursor-not-allowed opacity-45",
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className={cn("block truncate", isSel && "font-medium text-ink")}>{o.label}</span>
                        {o.description && <span className="block truncate text-label text-muted">{o.description}</span>}
                      </span>
                      {o.meta && <span className="shrink-0 text-label text-muted tabular">{o.meta}</span>}
                      <Check className={cn("size-4 shrink-0 text-petrol-500", !isSel && "invisible")} aria-hidden />
                    </li>
                  );
                })
              )}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  );
}
