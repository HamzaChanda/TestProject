/**
 * Business-logic verification for StockFlow's transaction engine.
 * Run with:  npm run verify
 *
 * Exercises the QA scenarios from the brief directly against the engine
 * (the same functions the UI calls), plus seed-data consistency checks.
 */
import { createSeedState } from "../src/data/seed";
import * as engine from "../src/lib/inventory";
import { productStatus, totalStock } from "../src/lib/calc";
import { getDashboardKpis, getLowStockProducts } from "../src/lib/selectors";
import type { InventoryState } from "../src/types";

let passed = 0;
let failed = 0;
function check(label: string, cond: boolean, detail = "") {
  if (cond) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.log(`  ✗ ${label} ${detail}`);
  }
}
function expectThrow(label: string, fn: () => unknown, contains?: string) {
  try {
    fn();
    check(label, false, "(did not throw)");
  } catch (e) {
    const msg = (e as Error).message;
    check(label, !contains || msg.includes(contains), `(message: ${msg})`);
  }
}
const stockOf = (s: InventoryState, sku: string) => totalStock(s.products.find((p) => p.sku === sku)!);
const prod = (s: InventoryState, sku: string) => s.products.find((p) => p.sku === sku)!;

let state = createSeedState(new Date());
const MAIN = "wh_main";
const RETAIL = "wh_retail";

console.log("\nSeed consistency");
check("12 products", state.products.length === 12);
check("8 customers / 5 suppliers", state.customers.length === 8 && state.suppliers.length === 5);
const statuses = state.products.map(productStatus);
check("≥3 low-stock products", statuses.filter((s) => s === "Low Stock").length >= 3, statuses.join(","));
check("≥1 out-of-stock product", statuses.includes("Out of Stock"));
check("no negative stock anywhere", state.products.every((p) => Object.values(p.stock).every((q) => q >= 0)));
// Movements must reconcile exactly with on-hand stock.
const reconciles = state.products.every((p) => {
  const sum = state.movements.filter((m) => m.productId === p.id).reduce((s, m) => s + m.quantity, 0);
  const inTransit = state.transfers.filter((t) => t.productId === p.id && t.status === "In Transit").reduce((s, t) => s + t.quantity, 0);
  return sum === totalStock(p) && inTransit >= 0;
});
check("stock history reconciles with on-hand quantities", reconciles);
const statusSet = new Set(state.purchases.map((p) => p.status));
check("purchases cover all statuses", ["Draft", "Pending", "Partially Received", "Received", "Cancelled"].every((s) => statusSet.has(s as never)), [...statusSet].join(","));
for (const p of state.products) console.log(`    ${p.sku.padEnd(13)} ${String(totalStock(p)).padStart(4)}  min ${p.minStock}  ${productStatus(p)}`);

console.log("\nScenario 1 — product creation");
const before = getDashboardKpis(state, { from: new Date(0), to: new Date() }).totalProducts;
state = engine.addProduct(state, { name: "Ergonomic Mouse Pad", sku: "acc-mpd-ergo", category: "Accessories", description: "", unit: "pcs", sellingPrice: 599, costPrice: 260, openingStock: 40, minStock: 10, supplierId: "sup_deskpro" }).state;
check("product appears", !!prod(state, "ACC-MPD-ERGO"));
check("dashboard product count +1", getDashboardKpis(state, { from: new Date(0), to: new Date() }).totalProducts === before + 1);
check("opening stock movement recorded", state.movements[0].type === "Opening" && state.movements[0].quantity === 40);
expectThrow("duplicate SKU rejected (case-insensitive)", () => engine.addProduct(state, { name: "Dup", sku: "ACC-mpd-ergo", category: "Accessories", description: "", unit: "pcs", sellingPrice: 1, costPrice: 1, openingStock: 0, minStock: 0, supplierId: null }), "already used");

console.log("\nScenario 2 — sales workflow");
const kb = prod(state, "PER-KB-087");
const kbBefore = stockOf(state, kb.sku);
const movBefore = state.movements.length;
const r2 = engine.createSale(state, { customerId: "cus_rohan", date: new Date().toISOString(), warehouseId: MAIN, items: [{ productId: kb.id, quantity: 2, unitPrice: kb.sellingPrice }], discountType: "percent", discountValue: 0, taxRate: 18, paymentMethod: "UPI", paymentStatus: "Paid", notes: "" });
state = r2.state;
check("stock decreased by 2", stockOf(state, kb.sku) === kbBefore - 2);
check("invoice appears in sales", state.sales[0].invoiceNo === r2.result.invoiceNo);
check("stock history entry added", state.movements.length === movBefore + 1 && state.movements[0].reference === r2.result.invoiceNo);
check("totals: 2 × 4299 + 18% = 10145.64", r2.result.total === 10145.64, String(r2.result.total));
check("activity recorded", state.activities[0].type === "sale_created");

