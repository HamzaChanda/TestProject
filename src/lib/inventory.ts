/**
 * StockFlow transaction engine.
 *
 * Every function here is pure: it receives the current state, validates the
 * request, and returns a NEW state (plus the created record). Nothing in the
 * UI mutates stock directly — the React context simply calls these functions
 * and persists the result.
 *
 * Atomicity: each operation works on a structured clone. If validation fails
 * at any point an InventoryError is thrown and the original state is untouched.
 */
import type {
  Activity,
  ActivityType,
  AdjustmentInput,
  BusinessSettings,
  Customer,
  CustomerInput,
  ID,
  InventoryState,
  MovementType,
  Product,
  ProductInput,
  ProductUpdateInput,
  Purchase,
  PurchaseInput,
  ReceiveInput,
  Sale,
  SaleInput,
  Supplier,
  SupplierInput,
  Transfer,
  TransferInput,
  Warehouse,
} from "@/types";
import { computePurchaseTotals, computeSaleTotals, lineTotal, totalStock } from "./calc";
import { pad, round2, uid } from "./utils";

export class InventoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryError";
  }
}

export interface TxContext {
  /** Timestamp to record the transaction at (used by the seed replay). */
  now?: string;
}

export interface TxResult<T = true> {
  state: InventoryState;
  result: T;
}

const MAX_ACTIVITIES = 250;

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

function draftOf(state: InventoryState): InventoryState {
  return structuredClone(state);
}

function nowOf(ctx?: TxContext) {
  return ctx?.now ?? new Date().toISOString();
}

function fail(message: string): never {
  throw new InventoryError(message);
}

function assertPositiveInt(value: number, label: string) {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    fail(`${label} must be a whole number greater than 0.`);
  }
}

function findProduct(draft: InventoryState, id: ID): Product {
  return draft.products.find((p) => p.id === id) ?? fail("Product not found. It may have been deleted.");
}

function findWarehouse(draft: InventoryState, id: ID): Warehouse {
  return draft.warehouses.find((w) => w.id === id) ?? fail("Warehouse not found.");
}

function pushActivity(
  draft: InventoryState,
  type: ActivityType,
  title: string,
  description: string,
  at: string,
  reference: string | null = null,
  href: string | null = null,
) {
  const activity: Activity = { id: uid("act"), type, title, description, reference, href, date: at };
  draft.activities.unshift(activity);
  if (draft.activities.length > MAX_ACTIVITIES) draft.activities.length = MAX_ACTIVITIES;
}

/**
 * The single low-level stock mutation. Applies a signed delta to one
 * product in one warehouse and records the matching stock movement.
 * Refuses any change that would make stock negative.
 */
function applyStockChange(
  draft: InventoryState,
  args: {
    productId: ID;
    warehouseId: ID;
    delta: number;
    type: MovementType;
    reference: string;
    note: string;
    at: string;
  },
) {
  const product = findProduct(draft, args.productId);
  const warehouse = findWarehouse(draft, args.warehouseId);
  const current = product.stock[warehouse.id] ?? 0;
  const next = current + args.delta;
  if (next < 0) {
    fail(
      `Insufficient stock for ${product.name} in ${warehouse.name}. Available quantity: ${current}.`,
    );
  }
  const previousTotal = totalStock(product);
  product.stock = { ...product.stock, [warehouse.id]: next };
  product.updatedAt = args.at;
  draft.movements.unshift({
    id: uid("mov"),
    date: args.at,
    productId: product.id,
    productName: product.name,
    sku: product.sku,
    warehouseId: warehouse.id,
    type: args.type,
    reference: args.reference,
    quantity: args.delta,
    previousStock: previousTotal,
    newStock: previousTotal + args.delta,
    note: args.note,
  });
}

function year(at: string) {
  return new Date(at).getFullYear();
}

/** Merge duplicate product lines so availability is checked on the true total. */
function mergeLines<T extends { productId: ID; quantity: number }>(lines: T[]): T[] {
  const map = new Map<ID, T>();
  for (const line of lines) {
    const existing = map.get(line.productId);
    if (existing) existing.quantity += line.quantity;
    else map.set(line.productId, { ...line });
  }
  return [...map.values()];
}

