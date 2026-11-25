"use client";

/**
 * DataTable v2 (Stock Ledger).
 * - 32px header row (overline), 40px rows (34px compact; density persisted per browser)
 * - sticky header under the 52px app header whenever the table fits its column
 * - optional selection column + bulk bar (pages pass only genuinely implemented actions)
 * - `rowTone` paints the 3px floor-tape stripe on the leading edge — never a row tint
 * - sort / page / page size can be controlled (URL state) or left internal (legacy pages)
 * - below 1024px rows render as stacked cards (or a custom `mobileCard`)
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Rows3, Rows4, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PAGE_SIZE } from "@/lib/constants";

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Provide to make the column sortable. */
  sortValue?: (row: T) => string | number;
  align?: "left" | "right" | "center";
  className?: string;
  headerClassName?: string;
  /** Hide this column in the stacked mobile card. */
  hideOnMobile?: boolean;
  /** Hide this (secondary) column below a width: laptop ≥1280px, desktop ≥1380px, wide ≥1536px. */
  hideBelow?: "laptop" | "desktop" | "wide";
  /** Label shown in the stacked mobile card (defaults to header). */
  mobileLabel?: string;
}

export type RowTone = "danger" | "warning" | "muted";
type Sort = { key: string; dir: "asc" | "desc" };

interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
  pageSize?: number;
  initialSort?: Sort;
  /** Legacy escape hatch for row classes (prefer `rowTone`). */
  rowClassName?: (row: T) => string | undefined;
  /** Attention stripe on the leading edge; "muted" dims the row (e.g. cancelled). */
  rowTone?: (row: T) => RowTone | undefined;
  /** Column keys rendered as the card title / trailing slot on mobile. */
  mobilePrimary?: string;
  mobileTrailing?: string;
  mobileActions?: string;
  /** Fully custom mobile card. */
  mobileCard?: (row: T) => ReactNode;
  /** Reset to page 1 whenever this changes (uncontrolled paging only). */
  resetKey?: string;
  className?: string;
  /** Force compact rows. */
  dense?: boolean;
  /** Minimum table width before it scrolls horizontally (default 600px). */
  minWidth?: number;
  /** Controlled sorting. */
  sort?: Sort;
  onSortChange?: (s: Sort) => void;
  /** Controlled paging. */
  page?: number;
  onPageChange?: (p: number) => void;
  onPageSizeChange?: (n: number) => void;
  pageSizeOptions?: readonly number[];
  /** Selection (by rowKey). */
  selected?: Set<string>;
  onSelectedChange?: (next: Set<string>) => void;
  /** Bulk bar content for the selected rows. */
  bulkActions?: (rows: T[], clear: () => void) => ReactNode;
  /** Accessible table name. */
  label?: string;
  /** Noun for counts, e.g. "invoices". */
  noun?: string;
}

const HIDE_BELOW = {
  laptop: "hidden xl:table-cell",
  desktop: "hidden min-[1380px]:table-cell",
  wide: "hidden 2xl:table-cell",
} as const;

const DENSITY_KEY = "stockflow:table-density";

/** The row-actions column stays pinned to the right edge so menus are always reachable. */
const STICKY = "sticky right-0 z-[1] bg-inherit";
/** Separator shadow only while the table actually scrolls sideways. */
const STICKY_EDGE = "shadow-[-8px_0_8px_-8px_rgba(17,22,20,0.10)]";

const STRIPE: Record<Exclude<RowTone, "muted">, string> = {
  danger: "before:bg-danger-solid",
  warning: "before:bg-signal",
};

function readDensity(): "comfortable" | "compact" {
  try {
    return window.localStorage.getItem(DENSITY_KEY) === "compact" ? "compact" : "comfortable";
  } catch {
    return "comfortable";
  }
}

