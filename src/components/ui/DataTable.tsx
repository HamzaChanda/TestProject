"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react";
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
  /**
   * Hide this (secondary) column below a width so the table always fits:
   * laptop ≥1280px, desktop ≥1380px, wide ≥1536px.
   */
  hideBelow?: "laptop" | "desktop" | "wide";
  /** Label shown in the stacked mobile card (defaults to header). */
  mobileLabel?: string;
}

interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
  pageSize?: number;
  initialSort?: { key: string; dir: "asc" | "desc" };
  rowClassName?: (row: T) => string | undefined;
  /** Column keys rendered as the card title / trailing slot on mobile. */
  mobilePrimary?: string;
  mobileTrailing?: string;
  mobileActions?: string;
  /** Reset to page 1 whenever this changes (e.g. search/filter state). */
  resetKey?: string;
  className?: string;
  dense?: boolean;
  /** Minimum table width before it scrolls horizontally (default 600px). */
  minWidth?: number;
}

const HIDE_BELOW = {
  laptop: "hidden xl:table-cell",
  desktop: "hidden min-[1380px]:table-cell",
  wide: "hidden 2xl:table-cell",
} as const;

/** The row-actions column stays pinned to the right edge so menus are always reachable. */
const STICKY = "sticky right-0 z-[1] bg-inherit shadow-[-8px_0_8px_-8px_rgba(16,24,40,0.10)]";

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  empty,
  pageSize = PAGE_SIZE,
  initialSort,
  rowClassName,
  mobilePrimary,
  mobileTrailing,
  mobileActions = "actions",
  resetKey,
  className,
  dense,
  minWidth = 600,
}: DataTableProps<T>) {
  const [sort, setSort] = useState(initialSort ?? null);
  const [page, setPage] = useState(1);

  useEffect(() => setPage(1), [resetKey]);

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
  const current = Math.min(page, pageCount);
  const visible = sorted.slice((current - 1) * pageSize, current * pageSize);

  const toggleSort = (key: string) => {
    setSort((s) => (s?.key === key ? (s.dir === "asc" ? { key, dir: "desc" } : null) : { key, dir: "asc" }));
  };

  if (rows.length === 0) return <>{empty}</>;

  const primary = columns.find((c) => c.key === mobilePrimary) ?? columns[0];
  const trailing = columns.find((c) => c.key === mobileTrailing);
  const actions = columns.find((c) => c.key === mobileActions);
  const rest = columns.filter((c) => c !== primary && c !== trailing && c !== actions && !c.hideOnMobile);

  return (
    <div className={className}>
      {/* Desktop / tablet table */}
      {/* Table from 1024px; below that the stacked card layout is used (tablet & phone). */}
      <div className="scrollbar-thin hidden overflow-x-auto lg:block">
        <table className="w-full border-collapse text-left" style={{ minWidth }}>
          <thead>
            <tr className="border-y border-line bg-subtle">
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn(
                    "h-9 px-3.5 text-micro font-medium tracking-[0.06em] whitespace-nowrap text-muted uppercase first:pl-5 last:pr-5",
                    c.hideBelow && HIDE_BELOW[c.hideBelow],
                    c.key === mobileActions && STICKY,
                    c.align === "right" && "text-right",
                    c.align === "center" && "text-center",
                    c.headerClassName,
                  )}
                >
                  {c.sortValue ? (
                    <button
                      onClick={() => toggleSort(c.key)}
                      className={cn(
                        "group inline-flex items-center gap-1 uppercase transition-colors hover:text-ink",
                        sort?.key === c.key && "text-ink",
                        c.align === "right" && "flex-row-reverse",
                      )}
                    >
                      {c.header}
                      {sort?.key === c.key ? (
                        sort.dir === "asc" ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        )
                      ) : (
                        <ChevronsUpDown className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-60" />
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
            {visible.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "group/row border-b border-line transition-colors duration-100 last:border-b-0",
                  // Rows always have an opaque background so the pinned actions cell can inherit it.
                  rowClassName?.(row) || "bg-surface hover:bg-row-hover",
                  onRowClick && "cursor-pointer",
                )}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      "px-3.5 text-body whitespace-nowrap text-ink-2 first:pl-5 last:pr-5",
                      dense ? "py-2" : "py-3",
                      c.hideBelow && HIDE_BELOW[c.hideBelow],
                      c.key === mobileActions && STICKY,
                      c.align === "right" && "text-right",
                      c.align === "center" && "text-center",
                      c.className,
                    )}
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked cards */}
      <ul className="divide-y divide-line border-t border-line lg:hidden">
        {visible.map((row) => (
          <li
            key={rowKey(row)}
            className={cn("px-4 py-3.5", onRowClick && "active:bg-subtle", rowClassName?.(row))}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 text-ui">{primary.cell(row)}</div>
              <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                {trailing && <div className="text-body">{trailing.cell(row)}</div>}
                {actions && actions.cell(row)}
              </div>
            </div>
            {rest.length > 0 && (
              <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 md:grid-cols-4">
                {rest.map((c) => (
                  <div key={c.key} className="min-w-0">
                    <dt className="text-micro font-medium tracking-wide text-faint uppercase">{c.mobileLabel ?? c.header}</dt>
                    <dd className="mt-0.5 truncate text-body text-ink-2">{c.cell(row)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </li>
        ))}
      </ul>

      {sorted.length > pageSize && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-small text-muted md:px-5">
          <span className="tabular">
            Showing <span className="font-medium text-ink-2">{(current - 1) * pageSize + 1}</span>–
            <span className="font-medium text-ink-2">{Math.min(current * pageSize, sorted.length)}</span> of{" "}
            <span className="font-medium text-ink-2">{sorted.length}</span>
          </span>
          <div className="flex items-center gap-1">
            <PageButton disabled={current === 1} onClick={() => setPage(current - 1)} aria-label="Previous page">
              <ChevronLeft className="h-4 w-4" />
            </PageButton>
            {pageNumbers(current, pageCount).map((n, i) =>
              n === "…" ? (
                <span key={`gap-${i}`} className="px-1 text-faint">
                  …
                </span>
              ) : (
                <PageButton key={n} active={n === current} onClick={() => setPage(n)}>
                  {n}
                </PageButton>
              ),
            )}
            <PageButton disabled={current === pageCount} onClick={() => setPage(current + 1)} aria-label="Next page">
              <ChevronRight className="h-4 w-4" />
            </PageButton>
          </div>
        </div>
      )}
    </div>
  );
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

function PageButton({
  active,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      className={cn(
        "grid h-8 min-w-8 place-items-center rounded-control px-2 text-small font-medium tabular transition-colors disabled:pointer-events-none disabled:opacity-40",
        active ? "bg-ink text-white" : "text-ink-2 hover:bg-hover",
        className,
      )}
      {...props}
    />
  );
}
