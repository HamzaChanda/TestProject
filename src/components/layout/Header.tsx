"use client";

import { useNavigate } from "@/hooks/useNavigate";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import {
  AlertOctagon,
  AlertTriangle,
  Bell,
  Building2,
  CheckCheck,
  HelpCircle,
  Info,
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
} from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";
import { useInventory } from "@/context/InventoryContext";
import { getNotifications } from "@/lib/selectors";
import { Dropdown } from "@/components/ui/Dropdown";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Primitives";
import { ROUTE_LABELS, USER } from "./nav";

export const QUICK_CREATE = [
  { label: "New sale", href: "/sales/new", icon: <ReceiptText /> },
  { label: "New purchase order", href: "/purchases/new", icon: <ShoppingCart /> },
  { label: "Add product", href: "/products/new", icon: <PackagePlus /> },
  { label: "Add customer", href: "/customers?new=1", icon: <UserPlus /> },
  { label: "Add supplier", href: "/suppliers?new=1", icon: <Building2 /> },
];

function useBreadcrumbs() {
  const pathname = usePathname();
  const { state } = useInventory();
  return useMemo(() => {
    const parts = pathname.split("/").filter(Boolean);
    const crumbs: { label: string; href: string; mono?: boolean }[] = [];
    let href = "";
    parts.forEach((part, i) => {
      href += `/${part}`;
      let label = ROUTE_LABELS[part];
      let mono = false;
      if (!label) {
        const section = parts[i - 1];
        // System identifiers (invoice / PO numbers) render in mono.
        mono = section === "sales" || section === "purchases";
        if (section === "sales") label = state.sales.find((s) => s.id === part)?.invoiceNo ?? "Invoice";
        else if (section === "purchases") label = state.purchases.find((p) => p.id === part)?.poNumber ?? "Purchase order";
        else if (section === "products") label = state.products.find((p) => p.id === part)?.name ?? "Product";
        else if (section === "customers") label = state.customers.find((c) => c.id === part)?.name ?? "Customer";
        else if (section === "suppliers") label = state.suppliers.find((s) => s.id === part)?.name ?? "Supplier";
        else label = part;
      }
      if (part === "new") label = { sales: "New sale", purchases: "New purchase order", products: "Add product" }[parts[i - 1]] ?? "New";
      crumbs.push({ label, href, mono });
    });
    return crumbs;
  }, [pathname, state]);
}

const iconBtn =
  "relative grid size-8 place-items-center rounded-control text-ink-2 transition-colors duration-[80ms] hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const menuRow =
  "flex h-8 w-full items-center gap-2.5 rounded-control px-2.5 text-left text-body-sm text-ink-2 outline-none transition-colors duration-[80ms] hover:bg-hover hover:text-ink focus-visible:bg-hover focus-visible:text-ink [&_svg]:size-4 [&_svg]:text-muted";

