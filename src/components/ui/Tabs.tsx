"use client";

/**
 * Page-level tabs (view switching). 40px, underline indicator that slides between
 * tabs (motion-fast), counts in mono. Arrow keys / Home / End move focus (roving tabindex).
 */
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface TabItem<T extends string> {
  value: T;
  label: ReactNode;
  count?: number;
  /** Optional attention dot (e.g. overdue items exist). */
  attention?: boolean;
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [bar, setBar] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-value="${CSS.escape(value)}"]`);
    if (el) setBar({ left: el.offsetLeft, width: el.offsetWidth });
  }, [value, items]);

  const onKey = (e: KeyboardEvent) => {
    const i = items.findIndex((t) => t.value === value);
    let n = -1;
    if (e.key === "ArrowRight") n = (i + 1) % items.length;
    else if (e.key === "ArrowLeft") n = (i - 1 + items.length) % items.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = items.length - 1;
    if (n < 0) return;
    e.preventDefault();
    onChange(items[n].value);
    listRef.current?.querySelector<HTMLElement>(`[data-value="${CSS.escape(items[n].value)}"]`)?.focus();
  };

  return (
    <div className={cn("scrollbar-thin relative overflow-x-auto border-b border-line", className)}>
      <div ref={listRef} role="tablist" aria-label={ariaLabel} onKeyDown={onKey} className="relative flex min-w-max gap-5 px-4 md:px-5">
        {items.map((t) => {
          const active = t.value === value;
          return (
            <button
              key={t.value}
              data-value={t.value}
              role="tab"
              type="button"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(t.value)}
              className={cn(
                "inline-flex h-10 items-center gap-1.5 text-body font-medium whitespace-nowrap transition-colors duration-[80ms] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand",
                active ? "font-semibold text-ink" : "text-muted hover:text-ink",
              )}
            >
              {t.attention && <span className="size-1.5 rounded-full bg-signal" aria-hidden />}
              {t.label}
              {t.count !== undefined && <span className={cn("font-mono text-[11px]", active ? "text-ink-2" : "text-muted")}>{t.count}</span>}
            </button>
          );
        })}
        {bar && (
          <span
            aria-hidden
            className="absolute bottom-0 h-0.5 rounded-full bg-petrol-500 transition-[left,width] duration-[120ms] ease-[var(--ease-standard)]"
            style={{ left: bar.left, width: bar.width }}
          />
        )}
      </div>
    </div>
  );
}
