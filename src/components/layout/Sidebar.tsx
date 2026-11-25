"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronsLeft, ChevronsRight, HelpCircle, LifeBuoy, MoreHorizontal, RotateCcw, Settings, User } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import { useInventory } from "@/context/InventoryContext";
import { getAttentionSummary, getWarehouseStats } from "@/lib/selectors";
import { Avatar } from "@/components/ui/Primitives";
import { Dropdown } from "@/components/ui/Dropdown";
import { LocationTag } from "@/components/ui/Stockroom";
import { NAV_SECTIONS, USER } from "./nav";
import { Logo } from "./Logo";

/**
 * Stock Ledger sidebar — 232px (60px rail). Condensed section overlines,
 * petrol-50 active row (no side bar), mono counts with an amber dot when the
 * count needs action, and a Locations block that filters Stock by warehouse.
 */
export function Sidebar(props: {
  collapsed: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
  onOpenHelp: () => void;
  onResetData: () => void;
  mobile?: boolean;
}) {
  return (
    <Suspense fallback={<aside className="h-full border-r border-line bg-surface" />}>
      <SidebarInner {...props} />
    </Suspense>
  );
}

const tipCls =
  "pointer-events-none absolute top-1/2 left-[calc(100%+12px)] z-50 -translate-y-1/2 rounded-tag bg-ink px-2 py-1 text-label font-medium whitespace-nowrap text-white opacity-0 transition-opacity duration-[80ms] group-hover/nav:opacity-100 group-focus-visible/nav:opacity-100";

