"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import { usePresence } from "@/hooks/usePresence";
import { InventoryProvider, useInventory } from "@/context/InventoryContext";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Skeleton } from "@/components/ui/Primitives";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { CommandPalette } from "./CommandPalette";
import { HelpDialog } from "./HelpDialog";
import { Logo } from "./Logo";
import { NavigationProgress } from "./NavigationProgress";
import { GO_SHORTCUTS } from "./nav";
import { useNavigate } from "@/hooks/useNavigate";
import { pushRecent } from "@/lib/recents";

const COLLAPSE_KEY = "stockflow:sidebar-collapsed";

function readCollapsed() {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Tablet and small-laptop widths (768–1279px) get a compact icon rail, leaving room for data tables. */
function useIsTablet() {
  const [tablet, setTablet] = useState(() => window.matchMedia("(min-width: 768px) and (max-width: 1279.98px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px) and (max-width: 1279.98px)");
    const on = () => setTablet(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return tablet;
}

// Shell only ever renders on the client (the provider shows a skeleton until
// localStorage is hydrated), so reading browser APIs in initial state is safe.
function Shell({ children }: { children: ReactNode }) {
  const { state, actions } = useInventory();
  const pathname = usePathname();
  const navigate = useNavigate();
  const [collapsedPref, setCollapsed] = useState(readCollapsed);
  const tablet = useIsTablet();
  const collapsed = collapsedPref || tablet;
  const [mobileOpen, setMobileOpen] = useState(false);
  const drawer = usePresence(mobileOpen, 160);
  const [searchOpen, setSearchOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  useEffect(() => setMobileOpen(false), [pathname]);

  // Keyboard-first navigation:  Ctrl/⌘K search · Ctrl/⌘\ sidebar · ? shortcuts · G then <key> to jump.
  const shortcutState = useRef({ goPending: false, timer: 0 });
  const toggleSidebarRef = useRef<() => void>(() => {});
  useEffect(() => {
    const isTyping = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === "k") {
          e.preventDefault();
          setSearchOpen((o) => !o);
        } else if (e.key === "\\") {
          e.preventDefault();
          toggleSidebarRef.current();
        }
        return;
      }
      if (e.altKey || isTyping(e.target) || document.querySelector("[data-overlay-panel]")) return;
      const s = shortcutState.current;
      if (e.key === "/") {
        const search = document.querySelector<HTMLInputElement>("[data-page-search]");
        e.preventDefault();
        if (search) search.focus();
        else setSearchOpen(true);
      } else if (e.key === "?") {
        e.preventDefault();
        setHelpOpen(true);
      } else if (e.key.toLowerCase() === "g" && !s.goPending) {
        s.goPending = true;
        window.clearTimeout(s.timer);
        s.timer = window.setTimeout(() => (s.goPending = false), 1200);
      } else if (s.goPending) {
        s.goPending = false;
        const hit = GO_SHORTCUTS.find((g) => g.key === e.key.toLowerCase());
        if (hit) {
          e.preventDefault();
          navigate(hit.href);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  // Remember recently opened records for the command palette.
  useEffect(() => {
    const [, section, id] = pathname.split("/");
    if (!id || id === "new") return;
    if (section === "sales") {
      const r = state.sales.find((x) => x.id === id);
      if (r) pushRecent({ href: pathname, label: r.invoiceNo, sub: r.customerName, kind: "invoice" });
    } else if (section === "purchases") {
      const r = state.purchases.find((x) => x.id === id);
      if (r) pushRecent({ href: pathname, label: r.poNumber, sub: r.supplierName, kind: "purchase" });
    } else if (section === "products") {
      const r = state.products.find((x) => x.id === id);
      if (r) pushRecent({ href: `/products/${id}`, label: r.name, sub: r.sku, kind: "product" });
    } else if (section === "customers") {
      const r = state.customers.find((x) => x.id === id);
      if (r) pushRecent({ href: pathname, label: r.name, sub: r.company || r.email, kind: "customer" });
    } else if (section === "suppliers") {
      const r = state.suppliers.find((x) => x.id === id);
      if (r) pushRecent({ href: pathname, label: r.name, sub: r.contactPerson, kind: "supplier" });
    }
    // Only when the route changes — not on every data change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        window.localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !c;
    });
  };

  // Desktop: collapse/expand. Tablet rail & phone: open/close the drawer.
  toggleSidebarRef.current = () => {
    if (window.matchMedia("(min-width: 1280px)").matches) toggleCollapsed();
    else setMobileOpen((o) => !o);
  };

  const sidebarProps = { onOpenHelp: () => setHelpOpen(true), onResetData: () => setResetOpen(true) };

  return (
    <div className="min-h-dvh">
      <NavigationProgress />
      {/* Desktop sidebar */}
      <div
        className={cn(
          "no-print fixed inset-y-0 left-0 z-30 hidden transition-[width] duration-200 md:block",
          collapsed ? "w-rail" : "w-sidebar",
        )}
      >
        <Sidebar collapsed={collapsed} onToggleCollapse={tablet ? undefined : toggleCollapsed} {...sidebarProps} />
      </div>

      {/* Mobile drawer */}
      {drawer.mounted && (
        <div className="no-print fixed inset-0 z-[60] md:hidden">
          <div className={cn("absolute inset-0 bg-scrim/40", drawer.closing ? "animate-fade-out" : "animate-fade-in")} onClick={() => setMobileOpen(false)} />
          <div className={cn("absolute inset-y-0 left-0 w-[280px] max-w-[85vw] shadow-[var(--shadow-drawer)]", drawer.closing ? "animate-slide-out-left" : "animate-slide-in-left")}>
            <Sidebar collapsed={false} mobile onNavigate={() => setMobileOpen(false)} {...sidebarProps} />
          </div>
        </div>
      )}

      <div className={cn("flex min-h-dvh flex-col transition-[padding] duration-200 print:!pl-0", collapsed ? "md:pl-rail" : "md:pl-sidebar")}>
        <Header
          onOpenMobileNav={() => setMobileOpen(true)}
          onOpenSearch={() => setSearchOpen(true)}
          onOpenHelp={() => setHelpOpen(true)}
          onResetData={() => setResetOpen(true)}
        />
        <main className="print-shell mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 md:px-6 lg:px-8 lg:pt-7 lg:pb-12">{children}</main>
      </div>

      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
      <ConfirmDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={() => actions.resetDemoData()}
        title="Reset demo data?"
        description="This replaces all products, invoices, purchase orders and history in this browser with the original sample data. This cannot be undone."
        confirmLabel="Reset data"
      />
    </div>
  );
}

function LoadingShell() {
  return (
    <div className="min-h-dvh">
      <div className="fixed inset-y-0 left-0 hidden w-rail border-r border-line bg-surface p-3 md:block xl:w-sidebar">
        <div className="flex items-center gap-2.5">
          <Logo />
          <div className="hidden xl:block">
            <div className="text-h3 font-semibold">StockFlow</div>
                      </div>
        </div>
        <div className="mt-8 space-y-2.5">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-7" />
          ))}
        </div>
      </div>
      <div className="md:pl-rail xl:pl-sidebar">
        <div className="h-header border-b border-line bg-canvas" />
        <div className="mx-auto max-w-[1440px] space-y-6 px-4 py-7 md:px-6 lg:px-8">
          <Skeleton className="h-8 w-56" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[92px] rounded-panel" />
            ))}
          </div>
          <Skeleton className="h-[320px] rounded-panel" />
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <InventoryProvider fallback={<LoadingShell />}>
        <Shell>{children}</Shell>
      </InventoryProvider>
      <Toaster
        position="bottom-right"
        closeButton
        gap={8}
        toastOptions={{
          classNames: {
            toast: "!bg-ink !text-white !border-0 !rounded-panel !shadow-pop !font-sans !text-body-sm !gap-2.5 !py-3 !px-3.5",
            description: "!text-white/70 !text-label",
            closeButton: "!bg-ink !text-white/70 !border-white/20 hover:!text-white",
            actionButton: "!bg-transparent !text-petrol-100 !font-semibold",
            success: "[&_[data-icon]]:!text-success-solid",
            error: "[&_[data-icon]]:!text-danger-solid",
            warning: "[&_[data-icon]]:!text-signal",
            info: "[&_[data-icon]]:!text-info-solid",
          },
        }}
      />
    </>
  );
}