console.log("\nScenario 3 — insufficient stock");
const snapshot = JSON.stringify(state);
expectThrow("oversell rejected", () => engine.createSale(state, { customerId: "cus_rohan", date: new Date().toISOString(), warehouseId: MAIN, items: [{ productId: kb.id, quantity: 9999, unitPrice: 1 }], discountType: "percent", discountValue: 0, taxRate: 18, paymentMethod: "UPI", paymentStatus: "Paid", notes: "" }), "Available quantity");
expectThrow("duplicate lines summed before availability check", () => engine.createSale(state, { customerId: "cus_rohan", date: new Date().toISOString(), warehouseId: MAIN, items: [{ productId: kb.id, quantity: kb.stock[MAIN] ?? 0, unitPrice: 1 }, { productId: kb.id, quantity: 1, unitPrice: 1 }], discountType: "percent", discountValue: 0, taxRate: 18, paymentMethod: "UPI", paymentStatus: "Paid", notes: "" }), "Available quantity");
check("state unchanged after rejection", JSON.stringify(state) === snapshot);

console.log("\nScenario 4 — purchase workflow");
const ssd = prod(state, "STR-SSD-1TB");
const ssdBefore = stockOf(state, ssd.sku);
const r4 = engine.createPurchase(state, { supplierId: "sup_vertex", orderDate: "2026-11-23", expectedDate: "2026-11-30", warehouseId: MAIN, items: [{ productId: ssd.id, quantity: 10, unitCost: 4600 }], taxRate: 18, notes: "", asDraft: false });
state = r4.state;
check("creating PO does not change stock", stockOf(state, ssd.sku) === ssdBefore);
check("status Pending", r4.result.status === "Pending");
state = engine.receivePurchaseItems(state, { purchaseId: r4.result.id, items: [{ productId: ssd.id, quantity: 10 }] }).state;
check("stock increased by 10 on receipt", stockOf(state, ssd.sku) === ssdBefore + 10);
check("status Received", state.purchases.find((p) => p.id === r4.result.id)!.status === "Received");
expectThrow("cannot receive again", () => engine.receivePurchaseItems(state, { purchaseId: r4.result.id, items: [{ productId: ssd.id, quantity: 1 }] }), "already been fully received");
expectThrow("draft cannot be received", () => {
  const d = engine.createPurchase(state, { supplierId: "sup_vertex", orderDate: "2026-11-23", expectedDate: "2026-11-30", warehouseId: MAIN, items: [{ productId: ssd.id, quantity: 1, unitCost: 1 }], taxRate: 0, notes: "", asDraft: true });
  engine.receivePurchaseItems(d.state, { purchaseId: d.result.id, items: [{ productId: ssd.id, quantity: 1 }] });
}, "draft");

console.log("\nScenario 5 — partial receiving");
const mon = prod(state, "DSP-MON-24F");
const monBefore = stockOf(state, mon.sku);
const r5 = engine.createPurchase(state, { supplierId: "sup_vertex", orderDate: "2026-11-23", expectedDate: "2026-11-30", warehouseId: MAIN, items: [{ productId: mon.id, quantity: 12, unitCost: 8200 }], taxRate: 18, notes: "", asDraft: false });
state = r5.state;
state = engine.receivePurchaseItems(state, { purchaseId: r5.result.id, items: [{ productId: mon.id, quantity: 5 }] }).state;
let po5 = state.purchases.find((p) => p.id === r5.result.id)!;
check("stock +5 only", stockOf(state, mon.sku) === monBefore + 5);
check("status Partially Received", po5.status === "Partially Received");
check("remaining = 7", po5.items[0].quantity - po5.items[0].receivedQty === 7);
expectThrow("over-receiving rejected", () => engine.receivePurchaseItems(state, { purchaseId: r5.result.id, items: [{ productId: mon.id, quantity: 8 }] }), "Only 7 remaining");
state = engine.cancelPurchase(state, r5.result.id).state;
po5 = state.purchases.find((p) => p.id === r5.result.id)!;
check("cancel keeps received stock", stockOf(state, mon.sku) === monBefore + 5 && po5.status === "Cancelled");
expectThrow("cancelled PO cannot be received", () => engine.receivePurchaseItems(state, { purchaseId: r5.result.id, items: [{ productId: mon.id, quantity: 1 }] }), "cancelled");