/* ------------------------------------------------------------------ */
/*  Products                                                           */
/* ------------------------------------------------------------------ */

function validateProductFields(draft: InventoryState, input: ProductUpdateInput, selfId?: ID) {
  if (!input.name.trim()) fail("Product name is required.");
  const sku = input.sku.trim().toUpperCase();
  if (!sku) fail("SKU is required.");
  if (draft.products.some((p) => p.sku.toUpperCase() === sku && p.id !== selfId)) {
    fail(`SKU "${sku}" is already used by another product.`);
  }
  if (input.sellingPrice < 0 || input.costPrice < 0) fail("Prices cannot be negative.");
  if (!Number.isInteger(input.minStock) || input.minStock < 0) {
    fail("Minimum stock must be a whole number of 0 or more.");
  }
  if (input.supplierId && !draft.suppliers.some((s) => s.id === input.supplierId)) {
    fail("Selected supplier no longer exists.");
  }
  return sku;
}

export function addProduct(
  state: InventoryState,
  input: ProductInput,
  ctx?: TxContext,
): TxResult<Product> {
  const draft = draftOf(state);
  const at = nowOf(ctx);
  const sku = validateProductFields(draft, input);
  if (!Number.isInteger(input.openingStock) || input.openingStock < 0) {
    fail("Opening stock must be a whole number of 0 or more.");
  }
  const warehouseId =
    input.warehouseId ?? draft.warehouses.find((w) => w.isDefault)?.id ?? draft.warehouses[0]?.id;
  if (!warehouseId) fail("Create a warehouse before adding products.");

  const product: Product = {
    id: uid("prd"),
    name: input.name.trim(),
    sku,
    category: input.category,
    description: input.description.trim(),
    unit: input.unit,
    sellingPrice: round2(input.sellingPrice),
    costPrice: round2(input.costPrice),
    minStock: input.minStock,
    supplierId: input.supplierId || null,
    stock: Object.fromEntries(draft.warehouses.map((w) => [w.id, 0])),
    createdAt: at,
    updatedAt: at,
  };
  draft.products.unshift(product);

  if (input.openingStock > 0) {
    applyStockChange(draft, {
      productId: product.id,
      warehouseId,
      delta: input.openingStock,
      type: "Opening",
      reference: "OPENING",
      note: "Opening stock",
      at,
    });
  }
  pushActivity(
    draft,
    "product_added",
    "Product added",
    `${product.name} added with ${input.openingStock} ${product.unit} opening stock`,
    at,
    product.sku,
    `/products/${product.id}`,
  );
  return { state: draft, result: findProduct(draft, product.id) };
}

export function updateProduct(
  state: InventoryState,
  id: ID,
  input: ProductUpdateInput,
  ctx?: TxContext,
): TxResult<Product> {
  const draft = draftOf(state);
  const at = nowOf(ctx);
  const product = findProduct(draft, id);
  const sku = validateProductFields(draft, input, id);
  Object.assign(product, {
    name: input.name.trim(),
    sku,
    category: input.category,
    description: input.description.trim(),
    unit: input.unit,
    sellingPrice: round2(input.sellingPrice),
    costPrice: round2(input.costPrice),
    minStock: input.minStock,
    supplierId: input.supplierId || null,
    updatedAt: at,
  });
  pushActivity(draft, "product_updated", "Product updated", `${product.name} details were updated`, at, product.sku, `/products/${id}`);
  return { state: draft, result: product };
}

/* Deletion guards — shared by the engine and the UI so both always agree. */

export function productDeleteBlocker(state: InventoryState, id: ID): string | null {
  const product = state.products.find((p) => p.id === id);
  if (!product) return "Product not found.";
  const openPo = state.purchases.find(
    (p) =>
      (p.status === "Pending" || p.status === "Partially Received" || p.status === "Draft") &&
      p.items.some((i) => i.productId === id),
  );
  if (openPo) return `${product.name} is on open purchase order ${openPo.poNumber}. Receive or cancel that order first.`;
  const transit = state.transfers.find((t) => t.productId === id && t.status === "In Transit");
  if (transit) return `${product.name} has an in-transit transfer (${transit.reference}). Receive or cancel it first.`;
  return null;
}

