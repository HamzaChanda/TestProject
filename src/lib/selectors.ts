/**
 * Derived data. Every KPI, chart series and report row in the app is computed
 * here from the same transaction records — there is no separate report data.
 */
import {
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  format,
  isAfter,
  isBefore,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfMonth,
  subDays,
  subMonths,
} from "date-fns";
import type { ID, InventoryState, Product, Purchase, Sale } from "@/types";
import { productStatus, stockValue, totalStock } from "./calc";
import { round2 } from "./utils";

export interface DateRange {
  from: Date;
  to: Date;
}

export type RangePreset = "7d" | "30d" | "month" | "90d" | "6m" | "12m" | "all";

export const RANGE_PRESETS: { value: RangePreset; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "month", label: "This month" },
  { value: "90d", label: "Last 90 days" },
  { value: "6m", label: "Last 6 months" },
  { value: "12m", label: "Last 12 months" },
  { value: "all", label: "All time" },
];

export function rangeFromPreset(preset: RangePreset, now = new Date()): DateRange {
  const to = endOfDay(now);
  switch (preset) {
    case "7d":
      return { from: startOfDay(subDays(now, 6)), to };
    case "30d":
      return { from: startOfDay(subDays(now, 29)), to };
    case "month":
      return { from: startOfMonth(now), to };
    case "90d":
      return { from: startOfDay(subDays(now, 89)), to };
    case "6m":
      return { from: startOfMonth(subMonths(now, 5)), to };
    case "12m":
      return { from: startOfMonth(subMonths(now, 11)), to };
    case "all":
      return { from: new Date(2000, 0, 1), to };
  }
}

/** The equal-length window immediately before `range` (for trend deltas). */
export function previousRange(range: DateRange): DateRange {
  const days = Math.max(differenceInCalendarDays(range.to, range.from) + 1, 1);
  return { from: startOfDay(subDays(range.from, days)), to: endOfDay(subDays(range.from, 1)) };
}

export function inRange(dateIso: string, range: DateRange) {
  const d = parseISO(dateIso);
  return isWithinInterval(d, { start: range.from, end: range.to });
}

export const isActiveSale = (s: Sale) => s.status !== "Cancelled";
export const isCommittedPurchase = (p: Purchase) => p.status !== "Draft" && p.status !== "Cancelled";

export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return round2(((current - previous) / previous) * 100);
}

/* ------------------------------ Products ------------------------------ */

export function getLowStockProducts(state: InventoryState) {
  return state.products
    .filter((p) => productStatus(p) !== "In Stock")
    .sort((a, b) => totalStock(a) / Math.max(a.minStock, 1) - totalStock(b) / Math.max(b.minStock, 1));
}

export function getStockSummary(state: InventoryState) {
  let units = 0;
  let value = 0;
  let retailValue = 0;
  let low = 0;
  let out = 0;
  for (const p of state.products) {
    const qty = totalStock(p);
    units += qty;
    value += stockValue(p);
    retailValue += qty * p.sellingPrice;
    const st = productStatus(p);
    if (st === "Low Stock") low++;
    if (st === "Out of Stock") out++;
  }
  return { units, value: round2(value), retailValue: round2(retailValue), low, out, products: state.products.length };
}

export function getCategoryDistribution(state: InventoryState, metric: "value" | "units" = "value") {
  const map = new Map<string, { category: string; value: number; units: number; products: number }>();
  for (const p of state.products) {
    const row = map.get(p.category) ?? { category: p.category, value: 0, units: 0, products: 0 };
    row.value += stockValue(p);
    row.units += totalStock(p);
    row.products += 1;
    map.set(p.category, row);
  }
  return [...map.values()]
    .map((r) => ({ ...r, value: round2(r.value) }))
    .sort((a, b) => (metric === "value" ? b.value - a.value : b.units - a.units));
}

export function getLastStockUpdate(state: InventoryState, productId: ID) {
  return state.movements.find((m) => m.productId === productId)?.date ?? null;
}