console.log("\nScenario 6 — sale cancellation restores exactly once");
const kbAfterSale = stockOf(state, kb.sku);
state = engine.cancelSale(state, r2.result.id, "Test").state;
check("stock restored by 2", stockOf(state, kb.sku) === kbAfterSale + 2);
expectThrow("second cancellation rejected", () => engine.cancelSale(state, r2.result.id, "again"), "already cancelled");
check("stock not restored twice", stockOf(state, kb.sku) === kbAfterSale + 2);

console.log("\nScenario 7 — low stock alerts");
const hdmi = prod(state, "CBL-HDM-2M");
const lowBefore = getLowStockProducts(state).length;
const mainQty = hdmi.stock[MAIN];
const retailQty = hdmi.stock[RETAIL];
state = engine.adjustStock(state, { productId: hdmi.id, warehouseId: MAIN, direction: "decrease", quantity: mainQty, reason: "Stock count correction", notes: "" }).state;
state = engine.adjustStock(state, { productId: hdmi.id, warehouseId: RETAIL, direction: "decrease", quantity: retailQty - 10, reason: "Stock count correction", notes: "" }).state;
check("HDMI now low stock", productStatus(prod(state, hdmi.sku)) === "Low Stock");
check("dashboard low-stock list grows", getLowStockProducts(state).length === lowBefore + 1);
expectThrow("negative adjustment rejected", () => engine.adjustStock(state, { productId: hdmi.id, warehouseId: MAIN, direction: "decrease", quantity: 1, reason: "Other", notes: "" }), "Available quantity: 0");

console.log("\nScenario 8 — persistence round-trip");
const roundTrip = JSON.parse(JSON.stringify(state)) as InventoryState;
check("state survives JSON serialisation", JSON.stringify(roundTrip) === JSON.stringify(state));

console.log("\nScenario 9 — reports use transaction data");
const kpis = getDashboardKpis(state, { from: new Date(0), to: new Date(Date.now() + 1000) });
const manualRevenue = state.sales.filter((s) => s.status !== "Cancelled").reduce((s, x) => s + x.total, 0);
check("sales total equals sum of non-cancelled invoices", Math.abs(kpis.totalSales - manualRevenue) < 0.01);

console.log("\nScenario 10 — transfers");
const wm = prod(state, "PER-WM-235");
const [m0, r0] = [wm.stock[MAIN], wm.stock[RETAIL]];
state = engine.createTransfer(state, { productId: wm.id, quantity: 5, fromWarehouseId: MAIN, toWarehouseId: RETAIL, completeNow: true, notes: "" }).state;
check("main −5, retail +5", prod(state, wm.sku).stock[MAIN] === m0 - 5 && prod(state, wm.sku).stock[RETAIL] === r0 + 5);
expectThrow("same-warehouse transfer rejected", () => engine.createTransfer(state, { productId: wm.id, quantity: 1, fromWarehouseId: MAIN, toWarehouseId: MAIN, completeNow: true, notes: "" }), "different");
expectThrow("over-transfer rejected", () => engine.createTransfer(state, { productId: wm.id, quantity: 99999, fromWarehouseId: MAIN, toWarehouseId: RETAIL, completeNow: true, notes: "" }), "Available quantity");
const t = engine.createTransfer(state, { productId: wm.id, quantity: 3, fromWarehouseId: MAIN, toWarehouseId: RETAIL, completeNow: false, notes: "" });
state = t.state;
check("in-transit deducts source only", prod(state, wm.sku).stock[MAIN] === m0 - 8 && prod(state, wm.sku).stock[RETAIL] === r0 + 5);
state = engine.completeTransfer(state, t.result.id).state;
check("completion adds to destination", prod(state, wm.sku).stock[RETAIL] === r0 + 8);
expectThrow("cannot complete twice", () => engine.completeTransfer(state, t.result.id), "not in transit");

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