export function customerDeleteBlocker(state: InventoryState, id: ID): string | null {
  const c = state.customers.find((x) => x.id === id);
  if (!c) return "Customer not found.";
  const count = state.sales.filter((s) => s.customerId === id).length;
  return count > 0 ? `${c.name} has ${count} invoice${count === 1 ? "" : "s"}. Customers with sales history are kept so your records stay accurate.` : null;
}

export function supplierDeleteBlocker(state: InventoryState, id: ID): string | null {
  const s = state.suppliers.find((x) => x.id === id);
  if (!s) return "Supplier not found.";
  const count = state.purchases.filter((p) => p.supplierId === id).length;
  return count > 0 ? `${s.name} has ${count} purchase order${count === 1 ? "" : "s"}. Suppliers with purchase history are kept so your records stay accurate.` : null;
}

export function deleteProduct(state: InventoryState, id: ID, ctx?: TxContext): TxResult {
  const blocker = productDeleteBlocker(state, id);
  if (blocker) fail(blocker);
  const draft = draftOf(state);
  const product = findProduct(draft, id);

  draft.products = draft.products.filter((p) => p.id !== id);
  pushActivity(draft, "product_deleted", "Product deleted", `${product.name} (${product.sku}) was removed from the catalogue`, nowOf(ctx), product.sku);
  return { state: draft, result: true };
}

/* ------------------------------------------------------------------ */
/*  Sales                                                              */
/* ------------------------------------------------------------------ */

export function createSale(state: InventoryState, input: SaleInput, ctx?: TxContext): TxResult<Sale> {
  const draft = draftOf(state);
  const at = nowOf(ctx);
  const customer =
    draft.customers.find((c) => c.id === input.customerId) ?? fail("Please select a valid customer.");
  const warehouse = findWarehouse(draft, input.warehouseId);
  if (input.items.length === 0) fail("Add at least one product to the sale.");

  const lines = mergeLines(input.items);
  // Validate everything before touching stock.
  for (const line of lines) {
    const product = findProduct(draft, line.productId);
    assertPositiveInt(line.quantity, `Quantity for ${product.name}`);
    if (line.unitPrice < 0) fail(`Unit price for ${product.name} cannot be negative.`);
    const available = product.stock[warehouse.id] ?? 0;
    if (line.quantity > available) {
      fail(`Insufficient stock for ${product.name}. Available quantity: ${available}.`);
    }
  }

  const totals = computeSaleTotals(
    lines.map((l) => ({ quantity: l.quantity, price: l.unitPrice })),
    input.discountType,
    input.discountValue,
    input.taxRate,
  );

  let amountPaid = 0;
  if (input.paymentStatus === "Paid") amountPaid = totals.total;
  else if (input.paymentStatus === "Partial") {
    amountPaid = round2(input.amountPaid ?? 0);
    if (amountPaid <= 0 || amountPaid >= totals.total) {
      fail("For a partial payment, the amount paid must be more than 0 and less than the grand total.");
    }
  }

  draft.counters.sale += 1;
  const invoiceNo = `${draft.settings.invoicePrefix}-${year(at)}-${pad(draft.counters.sale)}`;

  const sale: Sale = {
    id: uid("sal"),
    invoiceNo,
    customerId: customer.id,
    customerName: customer.name,
    date: input.date,
    warehouseId: warehouse.id,
    items: lines.map((l) => {
      const p = findProduct(draft, l.productId);
      return {
        productId: p.id,
        name: p.name,
        sku: p.sku,
        unit: p.unit,
        quantity: l.quantity,
        unitPrice: round2(l.unitPrice),
        total: lineTotal(l.quantity, l.unitPrice),
      };
    }),
    subtotal: totals.subtotal,
    discountType: input.discountType,
    discountValue: input.discountValue || 0,
    discountAmount: totals.discountAmount,
    taxRate: input.taxRate,
    taxAmount: totals.taxAmount,
    total: totals.total,
    paymentMethod: input.paymentMethod,
    paymentStatus: input.paymentStatus,
    amountPaid,
    status: input.status ?? "Completed",
    notes: input.notes.trim(),
    createdAt: at,
    cancelledAt: null,
    cancelReason: null,
  };

  for (const item of sale.items) {
    applyStockChange(draft, {
      productId: item.productId,
      warehouseId: warehouse.id,
      delta: -item.quantity,
      type: "Sale",
      reference: invoiceNo,
      note: `Sold to ${customer.name}`,
      at,
    });
  }

  draft.sales.unshift(sale);
  const units = sale.items.reduce((s, i) => s + i.quantity, 0);
  pushActivity(
    draft,
    "sale_created",
    "New sale created",
    `${customer.name} · ${units} unit${units === 1 ? "" : "s"} across ${sale.items.length} product${sale.items.length === 1 ? "" : "s"}`,
    at,
    invoiceNo,
    `/sales/${sale.id}`,
  );
  return { state: draft, result: sale };
}