export function getProductSalesStats(state: InventoryState, productId: ID) {
  let units = 0;
  let revenue = 0;
  for (const s of state.sales) {
    if (!isActiveSale(s)) continue;
    for (const i of s.items) {
      if (i.productId === productId) {
        units += i.quantity;
        revenue += i.total;
      }
    }
  }
  const incoming = state.purchases
    .filter((p) => p.status === "Pending" || p.status === "Partially Received")
    .reduce((sum, p) => sum + p.items.filter((i) => i.productId === productId).reduce((s, i) => s + (i.quantity - i.receivedQty), 0), 0);
  return { units, revenue: round2(revenue), incoming };
}

/* ---------------------------- Replenishment ---------------------------- */

/** Days of demand a reorder should cover beyond the minimum level. */
export const REORDER_COVER_DAYS = 30;
const VELOCITY_WINDOW_DAYS = 90;

/** Average units sold per day over the last 90 days (cancelled sales excluded). */
export function getSalesVelocity(state: InventoryState, productId: ID, now = new Date()) {
  const since = subDays(now, VELOCITY_WINDOW_DAYS);
  let units = 0;
  for (const s of state.sales) {
    if (!isActiveSale(s) || parseISO(s.date) < since) continue;
    for (const i of s.items) if (i.productId === productId) units += i.quantity;
  }
  return units / VELOCITY_WINDOW_DAYS;
}

export interface ReplenishmentAdvice {
  onHand: number;
  incoming: number;
  /** Units sold per day (90-day average). */
  velocity: number;
  /** Days until on-hand stock runs out at the current rate; null when there are no recent sales. */
  daysOfCover: number | null;
  /** Suggested order quantity after counting incoming stock; 0 means no order needed. */
  suggestedQty: number;
  /** Stock level the suggestion restores. */
  targetLevel: number;
}

/**
 * Reorder advice: restore stock to the minimum level plus 30 days of demand
 * (never less than twice the minimum), after counting what is already on order.
 */
export function getReplenishment(state: InventoryState, product: Product, now = new Date()): ReplenishmentAdvice {
  const onHand = totalStock(product);
  const { incoming } = getProductSalesStats(state, product.id);
  const velocity = getSalesVelocity(state, product.id, now);
  const targetLevel = Math.max(product.minStock * 2, Math.ceil(product.minStock + velocity * REORDER_COVER_DAYS));
  const suggestedQty = Math.max(targetLevel - onHand - incoming, 0);
  const daysOfCover = velocity > 0 ? Math.floor(onHand / velocity) : null;
  return { onHand, incoming, velocity, daysOfCover, suggestedQty, targetLevel };
}

/* ------------------------------- Dashboard ----------------------------- */

export function salesTotal(state: InventoryState, range: DateRange) {
  return round2(state.sales.filter((s) => isActiveSale(s) && inRange(s.date, range)).reduce((sum, s) => sum + s.total, 0));
}

export function getDashboardKpis(state: InventoryState, range: DateRange) {
  const stock = getStockSummary(state);
  const totalSales = salesTotal(state, range);
  const prevSales = salesTotal(state, previousRange(range));
  const salesCount = state.sales.filter((s) => isActiveSale(s) && inRange(s.date, range)).length;
  const newProducts = state.products.filter((p) => inRange(p.createdAt, range)).length;
  // Stock value change over the range: replay movements back to the start of the range.
  const costById = new Map(state.products.map((p) => [p.id, p.costPrice]));
  const valueDelta = state.movements
    .filter((m) => inRange(m.date, range))
    .reduce((sum, m) => sum + m.quantity * (costById.get(m.productId) ?? 0), 0);
  const startValue = stock.value - valueDelta;
  return {
    totalProducts: stock.products,
    newProducts,
    stockValue: stock.value,
    stockValueTrend: pctChange(stock.value, startValue),
    totalUnits: stock.units,
    totalSales,
    salesCount,
    salesTrend: pctChange(totalSales, prevSales),
    lowStock: stock.low + stock.out,
    outOfStock: stock.out,
  };
}

