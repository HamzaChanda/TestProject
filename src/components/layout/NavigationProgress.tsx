"use client";

/**
 * Slim top progress bar for route changes.
 *
 * Starts when an internal link is clicked (or `useNavigate` is used) and
 * finishes when the pathname changes. It only becomes visible if navigation
 * takes longer than SHOW_AFTER_MS, so instant (prefetched) navigations never
 * flash a bar — it exists for slow transitions such as first compiles in dev
 * or a slow network.
 */
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export const NAV_START_EVENT = "stockflow:navstart";
const SHOW_AFTER_MS = 120;

/** Call before a programmatic router.push so the progress bar can react. */
export function signalNavigationStart(href: string) {
  window.dispatchEvent(new CustomEvent(NAV_START_EVENT, { detail: href }));
}

function isInternalNavigation(a: HTMLAnchorElement, e: MouseEvent) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  if (a.target && a.target !== "_self") return false;
  if (a.hasAttribute("download")) return false;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin) return false;
  return url.pathname !== location.pathname; // same-page (hash/query) changes are instant
}

export function NavigationProgress() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<"idle" | "loading" | "done">("idle");
  const showTimer = useRef<number | undefined>(undefined);
  const pending = useRef(false);

  useEffect(() => {
    const start = (href?: string) => {
      if (href && new URL(href, location.href).pathname === location.pathname) return;
      pending.current = true;
      window.clearTimeout(showTimer.current);
      showTimer.current = window.setTimeout(() => pending.current && setPhase("loading"), SHOW_AFTER_MS);
    };
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (a && isInternalNavigation(a, e)) start();
    };
    const onSignal = (e: Event) => start((e as CustomEvent<string>).detail);
    document.addEventListener("click", onClick);
    window.addEventListener(NAV_START_EVENT, onSignal);
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener(NAV_START_EVENT, onSignal);
    };
  }, []);

  // Route committed → finish.
  useEffect(() => {
    if (!pending.current) return;
    pending.current = false;
    window.clearTimeout(showTimer.current);
    setPhase((p) => (p === "loading" ? "done" : "idle"));
  }, [pathname]);

  useEffect(() => {
    if (phase !== "done") return;
    const t = window.setTimeout(() => setPhase("idle"), 260);
    return () => window.clearTimeout(t);
  }, [phase]);

  if (phase === "idle") return null;
  return (
    <div className="no-print pointer-events-none fixed inset-x-0 top-0 z-[90] h-[2px] overflow-hidden" role="progressbar" aria-label="Loading page">
      <div
        className={cn(
          "h-full origin-left bg-brand",
          phase === "loading" ? "animate-[progress-indeterminate_1.1s_ease-in-out_infinite]" : "w-full opacity-0 transition-opacity duration-200",
        )}
      />
    </div>
  );
}
