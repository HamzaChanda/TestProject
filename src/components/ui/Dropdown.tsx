"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { usePresence } from "@/hooks/usePresence";

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  href?: string;
  onSelect?: () => void;
  danger?: boolean;
  disabled?: boolean;
  hint?: string;
  separatorBefore?: boolean;
}

/**
 * Dropdown menu rendered in a portal with fixed positioning, so it is never
 * clipped by scrollable table containers. Closes on outside click, Escape,
 * scroll, resize and item selection.
 */
export function Dropdown({
  trigger,
  items,
  children,
  align = "end",
  width = 220,
  className,
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  items?: MenuItem[];
  children?: (close: () => void) => ReactNode;
  align?: "start" | "end";
  width?: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);
  const { mounted, closing } = usePresence(open, 110);

  const place = useCallback(() => {
    const a = anchorRef.current?.getBoundingClientRect();
    if (!a) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.min(width, vw - 16);
    let left = align === "end" ? a.right - w : a.left;
    left = Math.max(8, Math.min(left, vw - w - 8));
    const menuH = menuRef.current?.offsetHeight ?? 0;
    const below = vh - a.bottom - 12;
    const above = a.top - 12;
    let top = a.bottom + 6;
    let maxHeight = below;
    if (menuH > below && above > below) {
      maxHeight = above;
      top = Math.max(8, a.top - 6 - Math.min(menuH, above));
    }
    setPos({ top, left, maxHeight: Math.max(160, maxHeight) });
  }, [align, width]);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onScroll = (e: Event) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      const a = anchorRef.current?.getBoundingClientRect();
      // Keep the menu attached to its trigger; close only once the trigger is off-screen.
      if (!a || a.bottom < 0 || a.top > window.innerHeight) setOpen(false);
      else place();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [open, close, place]);

  return (
    <div ref={anchorRef} className="relative inline-flex">
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {mounted &&
        createPortal(
          <div
            ref={menuRef}
            role={closing ? undefined : "menu"}
            aria-hidden={closing || undefined}
            inert={closing}
            style={{
              width: Math.min(width, typeof window !== "undefined" ? window.innerWidth - 16 : width),
              top: pos?.top ?? -9999,
              left: pos?.left ?? -9999,
              maxHeight: pos?.maxHeight,
            }}
            className={cn(
              "scrollbar-thin fixed z-[80] overflow-y-auto rounded-[12px] border border-line bg-surface p-1 shadow-[var(--shadow-pop)]",
              closing ? "pointer-events-none animate-pop-out" : "animate-pop-in",
              className,
            )}
          >
            {children
              ? children(close)
              : items?.map((item) => {
                  const inner = (
                    <>
                      {item.icon && <span className={cn("text-muted", item.danger && "text-danger")}>{item.icon}</span>}
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.hint && <span className="text-[11px] text-faint">{item.hint}</span>}
                    </>
                  );
                  const cls = cn(
                    "flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-[7px] text-left text-[13px] text-ink-2 transition-colors hover:bg-[#f3f4f7] hover:text-ink [&_svg]:h-[15px] [&_svg]:w-[15px]",
                    item.danger && "text-danger hover:bg-danger-bg hover:text-danger",
                    item.disabled && "pointer-events-none opacity-45",
                  );
                  return (
                    <div key={item.label}>
                      {item.separatorBefore && <div className="my-1 h-px bg-line" />}
                      {item.href ? (
                        <Link role="menuitem" href={item.href} className={cls} onClick={close}>
                          {inner}
                        </Link>
                      ) : (
                        <button
                          role="menuitem"
                          className={cls}
                          disabled={item.disabled}
                          onClick={() => {
                            close();
                            item.onSelect?.();
                          }}
                        >
                          {inner}
                        </button>
                      )}
                    </div>
                  );
                })}
          </div>,
          document.body,
        )}
    </div>
  );
}