export function cancelSale(
  state: InventoryState,
  saleId: ID,
  reason: string,
  ctx?: TxContext,
): TxResult<Sale> {
  const draft = draftOf(state);
  const at = nowOf(ctx);
  const sale = draft.sales.find((s) => s.id === saleId) ?? fail("Invoice not found.");
  // Guard: stock can only ever be restored once.
  if (sale.status === "Cancelled" || sale.cancelledAt) fail(`${sale.invoiceNo} is already cancelled.`);

  for (const item of sale.items) {
    if (!draft.products.some((p) => p.id === item.productId)) continue; // product deleted since
    applyStockChange(draft, {
      productId: item.productId,
      warehouseId: sale.warehouseId,
      delta: item.quantity,
      type: "Sale Cancellation",
      reference: sale.invoiceNo,
      note: reason ? `Sale cancelled — ${reason}` : "Sale cancelled — stock restored",
      at,
    });
  }
  sale.status = "Cancelled";
  sale.cancelledAt = at;
  sale.cancelReason = reason || null;
  pushActivity(draft, "sale_cancelled", "Sale cancelled", `${sale.customerName} · stock restored for ${sale.items.length} product${sale.items.length === 1 ? "" : "s"}`, at, sale.invoiceNo, `/sales/${sale.id}`);
  return { state: draft, result: sale };
}

export function completeSale(state: InventoryState, saleId: ID, ctx?: TxContext): TxResult<Sale> {
  const draft = draftOf(state);
  const sale = draft.sales.find((s) => s.id === saleId) ?? fail("Invoice not found.");
  if (sale.status !== "Pending") fail(`Only pending sales can be marked as completed.`);
  sale.status = "Completed";
  pushActivity(draft, "sale_completed", "Sale completed", `${sale.customerName} order fulfilled`, nowOf(ctx), sale.invoiceNo, `/sales/${sale.id}`);
  return { state: draft, result: sale };
}

export function recordPayment(
  state: InventoryState,
  saleId: ID,
  amount: number,
  ctx?: TxContext,
): TxResult<Sale> {
  const draft = draftOf(state);
  const sale = draft.sales.find((s) => s.id === saleId) ?? fail("Invoice not found.");
  if (sale.status === "Cancelled") fail("Cannot record a payment on a cancelled invoice.");
  const due = round2(sale.total - sale.amountPaid);
  if (due <= 0) fail("This invoice is already fully paid.");
  if (!(amount > 0)) fail("Payment amount must be greater than 0.");
  if (round2(amount) > due) fail(`Payment exceeds the balance due.`);
  sale.amountPaid = round2(sale.amountPaid + amount);
  sale.paymentStatus = sale.amountPaid >= sale.total ? "Paid" : "Partial";
  pushActivity(draft, "payment_recorded", "Payment received", `${sale.customerName} paid against ${sale.invoiceNo}`, nowOf(ctx), sale.invoiceNo, `/sales/${sale.id}`);
  return { state: draft, result: sale };
}

/* ------------------------------------------------------------------ */
/*  Purchases                                                          */
/* ------------------------------------------------------------------ */