/** Monthly sales vs purchases for the last `months` months (including current). */
export function getMonthlySeries(state: InventoryState, months = 6, now = new Date()) {
  const buckets = Array.from({ length: months }, (_, i) => {
    const start = startOfMonth(subMonths(now, months - 1 - i));
    return { key: format(start, "yyyy-MM"), label: format(start, "MMM"), fullLabel: format(start, "MMMM yyyy"), start, end: endOfMonth(start), sales: 0, purchases: 0, orders: 0 };
  });
  const find = (iso: string) => {
    const k = format(parseISO(iso), "yyyy-MM");
    return buckets.find((b) => b.key === k);
  };
  for (const s of state.sales) {
    if (!isActiveSale(s)) continue;
    const b = find(s.date);
    if (b) {
      b.sales += s.total;
      b.orders += 1;
    }
  }
  for (const p of state.purchases) {
    if (!isCommittedPurchase(p) && !(p.status === "Cancelled" && p.items.some((i) => i.receivedQty > 0))) continue;
    const b = find(p.orderDate);
    if (b) b.purchases += p.status === "Cancelled" ? receivedValue(p) : p.total;
  }
  return buckets.map((b) => ({ ...b, sales: round2(b.sales), purchases: round2(b.purchases) }));
}

/* -------------------------------- Sales -------------------------------- */

export function getSalesSummary(sales: Sale[]) {
  const active = sales.filter(isActiveSale);
  return {
    total: sales.length,
    completed: sales.filter((s) => s.status === "Completed").length,
    pending: sales.filter((s) => s.status === "Pending").length,
    cancelled: sales.filter((s) => s.status === "Cancelled").length,
    revenue: round2(active.reduce((s, x) => s + x.total, 0)),
    collected: round2(active.reduce((s, x) => s + x.amountPaid, 0)),
    outstanding: round2(active.reduce((s, x) => s + (x.total - x.amountPaid), 0)),
  };
}

/* ------------------------------ Purchases ------------------------------ */

export function receivedValue(p: Purchase) {
  const sub = p.items.reduce((s, i) => s + i.receivedQty * i.unitCost, 0);
  return round2(sub * (1 + p.taxRate / 100));
}

export function purchaseProgress(p: Purchase) {
  const ordered = p.items.reduce((s, i) => s + i.quantity, 0);
  const received = p.items.reduce((s, i) => s + i.receivedQty, 0);
  return { ordered, received, remaining: ordered - received, pct: ordered ? Math.round((received / ordered) * 100) : 0 };
}

export function isOverdue(p: Purchase, now = new Date()) {
  return (
    (p.status === "Pending" || p.status === "Partially Received") &&
    !!p.expectedDate &&
    isBefore(endOfDay(parseISO(p.expectedDate)), now)
  );
}

export function getPurchaseSummary(purchases: Purchase[]) {
  return {
    total: purchases.length,
    pending: purchases.filter((p) => p.status === "Pending" || p.status === "Partially Received").length,
    received: purchases.filter((p) => p.status === "Received").length,
    drafts: purchases.filter((p) => p.status === "Draft").length,
    value: round2(purchases.filter(isCommittedPurchase).reduce((s, p) => s + p.total, 0)),
    receivedValue: round2(purchases.reduce((s, p) => s + receivedValue(p), 0)),
  };
}

/* ------------------------- Customers & suppliers ------------------------ */

export function getCustomerStats(state: InventoryState, customerId: ID) {
  const sales = state.sales.filter((s) => s.customerId === customerId);
  const active = sales.filter(isActiveSale);
  const last = sales.reduce<string | null>((acc, s) => (!acc || isAfter(parseISO(s.date), parseISO(acc)) ? s.date : acc), null);
  return {
    orders: active.length,
    spent: round2(active.reduce((s, x) => s + x.total, 0)),
    outstanding: round2(active.reduce((s, x) => s + (x.total - x.amountPaid), 0)),
    lastOrder: last,
    sales,
  };
}