function Checkbox({ checked, indeterminate, onChange, label }: { checked: boolean; indeterminate?: boolean; onChange: (v: boolean) => void; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate && !checked;
  }, [indeterminate, checked]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      aria-label={label}
      onChange={(e) => onChange(e.target.checked)}
      onClick={(e) => e.stopPropagation()}
      className="size-4 cursor-pointer rounded-tag accent-[var(--color-petrol-500)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    />
  );
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  empty,
  pageSize: pageSizeProp = PAGE_SIZE,
  initialSort,
  rowClassName,
  rowTone,
  mobilePrimary,
  mobileTrailing,
  mobileActions = "actions",
  mobileCard,
  resetKey,
  className,
  dense,
  minWidth = 600,
  sort: sortProp,
  onSortChange,
  page: pageProp,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions,
  selected,
  onSelectedChange,
  bulkActions,
  label,
  noun = "rows",
}: DataTableProps<T>) {
  const [sortState, setSortState] = useState<Sort | null>(initialSort ?? null);
  const [pageState, setPageState] = useState(1);
  const sort = sortProp ?? sortState;
  const page = pageProp ?? pageState;
  const setPage = (p: number) => (onPageChange ? onPageChange(p) : setPageState(p));
  const pageSize = pageSizeProp;

  const [density, setDensity] = useState(readDensity);
  const compact = dense || density === "compact";
  const toggleDensity = () => {
    const next = density === "compact" ? "comfortable" : "compact";
    setDensity(next);
    try {
      window.localStorage.setItem(DENSITY_KEY, next);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (!onPageChange) setPageState(1);
  }, [resetKey, onPageChange]);

  // Sticky header needs a non-scrolling ancestor; only allow x-scroll when the table overflows.
  const scrollRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [fits, setFits] = useState(true);
  useLayoutEffect(() => {
    const box = scrollRef.current;
    const table = tableRef.current;
    if (!box || !table) return;
    const measure = () => setFits(table.scrollWidth <= box.clientWidth + 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    ro.observe(table);
    return () => ro.disconnect();
  }, [rows.length, columns.length]);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const get = col.sortValue;
    return [...rows].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), undefined, { numeric: true });
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [rows, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(Math.max(1, page), pageCount);
  const visible = sorted.slice((current - 1) * pageSize, current * pageSize);

  const toggleSort = (key: string) => {
    const next: Sort | null = sort?.key === key ? (sort.dir === "asc" ? { key, dir: "desc" } : initialSort && onSortChange ? initialSort : null) : { key, dir: "asc" };
    if (onSortChange) onSortChange(next ?? initialSort ?? { key, dir: "asc" });
    else setSortState(next);
  };

  // Selection is pruned to rows that still exist in the current result.
  const selectable = !!onSelectedChange && !!selected;
  const allKeys = useMemo(() => new Set(sorted.map(rowKey)), [sorted, rowKey]);
  const selectedRows = selectable ? sorted.filter((r) => selected!.has(rowKey(r))) : [];
  const pageKeys = visible.map(rowKey);
  const pageAll = selectable && pageKeys.length > 0 && pageKeys.every((k) => selected!.has(k));
  const pageSome = selectable && pageKeys.some((k) => selected!.has(k));
  const setSel = (next: Set<string>) => onSelectedChange?.(new Set([...next].filter((k) => allKeys.has(k))));
  const toggleRow = (k: string, on: boolean) => {
    const n = new Set(selected);
    if (on) n.add(k);
    else n.delete(k);
    setSel(n);
  };
  const togglePage = (on: boolean) => {
    const n = new Set(selected);
    for (const k of pageKeys) {
      if (on) n.add(k);
      else n.delete(k);
    }
    setSel(n);
  };
  const clear = () => onSelectedChange?.(new Set());

  if (rows.length === 0) return <>{empty}</>;

  const primary = columns.find((c) => c.key === mobilePrimary) ?? columns[0];
  const trailing = columns.find((c) => c.key === mobileTrailing);
  const actions = columns.find((c) => c.key === mobileActions);
  const rest = columns.filter((c) => c !== primary && c !== trailing && c !== actions && !c.hideOnMobile);
  const showFooter = sorted.length > pageSize || !!pageSizeOptions;

  return (
    <div className={className}>
      {/* Bulk bar */}
      {selectable && selectedRows.length > 0 && (
        <div role="region" aria-label="Bulk actions" className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-2 border-t border-petrol-100 bg-petrol-50 px-4 py-1.5 md:px-5">
          <span className="text-body-sm font-medium text-petrol-700" aria-live="polite">
            <span className="font-mono">{selectedRows.length}</span> selected
          </span>
          {selectedRows.length < sorted.length && (
            <button onClick={() => setSel(allKeys)} className="text-body-sm font-medium text-petrol-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand">
              Select all {sorted.length} {noun}
            </button>
          )}
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            {bulkActions?.(selectedRows, clear)}
            <button onClick={clear} className="grid size-7 place-items-center rounded-control text-petrol-700 hover:bg-petrol-100 focus-visible:outline-2 focus-visible:outline-brand" aria-label="Clear selection">
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Table ≥1024px */}
      <div ref={scrollRef} className={cn("scrollbar-thin hidden lg:block", fits ? "overflow-x-clip" : "overflow-x-auto")}>
        <table ref={tableRef} aria-label={label} className="w-full border-separate border-spacing-0 text-left" style={{ minWidth }}>
          <thead>
            <tr>
              {selectable && (
                <th scope="col" className={cn("w-10 border-y border-line bg-subtle pr-0 pl-5", fits && "sticky top-header z-[2]")}>
                  <Checkbox checked={pageAll} indeterminate={pageSome} onChange={togglePage} label="Select all rows on this page" />
                </th>
              )}
              {columns.map((c, ci) => (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={sort?.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                  className={cn(
                    "h-8 border-y border-line bg-subtle px-3 font-cond text-overline font-semibold tracking-[0.06em] whitespace-nowrap text-muted uppercase last:pr-5",
                    ci === 0 && !selectable && "pl-5",
                    fits && "sticky top-header z-[2]",
                    c.hideBelow && HIDE_BELOW[c.hideBelow],
                    c.key === mobileActions && cn(STICKY, "z-[3]", !fits && STICKY_EDGE),
                    c.align === "right" && "text-right",
                    c.align === "center" && "text-center",
                    c.headerClassName,
                  )}
                >
                  {c.sortValue ? (
                    <button
                      onClick={() => toggleSort(c.key)}
                      className={cn(
                        "group inline-flex items-center gap-1 uppercase transition-colors duration-[80ms] hover:text-ink focus-visible:outline-2 focus-visible:outline-brand",
                        sort?.key === c.key && "text-ink",
                        c.align === "right" && "flex-row-reverse",
                      )}
                    >
                      {c.header}
                      {sort?.key === c.key ? (
                        sort.dir === "asc" ? (
                          <ArrowUp className="size-3" />
                        ) : (
                          <ArrowDown className="size-3" />
                        )
                      ) : (
                        <ChevronsUpDown className="size-3 opacity-0 transition-opacity group-hover:opacity-60" />
                      )}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const k = rowKey(row);
              const tone = rowTone?.(row);
              const isSel = selectable && selected!.has(k);
              return (
                <tr
                  key={k}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  aria-selected={selectable ? isSel : undefined}
                  className={cn(
                    "group/row transition-colors duration-[80ms]",
                    // Rows keep an opaque background so the pinned actions cell can inherit it.
                    rowClassName?.(row) || (isSel ? "bg-petrol-50/60" : "bg-surface hover:bg-row-hover"),
                    tone === "muted" && "[&>td>*]:opacity-55",
                    onRowClick && "cursor-pointer",
                  )}
                >
                  {selectable && (
                    <td className={cn("relative w-10 border-b border-line pr-0 pl-5 group-last/row:border-b-0", tone && tone !== "muted" && stripeCls(tone))}>
                      <Checkbox checked={isSel} onChange={(on) => toggleRow(k, on)} label={`Select row ${k}`} />
                    </td>
                  )}
                  {columns.map((c, ci) => (
                    <td
                      key={c.key}
                      className={cn(
                        "border-b border-line px-3 text-body-sm whitespace-nowrap text-ink-2 group-last/row:border-b-0 last:pr-5",
                        compact ? "h-[34px] py-1" : "h-10 py-1.5",
                        ci === 0 && !selectable && cn("pl-5", tone && tone !== "muted" && cn("relative", stripeCls(tone))),
                        c.hideBelow && HIDE_BELOW[c.hideBelow],
                        c.key === mobileActions && cn(STICKY, !fits && STICKY_EDGE),
                        c.align === "right" && "text-right",
                        c.align === "center" && "text-center",
                        c.className,
                      )}
                    >
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Stacked cards <1024px */}
      <ul className="divide-y divide-line border-t border-line lg:hidden" aria-label={label}>
        {visible.map((row) => {
          const k = rowKey(row);
          const tone = rowTone?.(row);
          return (
            <li
              key={k}
              className={cn(
                "relative flex gap-3 px-4 py-3.5",
                onRowClick && "cursor-pointer active:bg-subtle",
                tone === "muted" && "[&>div]:opacity-55",
                tone && tone !== "muted" && stripeCls(tone),
                rowClassName?.(row),
              )}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {selectable && (
                <div className="pt-0.5">
                  <Checkbox checked={selected!.has(k)} onChange={(on) => toggleRow(k, on)} label={`Select row ${k}`} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                {mobileCard ? (
                  mobileCard(row)
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 text-body">{primary.cell(row)}</div>
                      <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {trailing && <div className="text-body-sm">{trailing.cell(row)}</div>}
                        {actions && actions.cell(row)}
                      </div>
                    </div>
                    {rest.length > 0 && (
                      <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 md:grid-cols-4">
                        {rest.map((c) => (
                          <div key={c.key} className="min-w-0">
                            <dt className="font-cond text-overline font-semibold tracking-[0.06em] text-faint uppercase">{c.mobileLabel ?? c.header}</dt>
                            <dd className="mt-0.5 truncate text-body-sm text-ink-2">{c.cell(row)}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {showFooter && (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line px-4 py-2.5 text-label text-muted md:px-5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="tabular">
              <span className="font-mono text-ink-2">
                {(current - 1) * pageSize + 1}–{Math.min(current * pageSize, sorted.length)}
              </span>{" "}
              of <span className="font-mono text-ink-2">{sorted.length}</span> {noun}
            </span>
            {pageSizeOptions && onPageSizeChange && (
              <label className="inline-flex items-center gap-1.5">
                <span>Rows</span>
                <select
                  value={pageSize}
                  onChange={(e) => onPageSizeChange(Number(e.target.value))}
                  className="h-7 rounded-control border border-line-strong bg-surface px-1.5 font-mono text-[12px] text-ink-2 hover:border-control focus:border-petrol-500 focus:outline-none"
                >
                  {pageSizeOptions.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {!dense && (
              <button
                onClick={toggleDensity}
                className="hidden h-7 items-center gap-1.5 rounded-control px-1.5 text-label text-muted transition-colors hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-brand lg:inline-flex"
                aria-pressed={density === "compact"}
              >
                {density === "compact" ? <Rows4 className="size-3.5" /> : <Rows3 className="size-3.5" />}
                {density === "compact" ? "Compact" : "Comfortable"}
              </button>
            )}
          </div>
          {pageCount > 1 && (
            <nav aria-label="Pagination" className="flex items-center gap-1">
              <PageButton disabled={current === 1} onClick={() => setPage(current - 1)} aria-label="Previous page">
                <ChevronLeft className="size-4" />
              </PageButton>
              {pageNumbers(current, pageCount).map((n, i) =>
                n === "…" ? (
                  <span key={`gap-${i}`} className="px-1 text-faint">
                    …
                  </span>
                ) : (
                  <PageButton key={n} active={n === current} aria-current={n === current ? "page" : undefined} onClick={() => setPage(n)}>
                    {n}
                  </PageButton>
                ),
              )}
              <PageButton disabled={current === pageCount} onClick={() => setPage(current + 1)} aria-label="Next page">
                <ChevronRight className="size-4" />
              </PageButton>
            </nav>
          )}
        </div>
      )}
    </div>
  );
}

function stripeCls(tone: "danger" | "warning") {
  return cn("before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:content-['']", STRIPE[tone]);
}

function pageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, current, current - 1, current + 1]);
  const nums = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  nums.forEach((n, i) => {
    if (i > 0 && n - nums[i - 1] > 1) out.push("…");
    out.push(n);
  });
  return out;
}

function PageButton({ active, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      className={cn(
        "grid h-7 min-w-7 place-items-center rounded-control px-1.5 font-mono text-[12px] transition-colors duration-[80ms] focus-visible:outline-2 focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-40",
        active ? "bg-ink text-white" : "text-ink-2 hover:bg-hover",
        className,
      )}
      {...props}
    />
  );
}