export function createPurchase(
  state: InventoryState,
  input: PurchaseInput,
  ctx?: TxContext,
): TxResult<Purchase> {
  const draft = draftOf(state);
  const at = nowOf(ctx);
  const supplier =
    draft.suppliers.find((s) => s.id === input.supplierId) ?? fail("Please select a valid supplier.");
  const warehouse = findWarehouse(draft, input.warehouseId);
  if (input.items.length === 0) fail("Add at least one product to the purchase order.");
  if (input.expectedDate && input.expectedDate < input.orderDate) {
    fail("Expected delivery cannot be before the order date.");
  }
  const lines = mergeLines(input.items);
  for (const line of lines) {
    const p = findProduct(draft, line.productId);
    assertPositiveInt(line.quantity, `Quantity for ${p.name}`);
    if (line.unitCost < 0) fail(`Purchase price for ${p.name} cannot be negative.`);
  }
  const totals = computePurchaseTotals(
    lines.map((l) => ({ quantity: l.quantity, price: l.unitCost })),
    input.taxRate,
  );

  draft.counters.purchase += 1;
  const poNumber = `${draft.settings.purchasePrefix}-${year(at)}-${pad(draft.counters.purchase)}`;
  const purchase: Purchase = {
    id: uid("pur"),
    poNumber,
    supplierId: supplier.id,
    supplierName: supplier.name,
    orderDate: input.orderDate,
    expectedDate: input.expectedDate,
    warehouseId: warehouse.id,
    items: lines.map((l) => {
      const p = findProduct(draft, l.productId);
      return {
        productId: p.id,
        name: p.name,
        sku: p.sku,
        unit: p.unit,
        quantity: l.quantity,
        receivedQty: 0,
        unitCost: round2(l.unitCost),
        total: lineTotal(l.quantity, l.unitCost),
      };
    }),
    ...totals,
    taxRate: input.taxRate,
    status: input.asDraft ? "Draft" : "Pending",
    notes: input.notes.trim(),
    receipts: [],
    createdAt: at,
    cancelledAt: null,
  };
  // NOTE: creating a purchase never touches stock. Stock moves on receipt only.
  draft.purchases.unshift(purchase);
  pushActivity(
    draft,
    "purchase_created",
    input.asDraft ? "Purchase draft saved" : "Purchase order created",
    `${supplier.name} · ${purchase.items.length} product${purchase.items.length === 1 ? "" : "s"}`,
    at,
    poNumber,
    `/purchases/${purchase.id}`,
  );
  return { state: draft, result: purchase };
}

export function placePurchaseOrder(state: InventoryState, id: ID, ctx?: TxContext): TxResult<Purchase> {
  const draft = draftOf(state);
  const po = draft.purchases.find((p) => p.id === id) ?? fail("Purchase order not found.");
  if (po.status !== "Draft") fail("Only drafts can be placed as orders.");
  po.status = "Pending";
  pushActivity(draft, "purchase_created", "Purchase order placed", `${po.supplierName} · draft converted to order`, nowOf(ctx), po.poNumber, `/purchases/${po.id}`);
  return { state: draft, result: po };
}

export function deletePurchaseDraft(state: InventoryState, id: ID): TxResult {
  const draft = draftOf(state);
  const po = draft.purchases.find((p) => p.id === id) ?? fail("Purchase order not found.");
  if (po.status !== "Draft") fail("Only drafts can be deleted. Cancel the order instead.");
  draft.purchases = draft.purchases.filter((p) => p.id !== id);
  return { state: draft, result: true };
}