function SidebarInner({
  collapsed,
  onToggleCollapse,
  onNavigate,
  onOpenHelp,
  onResetData,
  mobile,
}: {
  collapsed: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
  onOpenHelp: () => void;
  onResetData: () => void;
  mobile?: boolean;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const { state } = useInventory();
  const attention = useMemo(() => getAttentionSummary(state), [state]);
  const locations = useMemo(() => getWarehouseStats(state), [state]);
  const openPOs = state.purchases.filter((p) => p.status === "Pending" || p.status === "Partially Received").length;

  const counts: Record<string, { n: number; attention: boolean; label: string }> = {
    "/sales": { n: attention.overdueSales, attention: attention.overdueSales > 0, label: "overdue invoices" },
    "/purchases": { n: openPOs, attention: attention.overduePOs > 0, label: "open purchase orders" },
    "/stock": { n: attention.out + attention.low, attention: attention.out + attention.low > 0, label: "products below minimum" },
  };

  // Optimistic active state: highlight the clicked item immediately; resync on URL change.
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  useEffect(() => setPendingHref(null), [pathname]);
  const current = pendingHref ?? pathname;
  const isActive = (href: string) => current === href || current.startsWith(href + "/");
  const go = (href: string) => {
    if (href !== pathname) setPendingHref(href);
    onNavigate?.();
  };
  const activeWh = pathname === "/stock" ? params.get("warehouse") : null;

  return (
    <aside className={cn("flex h-full flex-col bg-surface", !mobile && "border-r border-line")}>
      {/* Brand */}
      <div className={cn("flex h-header shrink-0 items-center", collapsed ? "justify-center" : "px-4")}>
        <Link href="/dashboard" onClick={onNavigate} className="flex min-w-0 items-center gap-2.5 rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" aria-label="StockFlow — dashboard">
          <Logo />
          {!collapsed && <span className="text-h3 font-semibold tracking-[-0.01em] text-ink">StockFlow</span>}
        </Link>
      </div>

      {/* Nav */}
      <nav aria-label="Main" className={cn("scrollbar-thin flex-1 pt-2 pb-4", collapsed ? "overflow-visible px-2" : "overflow-y-auto px-3")}>
        {NAV_SECTIONS.map((section, i) => (
          <div key={section.title} className={cn(i > 0 && (collapsed ? "mt-3" : "mt-5"))}>
            {collapsed ? (
              i > 0 && <div className="mx-2 mb-3 h-px bg-line" />
            ) : (
              <div className="mb-1 px-2.5 font-cond text-overline font-semibold tracking-[0.06em] text-faint uppercase">{section.title}</div>
            )}
            <ul className="space-y-px">
              {section.items.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                const c = counts[item.href];
                const showCount = c && c.n > 0;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => go(item.href)}
                      aria-current={active ? "page" : undefined}
                      aria-label={collapsed ? `${item.label}${showCount ? `, ${c.n} ${c.label}` : ""}` : undefined}
                      className={cn(
                        "group/nav relative flex h-8 items-center gap-2.5 rounded-control text-body font-medium transition-colors duration-[80ms] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand",
                        collapsed ? "justify-center" : "px-2.5",
                        active ? "bg-petrol-50 text-petrol-700" : "text-ink-2 hover:bg-hover hover:text-ink",
                      )}
                    >
                      <Icon className={cn("size-4 shrink-0", active ? "text-petrol-700" : "text-muted group-hover/nav:text-ink-2")} strokeWidth={1.8} />
                      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                      {!collapsed && showCount && (
                        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted" title={`${c.n} ${c.label}`}>
                          {c.attention && <span className="size-1.5 rounded-full bg-signal" aria-hidden />}
                          {c.n}
                        </span>
                      )}
                      {collapsed && showCount && c.attention && <span className="absolute top-1.5 right-2 size-1.5 rounded-full bg-signal" aria-hidden />}
                      {collapsed && (
                        <span className={tipCls} aria-hidden>
                          {item.label}
                          {showCount ? ` · ${c.n}` : ""}
                          <span className="ml-2 font-mono text-white/55">G {item.key.toUpperCase()}</span>
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {/* Locations */}
        {!collapsed && locations.length > 0 && (
          <div className="mt-5">
            <div className="mb-1 px-2.5 font-cond text-overline font-semibold tracking-[0.06em] text-faint uppercase">Locations</div>
            <ul className="space-y-px">
              {locations.map((w) => {
                const active = activeWh === w.id;
                return (
                  <li key={w.id}>
                    <Link
                      href={`/stock?warehouse=${encodeURIComponent(w.id)}`}
                      onClick={() => go("/stock")}
                      aria-current={active ? "page" : undefined}
                      title={`${w.name} · ${w.location}`}
                      className={cn(
                        "flex h-8 items-center gap-2 rounded-control px-2.5 text-body-sm transition-colors duration-[80ms] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand",
                        active ? "bg-petrol-50 text-petrol-700" : "text-ink-2 hover:bg-hover hover:text-ink",
                      )}
                    >
                      <LocationTag code={w.code} emphasis={active} />
                      <span className="min-w-0 flex-1 truncate">{w.name}</span>
                      <span className="font-mono text-[11px] text-muted">{formatNumber(w.units)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className={cn("shrink-0 border-t border-line py-3", collapsed ? "px-2" : "px-3")}>
        <ul className="space-y-px">
          <FooterItem collapsed={collapsed} icon={<LifeBuoy />} label="Help & shortcuts" onClick={() => { onNavigate?.(); onOpenHelp(); }} />
          <FooterItem collapsed={collapsed} icon={<Settings />} label="Settings" href="/settings" active={isActive("/settings")} onClick={() => go("/settings")} />
        </ul>
        <div className={cn("mt-2", collapsed && "flex justify-center")}>
          <Dropdown
            align="start"
            width={232}
            items={[
              { label: "Profile & business", icon: <User />, href: "/settings" },
              { label: "Help & shortcuts", icon: <HelpCircle />, onSelect: onOpenHelp, hint: "?" },
              { label: "Reset demo data", icon: <RotateCcw />, onSelect: onResetData, separatorBefore: true, danger: true },
            ]}
            trigger={({ toggle, open }) => (
              <button
                onClick={toggle}
                aria-expanded={open}
                aria-haspopup="menu"
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-control p-1.5 text-left transition-colors duration-[80ms] hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand",
                  open && "bg-hover",
                  collapsed && "w-auto",
                )}
                aria-label="Open profile menu"
              >
                <Avatar name={USER.name} size={28} />
                {!collapsed && (
                  <>
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate text-body-sm font-medium text-ink">{USER.name}</span>
                      <span className="block truncate text-label text-muted">{USER.role}</span>
                    </span>
                    <MoreHorizontal className="size-4 text-muted" />
                  </>
                )}
              </button>
            )}
          />
        </div>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className={cn(
              "mt-1 flex h-7 w-full items-center gap-2 rounded-control px-2.5 text-label text-muted transition-colors duration-[80ms] hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand",
              collapsed && "justify-center px-0",
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
            {!collapsed && (
              <>
                <span className="flex-1 text-left">Collapse</span>
                <kbd className="font-mono text-[10.5px] text-faint">Ctrl \</kbd>
              </>
            )}
          </button>
        )}
      </div>
    </aside>
  );
}

function FooterItem({
  icon,
  label,
  href,
  onClick,
  collapsed,
  active,
}: {
  icon: ReactNode;
  label: string;
  href?: string;
  onClick?: () => void;
  collapsed: boolean;
  active?: boolean;
}) {
  const cls = cn(
    "group/nav relative flex h-8 w-full items-center gap-2.5 rounded-control text-body-sm font-medium transition-colors duration-[80ms] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand [&>svg]:size-4 [&>svg]:shrink-0",
    collapsed ? "justify-center" : "px-2.5",
    active ? "bg-petrol-50 text-petrol-700 [&>svg]:text-petrol-700" : "text-ink-2 hover:bg-hover hover:text-ink [&>svg]:text-muted",
  );
  const content = (
    <>
      {icon}
      {!collapsed && <span>{label}</span>}
      {collapsed && (
        <span className={tipCls} aria-hidden>
          {label}
        </span>
      )}
    </>
  );
  return (
    <li>
      {href ? (
        <Link href={href} className={cls} onClick={onClick} aria-current={active ? "page" : undefined} aria-label={collapsed ? label : undefined}>
          {content}
        </Link>
      ) : (
        <button className={cls} onClick={onClick} aria-label={collapsed ? label : undefined}>
          {content}
        </button>
      )}
    </li>
  );
}
