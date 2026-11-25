"use client";

import { useNavigate } from "@/hooks/useNavigate";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import {
  Bell,
  Building2,
  CheckCheck,
  ChevronRight,
  HelpCircle,
  Menu,
  PackagePlus,
  Plus,
  ReceiptText,
  RotateCcw,
  Search,
  Settings,
  ShoppingCart,
  User,
  UserPlus,
  AlertTriangle,
  AlertOctagon,
  Info,
} from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";
import { useInventory } from "@/context/InventoryContext";
import { getNotifications } from "@/lib/selectors";
import { Dropdown } from "@/components/ui/Dropdown";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Primitives";
import { ROUTE_LABELS, USER } from "./nav";

export const QUICK_CREATE = [
  { label: "New Sale", href: "/sales/new", icon: <ReceiptText /> },
  { label: "New Purchase", href: "/purchases/new", icon: <ShoppingCart /> },
  { label: "Add Product", href: "/products/new", icon: <PackagePlus /> },
  { label: "Add Customer", href: "/customers?new=1", icon: <UserPlus /> },
  { label: "Add Supplier", href: "/suppliers?new=1", icon: <Building2 /> },
];

function useBreadcrumbs() {
  const pathname = usePathname();
  const { state } = useInventory();
  return useMemo(() => {
    const parts = pathname.split("/").filter(Boolean);
    const crumbs: { label: string; href: string }[] = [];
    let href = "";
    parts.forEach((part, i) => {
      href += `/${part}`;
      let label = ROUTE_LABELS[part];
      if (!label) {
        const section = parts[i - 1];
        if (section === "sales") label = state.sales.find((s) => s.id === part)?.invoiceNo ?? "Invoice";
        else if (section === "purchases") label = state.purchases.find((p) => p.id === part)?.poNumber ?? "Purchase order";
        else if (section === "products") label = state.products.find((p) => p.id === part)?.name ?? "Product";
        else if (section === "customers") label = state.customers.find((c) => c.id === part)?.name ?? "Customer";
        else if (section === "suppliers") label = state.suppliers.find((s) => s.id === part)?.name ?? "Supplier";
        else label = part;
      }
      if (part === "new") label = { sales: "New sale", purchases: "New purchase order", products: "Add product" }[parts[i - 1]] ?? "New";
      crumbs.push({ label, href });
    });
    return crumbs;
  }, [pathname, state]);
}