export function receivePurchaseItems(
  state: InventoryState,
  input: ReceiveInput,
  ctx?: TxContext,
): TxResult<Purchase> {
  const draft = draftOf(state);
  const at = nowOf(ctx);
  const po = draft.purchases.find((p) => p.id === input.purchaseId) ?? fail("Purchase order not found.");
  if (po.status === "Draft") fail("Place this draft as an order before receiving stock.");
  if (po.status === "Received") fail(`${po.poNumber} has already been fully received.`);
  if (po.status === "Cancelled") fail(`${po.poNumber} is cancelled and cannot be received.`);

  const lines = input.items.filter((l) => l.quantity !== 0);
  if (lines.length === 0) fail("Enter a quantity to receive for at least one product.");

  for (const line of lines) {
    const item = po.items.find((i) => i.productId === line.productId) ?? fail("Item is not on this purchase order.");
    assertPositiveInt(line.quantity, `Received quantity for ${item.name}`);
    const remaining = item.quantity - item.receivedQty;
    if (line.quantity > remaining) {
      fail(`Cannot receive ${line.quantity} × ${item.name}. Only ${remaining} remaining on this order.`);
    }
    findProduct(draft, item.productId); // product must still exist
  }

  draft.counters.receipt += 1;
  const grn = `GRN-${pad(draft.counters.receipt)}`;
  for (const line of lines) {
    const item = po.items.find((i) => i.productId === line.productId)!;
    item.receivedQty += line.quantity;
    applyStockChange(draft, {
      productId: item.productId,
      warehouseId: po.warehouseId,
      delta: line.quantity,
      type: "Purchase",
      reference: po.poNumber,
      note: `Received from ${po.supplierName} (${grn})`,
      at,
    });
  }
  po.receipts.push({ id: uid("rcp"), reference: grn, date: input.date ?? at, items: lines, note: input.note ?? "" });
  const fully = po.items.every((i) => i.receivedQty >= i.quantity);
  po.status = fully ? "Received" : "Partially Received";
  const units = lines.reduce((s, l) => s + l.quantity, 0);
  pushActivity(
    draft,
    "purchase_received",
    fully ? "Purchase received" : "Purchase partially received",
    `${units} unit${units === 1 ? "" : "s"} received from ${po.supplierName}`,
    at,
    po.poNumber,
    `/purchases/${po.id}`,
  );
  return { state: draft, result: po };
}

export function cancelPurchase(state: InventoryState, id: ID, ctx?: TxContext): TxResult<Purchase> {
  const draft = draftOf(state);
  const at = nowOf(ctx);
  const po = draft.purchases.find((p) => p.id === id) ?? fail("Purchase order not found.");
  if (po.status === "Cancelled") fail(`${po.poNumber} is already cancelled.`);
  if (po.status === "Received") fail(`${po.poNumber} is fully received and cannot be cancelled.`);
  // Already-received quantities stay in stock; unreceived quantities are simply closed.
  po.status = "Cancelled";
  po.cancelledAt = at;
  const received = po.items.reduce((s, i) => s + i.receivedQty, 0);
  pushActivity(
    draft,
    "purchase_cancelled",
    "Purchase order cancelled",
    received > 0 ? `${po.supplierName} · ${received} received units retained in stock` : `${po.supplierName} · no stock was affected`,
    at,
    po.poNumber,
    `/purchases/${po.id}`,
  );
  return { state: draft, result: po };
}

/* ------------------------------------------------------------------ */
/*  Stock adjustments & transfers                                      */
/* ------------------------------------------------------------------ */

export function adjustStock(state: InventoryState, input: AdjustmentInput, ctx?: TxContext): TxResult<string> {
  const draft = draftOf(state);
  const at = nowOf(ctx);
  const product = findProduct(draft, input.productId);
  const warehouse = findWarehouse(draft, input.warehouseId);
  assertPositiveInt(input.quantity, "Adjustment quantity");
  if (!input.reason) fail("Please choose a reason for the adjustment.");
  const delta = input.direction === "increase" ? input.quantity : -input.quantity;
  draft.counters.adjustment += 1;
  const reference = `ADJ-${pad(draft.counters.adjustment)}`;
  applyStockChange(draft, {
    productId: product.id,
    warehouseId: warehouse.id,
    delta,
    type: "Adjustment",
    reference,
    note: [input.reason, input.notes.trim()].filter(Boolean).join(" — "),
    at,
  });
  pushActivity(
    draft,
    "stock_adjusted",
    "Stock adjusted",
    `${product.name} ${delta > 0 ? "+" : "−"}${input.quantity} in ${warehouse.name} · ${input.reason}`,
    at,
    reference,
    `/products/${product.id}`,
  );
  return { state: draft, result: reference };
}