export function getSupplierStats(state: InventoryState, supplierId: ID) {
  const purchases = state.purchases.filter((p) => p.supplierId === supplierId);
  return {
    orders: purchases.length,
    total: round2(purchases.filter(isCommittedPurchase).reduce((s, p) => s + p.total, 0)),
    outstanding: purchases.filter((p) => p.status === "Pending" || p.status === "Partially Received").length,
    products: state.products.filter((p) => p.supplierId === supplierId).length,
    purchases,
  };
}

/* ---------------------------- Notifications ---------------------------- */

export interface AppNotification {
  id: string;
  /** Grouped by type in the notification centre. */
  group: "Stock" | "Purchasing" | "Payments";
  tone: "danger" | "warning" | "info";
  title: string;
  description: string;
  href: string;
  date: string | null;
}

export function getNotifications(state: InventoryState): AppNotification[] {
  const list: AppNotification[] = [];
  if (state.settings.lowStockNotifications) {
    for (const p of getLowStockProducts(state)) {
      const out = productStatus(p) === "Out of Stock";
      const qty = totalStock(p);
      list.push({
        id: `stock-${p.id}-${qty}`,
        group: "Stock",
        tone: out ? "danger" : "warning",
        title: out ? `${p.name} is out of stock` : `${p.name} is running low`,
        description: out ? `Minimum level is ${p.minStock}. Raise a purchase order.` : `${qty} left · minimum ${p.minStock}`,
        href: `/products/${p.id}`,
        date: getLastStockUpdate(state, p.id),
      });
    }
  }
  for (const p of state.purchases) {
    if (isOverdue(p)) {
      list.push({
        id: `overdue-${p.id}-${p.status}`,
        group: "Purchasing",
        tone: "warning",
        title: `${p.poNumber} is overdue`,
        description: `Expected from ${p.supplierName} on ${format(parseISO(p.expectedDate), "dd MMM")}`,
        href: `/purchases/${p.id}`,
        date: p.expectedDate,
      });
    }
  }
  for (const s of state.sales) {
    if (s.status !== "Cancelled" && s.paymentStatus !== "Paid" && differenceInCalendarDays(new Date(), parseISO(s.date)) >= 7) {
      list.push({
        id: `due-${s.id}-${s.amountPaid}`,
        group: "Payments",
        tone: "info",
        title: `Payment due on ${s.invoiceNo}`,
        description: `${s.customerName} · invoice is ${differenceInCalendarDays(new Date(), parseISO(s.date))} days old`,
        href: `/sales/${s.id}`,
        date: s.date,
      });
    }
  }
  return list;
}

/* ------------------------- Shared aggregations -------------------------- */

/** Best-selling products across the given invoices (cancelled excluded). */
export function getTopProducts(
  state: InventoryState,
  sales: Sale[],
  opts: { category?: string; limit?: number } = {},
) {
  const categoryOf = new Map(state.products.map((p) => [p.id, p.category]));
  const map = new Map<string, { name: string; value: number; units: number }>();
  for (const s of sales) {
    if (!isActiveSale(s)) continue;
    for (const i of s.items) {
      if (opts.category && opts.category !== "all" && categoryOf.get(i.productId) !== opts.category) continue;
      const r = map.get(i.productId) ?? { name: i.name, value: 0, units: 0 };
      r.value += i.total;
      r.units += i.quantity;
      map.set(i.productId, r);
    }
  }
  return [...map.values()]
    .map((r) => ({ ...r, value: round2(r.value) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, opts.limit ?? 6);
}

/** Units, distinct SKUs and cost value held in each warehouse. */
export function getWarehouseStats(state: InventoryState) {
  return state.warehouses.map((w) => {
    let units = 0;
    let value = 0;
    let skus = 0;
    for (const p of state.products) {
      const q = p.stock[w.id] ?? 0;
      units += q;
      value += q * p.costPrice;
      if (q > 0) skus++;
    }
    return { ...w, units, value: round2(value), skus };
  });
}
