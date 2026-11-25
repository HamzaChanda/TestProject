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
}

export const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  { title: "Overview", items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }] },
  {
    title: "Operations",
    items: [
      { label: "Sales", href: "/sales", icon: ReceiptText },
      { label: "Purchases", href: "/purchases", icon: ShoppingCart },
      { label: "Stock", href: "/stock", icon: Boxes },
      { label: "Transfers", href: "/transfers", icon: ArrowLeftRight },
    ],
  },
  {
    title: "Management",
    items: [
      { label: "Products", href: "/products", icon: Package },
      { label: "Customers", href: "/customers", icon: Users },
      { label: "Suppliers", href: "/suppliers", icon: Building2 },
    ],
  },
  { title: "Analytics", items: [{ label: "Reports", href: "/reports", icon: BarChart3 }] },
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