export function createTransfer(state: InventoryState, input: TransferInput, ctx?: TxContext): TxResult<Transfer> {
  const draft = draftOf(state);
  const at = nowOf(ctx);
  const product = findProduct(draft, input.productId);
  const from = findWarehouse(draft, input.fromWarehouseId);
  const to = findWarehouse(draft, input.toWarehouseId);
  if (from.id === to.id) fail("Source and destination warehouse must be different.");
  assertPositiveInt(input.quantity, "Transfer quantity");
  const available = product.stock[from.id] ?? 0;
  if (input.quantity > available) {
    fail(`Insufficient stock in ${from.name}. Available quantity: ${available}.`);
  }
  draft.counters.transfer += 1;
  const reference = `TRF-${pad(draft.counters.transfer)}`;
  applyStockChange(draft, {
    productId: product.id,
    warehouseId: from.id,
    delta: -input.quantity,
    type: "Transfer",
    reference,
    note: `Transfer out to ${to.name}`,
    at,
  });
  if (input.completeNow) {
    applyStockChange(draft, {
      productId: product.id,
      warehouseId: to.id,
      delta: input.quantity,
      type: "Transfer",
      reference,
      note: `Transfer in from ${from.name}`,
      at,
    });
  }
  const transfer: Transfer = {
    id: uid("trf"),
    reference,
    productId: product.id,
    productName: product.name,
    sku: product.sku,
    quantity: input.quantity,
    fromWarehouseId: from.id,
    toWarehouseId: to.id,
    status: input.completeNow ? "Completed" : "In Transit",
    date: input.date ?? at,
    completedAt: input.completeNow ? at : null,
    notes: input.notes.trim(),
  };
  draft.transfers.unshift(transfer);
  pushActivity(
    draft,
    input.completeNow ? "transfer_completed" : "transfer_created",
    input.completeNow ? "Stock transferred" : "Transfer dispatched",
    `${input.quantity} × ${product.name} · ${from.name} → ${to.name}`,
    at,
    reference,
    `/transfers`,
  );
  return { state: draft, result: transfer };
}

export function completeTransfer(state: InventoryState, id: ID, ctx?: TxContext): TxResult<Transfer> {
  const draft = draftOf(state);
  const at = nowOf(ctx);
  const t = draft.transfers.find((x) => x.id === id) ?? fail("Transfer not found.");
  if (t.status !== "In Transit") fail(`${t.reference} is not in transit.`);
  const from = findWarehouse(draft, t.fromWarehouseId);
  applyStockChange(draft, {
    productId: t.productId,
    warehouseId: t.toWarehouseId,
    delta: t.quantity,
    type: "Transfer",
    reference: t.reference,
    note: `Transfer in from ${from.name}`,
    at,
  });
  t.status = "Completed";
  t.completedAt = at;
  pushActivity(draft, "transfer_completed", "Transfer received", `${t.quantity} × ${t.productName} arrived`, at, t.reference, "/transfers");
  return { state: draft, result: t };
}

export function cancelTransfer(state: InventoryState, id: ID, ctx?: TxContext): TxResult<Transfer> {
  const draft = draftOf(state);
  const at = nowOf(ctx);
  const t = draft.transfers.find((x) => x.id === id) ?? fail("Transfer not found.");
  if (t.status !== "In Transit") fail("Only in-transit transfers can be cancelled.");
  applyStockChange(draft, {
    productId: t.productId,
    warehouseId: t.fromWarehouseId,
    delta: t.quantity,
    type: "Transfer",
    reference: t.reference,
    note: "Transfer cancelled — returned to source",
    at,
  });
  t.status = "Cancelled";
  pushActivity(draft, "transfer_cancelled", "Transfer cancelled", `${t.quantity} × ${t.productName} returned to source`, at, t.reference, "/transfers");
  return { state: draft, result: t };
}

/* ------------------------------------------------------------------ */
/*  Customers & suppliers                                              */
/* ------------------------------------------------------------------ */

function assertUniqueEmail(list: { id: ID; email: string }[], email: string, selfId?: ID) {
  const e = email.trim().toLowerCase();
  if (e && list.some((x) => x.email.toLowerCase() === e && x.id !== selfId)) {
    fail(`The email ${email} is already in use.`);
  }
}

export function addCustomer(state: InventoryState, input: CustomerInput, ctx?: TxContext): TxResult<Customer> {
  const draft = draftOf(state);
  const at = nowOf(ctx);
  if (!input.name.trim()) fail("Customer name is required.");
  assertUniqueEmail(draft.customers, input.email);
  const customer: Customer = { ...input, name: input.name.trim(), id: uid("cus"), createdAt: at };
  draft.customers.unshift(customer);
  pushActivity(draft, "customer_added", "Customer added", customer.name, at, null, `/customers/${customer.id}`);
  return { state: draft, result: customer };
}

