"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronsLeft, ChevronsRight, HelpCircle, LifeBuoy, MoreHorizontal, Settings, User, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useInventory } from "@/context/InventoryContext";
import { getLowStockProducts } from "@/lib/selectors";
import { Avatar } from "@/components/ui/Primitives";
import { Dropdown } from "@/components/ui/Dropdown";
import { NAV_SECTIONS, USER } from "./nav";
import { Logo } from "./Logo";

export function Sidebar({
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
  const { state } = useInventory();
  const lowCount = getLowStockProducts(state).length;
  const pendingPOs = state.purchases.filter((p) => p.status === "Pending" || p.status === "Partially Received").length;
  const badges: Record<string, number> = { "/stock": lowCount, "/purchases": pendingPOs };

  // Optimistic active state: highlight the clicked item immediately, even
  // before the new route has finished loading; resync when the URL changes.
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  useEffect(() => setPendingHref(null), [pathname]);
  const current = pendingHref ?? pathname;
  const isActive = (href: string) => current === href || current.startsWith(href + "/");
  const go = (href: string) => {
    if (href !== pathname) setPendingHref(href);
    onNavigate?.();
  };

  return (
    <aside className={cn("flex h-full flex-col bg-surface", !mobile && "border-r border-line")}>
      {/* Brand */}
      <div className={cn("flex h-[60px] shrink-0 items-center gap-2.5", collapsed ? "justify-center px-0" : "px-4")}>
        <Link href="/dashboard" onClick={onNavigate} className="flex min-w-0 items-center gap-2.5">
          <Logo />
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <div className="text-title-sm font-semibold tracking-[-0.01em] text-ink">StockFlow</div>
              <div className="truncate text-caption text-muted">Inventory &amp; Operations</div>
            </div>
          )}
        </Link>
      </div>

      {/* Nav */}
      <nav className={cn("scrollbar-thin flex-1 px-3 pt-2 pb-4", collapsed ? "overflow-visible" : "overflow-y-auto")}>
        {NAV_SECTIONS.map((section, i) => (
          <div key={section.title} className={cn(i > 0 && "mt-5")}>
            {collapsed ? (
              i > 0 && <div className="mx-2 mb-3 h-px bg-line" />
            ) : (
              <div className="mb-1.5 px-2.5 text-micro font-semibold tracking-[0.08em] text-faint uppercase">{section.title}</div>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                const badge = badges[item.href];
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => go(item.href)}
                      className={cn(
                        "group/nav relative flex h-9 items-center gap-2.5 rounded-control text-ui font-medium transition-colors",
                        collapsed ? "justify-center px-0" : "px-2.5",
                        active ? "bg-brand-50 text-brand" : "text-ink-2 hover:bg-hover hover:text-ink",
                      )}
                      aria-current={active ? "page" : undefined}
                    >
                      {active && !collapsed && <span className="absolute top-2 bottom-2 -left-3 w-[3px] rounded-r-full bg-brand" />}
                      <Icon className={cn("h-[17px] w-[17px] shrink-0", active ? "text-brand" : "text-muted group-hover/nav:text-ink-2")} strokeWidth={1.9} />
                      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                      {!collapsed && badge > 0 && (
                        <span
                          className={cn(
                            "rounded-md px-1.5 py-px text-micro font-semibold tabular",
                            item.href === "/stock" ? "bg-warning-bg text-warning" : "bg-hover text-ink-2",
                          )}
                        >
                          {badge}
                        </span>
                      )}
                      {collapsed && badge > 0 && <span className="absolute top-1.5 right-2 h-1.5 w-1.5 rounded-full bg-warning-solid" />}
                      {collapsed && (
                        <span className="pointer-events-none absolute top-1/2 left-[calc(100%+12px)] z-50 -translate-y-1/2 rounded-md bg-ink px-2 py-1 text-small font-medium whitespace-nowrap text-white opacity-0 shadow-lg transition-opacity group-hover/nav:opacity-100">
                          {item.label}
                          {badge > 0 ? ` · ${badge}` : ""}
                          <span className="ml-2 text-white/55">G {item.key.toUpperCase()}</span>
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="shrink-0 border-t border-line px-3 py-3">
        <ul className="space-y-0.5">
          <BottomItem collapsed={collapsed} icon={<LifeBuoy />} label="Help & Support" onClick={() => { onNavigate?.(); onOpenHelp(); }} />
          <BottomItem collapsed={collapsed} icon={<Settings />} label="Settings" href="/settings" active={isActive("/settings")} onClick={() => go("/settings")} />
        </ul>
        <div className={cn("mt-2", collapsed && "flex justify-center")}>
          <Dropdown
            align="start"
            width={232}
            items={[
              { label: "Profile & business", icon: <User />, href: "/settings" },
              { label: "Help & shortcuts", icon: <HelpCircle />, onSelect: onOpenHelp },
              { label: "Reset demo data", icon: <RotateCcw />, onSelect: onResetData, separatorBefore: true, danger: true },
            ]}
            trigger={({ toggle, open }) => (
              <button
                onClick={toggle}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-panel p-1.5 text-left transition-colors hover:bg-hover",
                  open && "bg-hover",
                  collapsed && "w-auto",
                )}
                aria-label="Open profile menu"
              >
                <Avatar name={USER.name} size={30} />
                {!collapsed && (
                  <>
                    <div className="min-w-0 flex-1 leading-tight">
                      <div className="truncate text-body font-medium text-ink">{USER.name}</div>
                      <div className="truncate text-caption text-muted">{USER.role}</div>
                    </div>
                    <MoreHorizontal className="h-4 w-4 text-muted" />
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
              "mt-2 flex h-8 w-full items-center gap-2 rounded-control px-2.5 text-small text-muted transition-colors hover:bg-hover hover:text-ink",
              collapsed && "justify-center px-0",
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
            {!collapsed && "Collapse"}
          </button>
        )}
      </div>
    </aside>
  );
}

function BottomItem({
  icon,
  label,
  href,
  onClick,
  collapsed,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  href?: string;
  onClick?: () => void;
  collapsed: boolean;
  active?: boolean;
}) {
  const cls = cn(
    "group/nav relative flex h-9 w-full items-center gap-2.5 rounded-control text-ui font-medium transition-colors [&>svg]:h-[17px] [&>svg]:w-[17px] [&>svg]:shrink-0",
    collapsed ? "justify-center" : "px-2.5",
    active ? "bg-brand-50 text-brand [&>svg]:text-brand" : "text-ink-2 hover:bg-hover hover:text-ink [&>svg]:text-muted",
  );
  const content = (
    <>
      {icon}
      {!collapsed && <span>{label}</span>}
      {collapsed && (
        <span className="pointer-events-none absolute top-1/2 left-[calc(100%+12px)] z-50 -translate-y-1/2 rounded-md bg-ink px-2 py-1 text-small font-medium whitespace-nowrap text-white opacity-0 shadow-lg transition-opacity group-hover/nav:opacity-100">
          {label}
        </span>
      )}
    </>
  );
  return (
    <li>
      {href ? (
        <Link href={href} className={cls} onClick={onClick} aria-current={active ? "page" : undefined}>
          {content}
        </Link>
      ) : (
        <button className={cls} onClick={onClick}>
          {content}
        </button>
      )}
    </li>
  );
}