export function Header({
  onOpenMobileNav,
  onOpenSearch,
  onOpenHelp,
  onResetData,
}: {
  onOpenMobileNav: () => void;
  onOpenSearch: () => void;
  onOpenHelp: () => void;
  onResetData: () => void;
}) {
  const crumbs = useBreadcrumbs();
  const navigate = useNavigate();
  const { state, actions } = useInventory();
  const notifications = useMemo(() => getNotifications(state), [state]);
  const read = new Set(state.readNotificationIds);
  const unread = notifications.filter((n) => !read.has(n.id));

  return (
    <header className="no-print sticky top-0 z-40 flex h-[60px] shrink-0 items-center gap-3 border-b border-line bg-surface/85 px-4 backdrop-blur-md md:px-6">
      <button onClick={onOpenMobileNav} className="-ml-1 rounded-lg p-2 text-ink-2 hover:bg-hover md:hidden" aria-label="Open navigation">
        <Menu className="h-5 w-5" />
      </button>

      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1 text-body sm:flex">
        <Link href="/dashboard" className="text-muted transition-colors hover:text-ink">
          StockFlow
        </Link>
        {crumbs.map((c, i) => (
          <span key={c.href} className="flex min-w-0 items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-faint" />
            {i === crumbs.length - 1 ? (
              <span className="truncate font-medium text-ink">{c.label}</span>
            ) : (
              <Link href={c.href} className="truncate text-muted transition-colors hover:text-ink">
                {c.label}
              </Link>
            )}
          </span>
        ))}
      </nav>
      <span className="truncate text-title-sm font-semibold text-ink sm:hidden">{crumbs[crumbs.length - 1]?.label ?? "StockFlow"}</span>

      <div className="ml-auto flex items-center gap-1.5 md:gap-2">
        {/* Search trigger */}
        <button
          onClick={onOpenSearch}
          className="hidden h-9 w-[220px] shrink-0 items-center gap-2 whitespace-nowrap rounded-control border border-line-strong bg-surface px-3 text-body text-faint shadow-[0_1px_2px_rgba(16,24,40,0.03)] transition hover:border-line-hover md:flex lg:w-[300px]"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 truncate text-left">Search products, invoices…</span>
          <kbd className="rounded border border-line bg-subtle px-1.5 py-px font-sans text-micro font-medium text-muted">Ctrl K</kbd>
        </button>
        <button onClick={onOpenSearch} className="rounded-lg p-2 text-ink-2 hover:bg-hover md:hidden" aria-label="Search">
          <Search className="h-[18px] w-[18px]" />
        </button>

        {/* Notifications */}
        <Dropdown
          width={360}
          trigger={({ toggle, open }) => (
            <button
              onClick={toggle}
              className={cn("relative rounded-lg p-2 text-ink-2 transition-colors hover:bg-hover", open && "bg-hover")}
              aria-label={`Notifications${unread.length ? ` (${unread.length} unread)` : ""}`}
            >
              <Bell className="h-[18px] w-[18px]" />
              {unread.length > 0 && (
                <span className="absolute top-1 right-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-micro font-semibold text-white ring-2 ring-surface">
                  {unread.length > 9 ? "9+" : unread.length}
                </span>
              )}
            </button>
          )}
        >
          {(close) => (
            <div>
              <div className="flex items-center justify-between px-3 pt-2 pb-2">
                <div>
                  <div className="text-ui font-semibold text-ink">Notifications</div>
                  <div className="text-small text-muted">{unread.length ? `${unread.length} need your attention` : "You're all caught up"}</div>
                </div>
                {unread.length > 0 && (
                  <button
                    onClick={() => actions.markNotificationsRead(notifications.map((n) => n.id))}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-small font-medium text-brand hover:bg-brand-50"
                  >
                    <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                  </button>
                )}
              </div>
              <div className="h-px bg-line" />
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-body text-muted">No alerts right now. Stock levels and orders look healthy.</div>
              ) : (
                <ul className="scrollbar-thin max-h-[380px] overflow-y-auto py-1">
                  {notifications.map((n, idx) => {
                    const isUnread = !read.has(n.id);
                    const groupStart = idx === 0 || notifications[idx - 1].group !== n.group;
                    const groupCount = notifications.filter((x) => x.group === n.group).length;
                    const Icon = n.tone === "danger" ? AlertOctagon : n.tone === "warning" ? AlertTriangle : Info;
                    return (
                      <li key={n.id}>
                        {groupStart && (
                          <div className="flex items-center justify-between px-3 pt-2.5 pb-1 text-micro font-semibold tracking-[0.06em] text-faint uppercase">
                            {n.group}
                            <span className="tabular">{groupCount}</span>
                          </div>
                        )}
                        <button
                          onClick={() => {
                            actions.markNotificationsRead([n.id]);
                            close();
                            navigate(n.href);
                          }}
                          className="flex w-full gap-3 rounded-control px-3 py-2.5 text-left transition-colors hover:bg-hover"
                        >
                          <span
                            className={cn(
                              "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full",
                              n.tone === "danger" && "bg-danger-bg text-danger",
                              n.tone === "warning" && "bg-warning-bg text-warning",
                              n.tone === "info" && "bg-info-bg text-info",
                            )}
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className={cn("block truncate text-body", isUnread ? "font-semibold text-ink" : "font-medium text-ink-2")}>{n.title}</span>
                            <span className="block truncate text-small text-muted">{n.description}</span>
                            {n.date && <span className="mt-0.5 block text-micro text-faint">{timeAgo(n.date)}</span>}
                          </span>
                          {isUnread && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </Dropdown>

        {/* Quick create */}
        <Dropdown
          width={210}
          items={QUICK_CREATE.map((q) => ({ label: q.label, href: q.href, icon: q.icon }))}
          trigger={({ toggle }) => (
            <Button onClick={toggle} icon={<Plus className="h-4 w-4" />} className="max-sm:w-9 max-sm:px-0" aria-label="Quick create">
              <span className="hidden sm:inline">Create</span>
            </Button>
          )}
        />

        {/* Profile */}
        <Dropdown
          width={240}
          trigger={({ toggle }) => (
            <button onClick={toggle} className="ml-0.5 rounded-full ring-offset-2 transition hover:ring-2 hover:ring-brand/20" aria-label="Open profile menu">
              <Avatar name={USER.name} size={32} />
            </button>
          )}
        >
          {(close) => (
            <div>
              <div className="flex items-center gap-3 px-3 py-2.5">
                <Avatar name={USER.name} size={36} />
                <div className="min-w-0 leading-tight">
                  <div className="truncate text-ui font-semibold text-ink">{USER.name}</div>
                  <div className="truncate text-small text-muted">{USER.email}</div>
                </div>
              </div>
              <div className="mx-1 mb-1 rounded-md bg-subtle px-2 py-1.5 text-caption text-muted">
                {state.settings.businessName} · {USER.role}
              </div>
              <div className="my-1 h-px bg-line" />
              {[
                { label: "Profile & business", icon: User, href: "/settings" },
                { label: "Settings", icon: Settings, href: "/settings" },
              ].map((i) => (
                <Link
                  key={i.label}
                  href={i.href}
                  onClick={close}
                  className="flex items-center gap-2.5 rounded-control px-2.5 py-[7px] text-body text-ink-2 hover:bg-hover hover:text-ink"
                >
                  <i.icon className="h-[15px] w-[15px] text-muted" /> {i.label}
                </Link>
              ))}
              <button
                onClick={() => {
                  close();
                  onOpenHelp();
                }}
                className="flex w-full items-center gap-2.5 rounded-control px-2.5 py-[7px] text-body text-ink-2 hover:bg-hover hover:text-ink"
              >
                <HelpCircle className="h-[15px] w-[15px] text-muted" /> Help &amp; shortcuts
              </button>
              <div className="my-1 h-px bg-line" />
              <button
                onClick={() => {
                  close();
                  onResetData();
                }}
                className="flex w-full items-center gap-2.5 rounded-control px-2.5 py-[7px] text-body text-danger hover:bg-danger-bg"
              >
                <RotateCcw className="h-[15px] w-[15px]" /> Reset demo data
              </button>
            </div>
          )}
        </Dropdown>
      </div>
    </header>
  );
}
