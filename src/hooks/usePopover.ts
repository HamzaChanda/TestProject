"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePresence } from "./usePresence";

/**
 * Shared floating-panel behaviour for Combobox / DatePicker:
 * fixed positioning under (or above) the trigger, clamped to the viewport,
 * follows the trigger on scroll, closes on outside click / resize,
 * and keeps the panel mounted while its exit animation plays.
 */
export function usePopover({ width, align = "start" }: { width?: number; align?: "start" | "end" } = {}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const { mounted, closing } = usePresence(open, 110);

  const place = useCallback(() => {
    const a = anchorRef.current?.getBoundingClientRect();
    if (!a) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.min(Math.max(width ?? a.width, a.width), vw - 16);
    let left = align === "end" ? a.right - w : a.left;
    left = Math.max(8, Math.min(left, vw - w - 8));
    const ph = panelRef.current?.offsetHeight ?? 0;
    const below = vh - a.bottom - 12;
    const above = a.top - 12;
    let top = a.bottom + 4;
    let maxHeight = below;
    if (ph > below && above > below) {
      maxHeight = above;
      top = Math.max(8, a.top - 4 - Math.min(ph, above));
    }
    setPos({ top, left, width: w, maxHeight: Math.max(180, maxHeight) });
  }, [width, align]);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onScroll = (e: Event) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      const a = anchorRef.current?.getBoundingClientRect();
      if (!a || a.bottom < 0 || a.top > window.innerHeight) setOpen(false);
      else place();
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [open, place, close]);

  return { open, setOpen, close, anchorRef, panelRef, pos, mounted, closing, place };
}
