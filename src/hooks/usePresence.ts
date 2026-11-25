"use client";

import { useEffect, useState } from "react";

/**
 * Keeps an element mounted for `exitMs` after `open` turns false, so it can
 * play an exit animation instead of disappearing abruptly.
 *
 *   const { mounted, closing } = usePresence(open);
 *   if (!mounted) return null;
 *   <div className={closing ? "animate-pop-out" : "animate-pop-in"} />
 */
export function usePresence(open: boolean, exitMs = 150) {
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const t = window.setTimeout(() => setMounted(false), exitMs);
    return () => window.clearTimeout(t);
  }, [open, exitMs]);

  return { mounted: open || mounted, closing: !open && mounted };
}
