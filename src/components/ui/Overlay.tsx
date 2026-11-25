"use client";

/**
 * Modal dialog and slide-over panel. Both portal to <body>, lock scroll,
 * close on Escape / backdrop click, and restore focus on close.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePresence } from "@/hooks/usePresence";

let openCount = 0;

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function useOverlay(open: boolean, onClose: () => void, panelRef: React.RefObject<HTMLDivElement | null>) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    openCount += 1;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      const panel = panelRef.current;
      if (!panel) return;
      // Only the top-most overlay reacts (e.g. a confirm dialog over a slide-over).
      const overlays = document.querySelectorAll("[data-overlay-panel]");
      if (overlays[overlays.length - 1] !== panel) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
      } else if (e.key === "Tab") {
        // Keep keyboard focus inside the dialog.
        const focusables = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    // Move focus into the dialog — unless the user is already interacting with it.
    const t = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel || panel.contains(document.activeElement)) return;
      const target = panel.querySelector<HTMLElement>("[data-autofocus], input:not([type=hidden]):not([disabled]):not([readonly]), select, textarea");
      (target ?? panel).focus({ preventScroll: true });
    }, 30);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      openCount -= 1;
      if (openCount <= 0) document.body.style.overflow = "";
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [open, panelRef]);
}

/**
 * While an overlay plays its exit animation, keep showing the content it had
 * when it was open (callers often clear the record they were showing).
 */
function useFrozen<T>(open: boolean, value: T): T {
  const ref = useRef(value);
  if (open) ref.current = value;
  return open ? value : ref.current;
}

function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

interface OverlayProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function Modal(props: OverlayProps & { size?: "sm" | "md" | "lg" }) {
  const { open, onClose, className, size = "md" } = props;
  const panelRef = useRef<HTMLDivElement>(null);
  const isClient = useMounted();
  const { mounted, closing } = usePresence(open, 130);
  const { title, description, children, footer } = useFrozen(open, props);
  useOverlay(open, onClose, panelRef);
  if (!mounted || !isClient) return null;
  return createPortal(
    <div className={cn("fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4", closing && "pointer-events-none")}>
      <div className={cn("absolute inset-0 bg-scrim/30", closing ? "animate-fade-out" : "animate-fade-in")} onClick={onClose} />
      <div
        ref={panelRef}
        role={closing ? undefined : "dialog"}
        aria-modal={closing ? undefined : true}
        aria-hidden={closing || undefined}
        inert={closing}
        data-overlay-panel={closing ? undefined : ""}
        tabIndex={-1}
        className={cn(
          "relative flex max-h-[92dvh] w-full flex-col rounded-t-dialog border border-line bg-surface shadow-dialog outline-none sm:rounded-dialog",
          closing ? "animate-dialog-out" : "animate-dialog-in",
          size === "sm" && "sm:max-w-[400px]",
          size === "md" && "sm:max-w-[520px]",
          size === "lg" && "sm:max-w-[720px]",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-h3 font-semibold tracking-[-0.01em] text-ink">{title}</h2>
            {description && <p className="mt-0.5 text-label text-muted">{description}</p>}
          </div>
          <button
            onClick={onClose}
            className="-mr-1.5 -mt-0.5 rounded-md p-1.5 text-muted transition hover:bg-hover hover:text-ink"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-subtle px-5 py-3 sm:rounded-b-dialog">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function SlideOver(props: OverlayProps) {
  const { open, onClose, className } = props;
  const panelRef = useRef<HTMLDivElement>(null);
  const isClient = useMounted();
  const { mounted, closing } = usePresence(open, 160);
  const { title, description, children, footer } = useFrozen(open, props);
  useOverlay(open, onClose, panelRef);
  if (!mounted || !isClient) return null;
  return createPortal(
    <div className={cn("fixed inset-0 z-[70]", closing && "pointer-events-none")}>
      <div className={cn("absolute inset-0 bg-scrim/30", closing ? "animate-fade-out" : "animate-fade-in")} onClick={onClose} />
      <div
        ref={panelRef}
        role={closing ? undefined : "dialog"}
        aria-modal={closing ? undefined : true}
        aria-hidden={closing || undefined}
        inert={closing}
        data-overlay-panel={closing ? undefined : ""}
        tabIndex={-1}
        className={cn(
          "absolute inset-y-0 right-0 flex w-full max-w-[480px] flex-col border-l border-line bg-surface shadow-drawer outline-none",
          closing ? "animate-slide-out" : "animate-slide-in",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div className="min-w-0">
            <h2 className="text-h3 font-semibold tracking-[-0.01em] text-ink">{title}</h2>
            {description && <p className="mt-0.5 text-label text-muted">{description}</p>}
          </div>
          <button onClick={onClose} className="-mr-2 rounded-md p-1.5 text-muted transition hover:bg-hover hover:text-ink" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="scrollbar-thin flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-line bg-subtle px-6 py-3.5">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