/**
 * 52px header on canvas. Breadcrumbs ("/" separated, record ids in mono),
 * global search trigger, notifications, a secondary "New" menu and the avatar.
 * Rule: the header never carries a filled primary button — the page owns that.
 */
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
  const last = crumbs[crumbs.length - 1];

  return (
    <header className="no-print sticky top-0 z-40 flex h-header shrink-0 items-center gap-3 border-b border-line bg-canvas/90 px-4 backdrop-blur-md md:px-6 lg:px-8">
      <button onClick={onOpenMobileNav} className={cn(iconBtn, "-ml-1.5 md:hidden")} aria-label="Open navigation">
        <Menu className="size-[18px]" />
      </button>

      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="hidden min-w-0 sm:block">
        <ol className="flex min-w-0 items-center gap-1.5 text-body-sm">
          {crumbs.map((c, i) => (
            <li key={c.href} className="flex min-w-0 items-center gap-1.5">
              {i > 0 && (
                <span className="text-faint" aria-hidden>
                  /
                </span>
              )}
              {i === crumbs.length - 1 ? (
                <span aria-current="page" className={cn("truncate font-medium text-ink", c.mono && "font-mono text-code")}>
                  {c.label}
                </span>
              ) : (
                <Link
                  href={c.href}
                  className={cn(
                    "truncate rounded-tag text-muted transition-colors duration-[80ms] hover:text-ink focus-visible:outline-2 focus-visible:outline-brand",
                    c.mono && "font-mono text-code",
                  )}
                >
                  {c.label}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <span className={cn("truncate text-h3 font-semibold text-ink sm:hidden", last?.mono && "font-mono")}>{last?.label ?? "StockFlow"}</span>

      <div className="ml-auto flex items-center gap-1.5 md:gap-2">
        {/* Search trigger */}
        <button
          onClick={onOpenSearch}
          className="hidden h-8 w-[220px] shrink-0 items-center gap-2 rounded-control border border-line-strong bg-surface px-2.5 text-body-sm whitespace-nowrap text-faint transition-colors duration-[80ms] hover:border-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand md:flex lg:w-[280px]"
        >
          <Search className="size-4" />
          <span className="flex-1 truncate text-left">Search products, invoices…</span>
          <kbd className="rounded-tag border border-line px-1 font-mono text-[10.5px] text-muted">Ctrl K</kbd>
        </button>
        <button onClick={onOpenSearch} className={cn(iconBtn, "md:hidden")} aria-label="Search">
          <Search className="size-[18px]" />
        </button>

        {/* Notifications */}
        <Dropdown
          width={360}
          trigger={({ toggle, open }) => (
            <button
              onClick={toggle}
              aria-expanded={open}
              aria-haspopup="menu"
              className={cn(iconBtn, open && "bg-hover")}
              aria-label={`Notifications${unread.length ? ` (${unread.length} unread)` : ""}`}
            >
              <Bell className="size-[18px]" />
              {unread.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-ink px-1 font-mono text-[10px] font-medium text-white ring-2 ring-canvas">
                  {unread.length > 9 ? "9+" : unread.length}
                </span>
              )}
            </button>
          )}
        >
          {(close) => (
            <div>
              <div className="flex items-center justify-between px-2.5 pt-1.5 pb-2">
                <div>
                  <div className="text-body font-semibold text-ink">Notifications</div>
                  <div className="text-label text-muted">{unread.length ? `${unread.length} need your attention` : "You're all caught up"}</div>
                </div>
                {unread.length > 0 && (
                  <button
                    role="menuitem"
                    tabIndex={-1}
                    onClick={() => actions.markNotificationsRead(notifications.map((n) => n.id))}
                    className="inline-flex h-6 items-center gap-1 rounded-control px-2 text-label font-medium text-petrol-700 outline-none hover:bg-petrol-50 focus-visible:bg-petrol-50"
                  >
                    <CheckCheck className="size-3.5" /> Mark all read
                  </button>
                )}
              </div>
              <div className="h-px bg-line" />
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-body-sm text-muted">No alerts right now. Stock levels and orders look healthy.</div>
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
                          <div className="flex items-center justify-between px-2.5 pt-2.5 pb-1 font-cond text-overline font-semibold tracking-[0.06em] text-faint uppercase">
                            {n.group}
                            <span className="font-mono">{groupCount}</span>
                          </div>
                        )}
                        <button
                          role="menuitem"
                          tabIndex={-1}
                          onClick={() => {
                            actions.markNotificationsRead([n.id]);
                            close();
                            navigate(n.href);
                          }}
                          className="relative flex w-full gap-2.5 rounded-control py-2 pr-2.5 pl-3.5 text-left outline-none transition-colors duration-[80ms] hover:bg-hover focus-visible:bg-hover"
                        >
                          <span
                            aria-hidden
                            className={cn(
                              "absolute top-2 bottom-2 left-1 w-[3px] rounded-full",
                              n.tone === "danger" ? "bg-danger-solid" : n.tone === "warning" ? "bg-signal" : "bg-line-hover",
                            )}
                          />
                          <Icon
                            aria-hidden
                            className={cn("mt-0.5 size-4 shrink-0", n.tone === "danger" ? "text-danger" : n.tone === "warning" ? "text-warning" : "text-muted")}
                          />
                          <span className="min-w-0 flex-1">
                            <span className={cn("block truncate text-body-sm", isUnread ? "font-semibold text-ink" : "font-medium text-ink-2")}>{n.title}</span>
                            <span className="block truncate text-label text-muted">{n.description}</span>
                            {n.date && <span className="mt-0.5 block text-label text-faint">{timeAgo(n.date)}</span>}
                          </span>
                          {isUnread && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-petrol-500" aria-label="Unread" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </Dropdown>

        {/* Quick create — secondary; the page owns the one filled action. */}
        <Dropdown
          width={220}
          items={QUICK_CREATE.map((q) => ({ label: q.label, href: q.href, icon: q.icon }))}
          trigger={({ toggle, open }) => (
            <Button
              variant="secondary"
              onClick={toggle}
              icon={<Plus />}
              className="max-sm:w-8 max-sm:px-0"
              aria-label="Create new record"
              aria-expanded={open}
              aria-haspopup="menu"
            >
              <span className="hidden sm:inline">New</span>
            </Button>
          )}
        />

        {/* Profile */}
        <Dropdown
          width={240}
          trigger={({ toggle, open }) => (
            <button
              onClick={toggle}
              aria-expanded={open}
              aria-haspopup="menu"
              className="ml-0.5 rounded-full transition-shadow duration-[80ms] hover:ring-2 hover:ring-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              aria-label="Open profile menu"
            >
              <Avatar name={USER.name} size={28} />
            </button>
          )}
        >
          {(close) => (
            <div>
              <div className="flex items-center gap-3 px-2.5 py-2">
                <Avatar name={USER.name} size={32} />
                <div className="min-w-0 leading-tight">
                  <div className="truncate text-body font-semibold text-ink">{USER.name}</div>
                  <div className="truncate text-label text-muted">{USER.email}</div>
                </div>
              </div>
              <div className="mx-1 mb-1 rounded-control bg-subtle px-2 py-1.5 text-label text-muted">
                {state.settings.businessName} · {USER.role}
              </div>
              <div className="my-1 h-px bg-line" />
              <Link href="/settings" onClick={close} role="menuitem" tabIndex={-1} className={menuRow}>
                <User /> Profile &amp; business
              </Link>
              <Link href="/settings" onClick={close} role="menuitem" tabIndex={-1} className={menuRow}>
                <Settings /> Settings
              </Link>
              <button
                role="menuitem"
                tabIndex={-1}
                onClick={() => {
                  close();
                  onOpenHelp();
                }}
                className={menuRow}
              >
                <HelpCircle /> Help &amp; shortcuts
                <span className="ml-auto font-mono text-[11px] text-faint">?</span>
              </button>
              <div className="my-1 h-px bg-line" />
              <button
                role="menuitem"
                tabIndex={-1}
                onClick={() => {
                  close();
                  onResetData();
                }}
                className={cn(menuRow, "text-danger hover:bg-danger-bg hover:text-danger focus-visible:bg-danger-bg focus-visible:text-danger [&_svg]:text-danger")}
              >
                <RotateCcw /> Reset demo data
              </button>
            </div>
          )}
        </Dropdown>
      </div>
    </header>
  );
}