export function updateCustomer(state: InventoryState, id: ID, input: CustomerInput): TxResult<Customer> {
  const draft = draftOf(state);
  const c = draft.customers.find((x) => x.id === id) ?? fail("Customer not found.");
  if (!input.name.trim()) fail("Customer name is required.");
  assertUniqueEmail(draft.customers, input.email, id);
  Object.assign(c, input, { name: input.name.trim() });
  // Keep invoice snapshots readable.
  draft.sales.forEach((s) => {
    if (s.customerId === id) s.customerName = c.name;
  });
  return { state: draft, result: c };
}

export function deleteCustomer(state: InventoryState, id: ID): TxResult {
  const draft = draftOf(state);
  const blocker = customerDeleteBlocker(draft, id);
  if (blocker) fail(blocker);
  draft.customers = draft.customers.filter((x) => x.id !== id);
  return { state: draft, result: true };
}

export function addSupplier(state: InventoryState, input: SupplierInput, ctx?: TxContext): TxResult<Supplier> {
  const draft = draftOf(state);
  const at = nowOf(ctx);
  if (!input.name.trim()) fail("Supplier name is required.");
  assertUniqueEmail(draft.suppliers, input.email);
  const supplier: Supplier = { ...input, name: input.name.trim(), id: uid("sup"), createdAt: at };
  draft.suppliers.unshift(supplier);
  pushActivity(draft, "supplier_added", "Supplier added", supplier.name, at, null, `/suppliers/${supplier.id}`);
  return { state: draft, result: supplier };
}

export function updateSupplier(state: InventoryState, id: ID, input: SupplierInput): TxResult<Supplier> {
  const draft = draftOf(state);
  const s = draft.suppliers.find((x) => x.id === id) ?? fail("Supplier not found.");
  if (!input.name.trim()) fail("Supplier name is required.");
  assertUniqueEmail(draft.suppliers, input.email, id);
  Object.assign(s, input, { name: input.name.trim() });
  draft.purchases.forEach((p) => {
    if (p.supplierId === id) p.supplierName = s.name;
  });
  return { state: draft, result: s };
}

export function deleteSupplier(state: InventoryState, id: ID): TxResult {
  const draft = draftOf(state);
  const blocker = supplierDeleteBlocker(draft, id);
  if (blocker) fail(blocker);
  draft.suppliers = draft.suppliers.filter((x) => x.id !== id);
  draft.products.forEach((p) => {
    if (p.supplierId === id) p.supplierId = null;
  });
  return { state: draft, result: true };
}

/* ------------------------------------------------------------------ */
/*  Settings                                                           */
/* ------------------------------------------------------------------ */

export function updateSettings(
  state: InventoryState,
  patch: Partial<BusinessSettings>,
  ctx?: TxContext,
): TxResult<BusinessSettings> {
  const draft = draftOf(state);
  const next = { ...draft.settings, ...patch };
  if (!next.businessName.trim()) fail("Business name is required.");
  if (!(next.defaultTaxRate >= 0 && next.defaultTaxRate <= 100)) fail("Tax rate must be between 0 and 100.");
  draft.settings = next;
  pushActivity(draft, "settings_updated", "Settings updated", "Business configuration changed", nowOf(ctx));
  return { state: draft, result: next };
}

export function updateWarehouse(
  state: InventoryState,
  id: ID,
  patch: Pick<Warehouse, "name" | "location" | "code">,
): TxResult<Warehouse> {
  const draft = draftOf(state);
  const w = findWarehouse(draft, id);
  if (!patch.name.trim()) fail("Warehouse name is required.");
  if (draft.warehouses.some((x) => x.id !== id && x.name.toLowerCase() === patch.name.trim().toLowerCase())) {
    fail("Another warehouse already uses that name.");
  }
  Object.assign(w, { ...patch, name: patch.name.trim() });
  return { state: draft, result: w };
}

export function setDefaultWarehouse(state: InventoryState, id: ID): TxResult {
  const draft = draftOf(state);
  findWarehouse(draft, id);
  draft.warehouses.forEach((w) => (w.isDefault = w.id === id));
  return { state: draft, result: true };
}
