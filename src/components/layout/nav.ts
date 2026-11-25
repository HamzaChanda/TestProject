import {
  ArrowLeftRight,
  BarChart3,
  Boxes,
  Building2,
  LayoutDashboard,
  Package,
  ReceiptText,
  ShoppingCart,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Second key of the "G then <key>" navigation shortcut. */
  key: string;
}

export const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  { title: "Overview", items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, key: "d" }] },
  {
    title: "Operations",
    items: [
      { label: "Sales", href: "/sales", icon: ReceiptText, key: "s" },
      { label: "Purchases", href: "/purchases", icon: ShoppingCart, key: "p" },
      { label: "Stock", href: "/stock", icon: Boxes, key: "k" },
      { label: "Transfers", href: "/transfers", icon: ArrowLeftRight, key: "t" },
    ],
  },
  {
    title: "Management",
    items: [
      { label: "Products", href: "/products", icon: Package, key: "i" },
      { label: "Customers", href: "/customers", icon: Users, key: "c" },
      { label: "Suppliers", href: "/suppliers", icon: Building2, key: "v" },
    ],
  },
  { title: "Analytics", items: [{ label: "Reports", href: "/reports", icon: BarChart3, key: "r" }] },
];

export const ROUTE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  sales: "Sales",
  purchases: "Purchases",
  stock: "Stock",
  transfers: "Transfers",
  products: "Products",
  customers: "Customers",
  suppliers: "Suppliers",
  reports: "Reports",
  settings: "Settings",
  new: "New",
  edit: "Edit",
};

export const USER = { name: "Aarav Mehta", role: "Operations Manager", email: "aarav@stockflow.demo" };

/** "G then <key>" → route. Settings uses the comma, as in many desktop apps. */
export const GO_SHORTCUTS: { key: string; label: string; href: string }[] = [
  ...NAV_SECTIONS.flatMap((s) => s.items).map((i) => ({ key: i.key, label: i.label, href: i.href })),
  { key: ",", label: "Settings", href: "/settings" },
];
