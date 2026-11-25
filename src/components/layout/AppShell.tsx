"use client";

import { useEffect, useState, type ReactNode } from "react";
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
  const { actions } = useInventory();
  const pathname = usePathname();
  const [collapsedPref, setCollapsed] = useState(readCollapsed);
  const tablet = useIsTablet();
  const collapsed = collapsedPref || tablet;
  const [mobileOpen, setMobileOpen] = useState(false);
  const drawer = usePresence(mobileOpen, 160);
  const [searchOpen, setSearchOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  useEffect(() => setMobileOpen(false), [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

  const sidebarProps = { onOpenHelp: () => setHelpOpen(true), onResetData: () => setResetOpen(true) };

  return (
    <div className="min-h-dvh">
      <NavigationProgress />
      {/* Desktop sidebar */}
      <div
        className={cn(
          "no-print fixed inset-y-0 left-0 z-30 hidden transition-[width] duration-200 md:block",
          collapsed ? "w-[68px]" : "w-[248px]",
        )}
      >
        <Sidebar collapsed={collapsed} onToggleCollapse={tablet ? undefined : toggleCollapsed} {...sidebarProps} />
      </div>

      {/* Mobile drawer */}
      {drawer.mounted && (
        <div className="no-print fixed inset-0 z-[60] md:hidden">
          <div className={cn("absolute inset-0 bg-[#0f1220]/40", drawer.closing ? "animate-fade-out" : "animate-fade-in")} onClick={() => setMobileOpen(false)} />
          <div className={cn("absolute inset-y-0 left-0 w-[280px] max-w-[85vw] shadow-[var(--shadow-drawer)]", drawer.closing ? "animate-slide-out-left" : "animate-slide-in-left")}>
            <Sidebar collapsed={false} mobile onNavigate={() => setMobileOpen(false)} {...sidebarProps} />
          </div>
        </div>
      )}

      <div className={cn("flex min-h-dvh flex-col transition-[padding] duration-200 print:!pl-0", collapsed ? "md:pl-[68px]" : "md:pl-[248px]")}>
        <Header
          onOpenMobileNav={() => setMobileOpen(true)}
          onOpenSearch={() => setSearchOpen(true)}
          onOpenHelp={() => setHelpOpen(true)}
          onResetData={() => setResetOpen(true)}
        />
        <main className="print-shell mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 md:px-6 lg:px-8 lg:py-7">{children}</main>
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
      <div className="fixed inset-y-0 left-0 hidden w-[68px] border-r border-line bg-surface p-4 md:block xl:w-[248px]">
        <div className="flex items-center gap-2.5">
          <Logo />
          <div className="hidden xl:block">
            <div className="text-[14.5px] font-semibold">StockFlow</div>
            <div className="text-[11.5px] text-muted">Inventory &amp; Operations</div>
          </div>
        </div>
        <div className="mt-8 space-y-2.5">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-7" />
          ))}
        </div>
      </div>
      <div className="md:pl-[68px] xl:pl-[248px]">
        <div className="h-[60px] border-b border-line bg-surface" />
        <div className="mx-auto max-w-[1440px] space-y-6 px-4 py-7 md:px-6 lg:px-8">
          <Skeleton className="h-8 w-56" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[120px] rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-[320px] rounded-xl" />
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
        richColors
        closeButton
        toastOptions={{ style: { fontFamily: "var(--font-sans)", fontSize: 13.5, borderRadius: 12 } }}
      />
    </>
  );
}
