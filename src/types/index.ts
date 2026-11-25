/* ------------------------------------------------------------------ */
/*  StockFlow domain model                                             */
/* ------------------------------------------------------------------ */

export type ID = string;

export type StockStatus = "In Stock" | "Low Stock" | "Out of Stock";

export interface Product {
  id: ID;
  name: string;
  sku: string;
  category: string;
  description: string;
  unit: string;
  sellingPrice: number;
  costPrice: number;
  minStock: number;
  supplierId: ID | null;
  /** Quantity on hand per warehouse id. Total stock = sum of values. */
  stock: Record<ID, number>;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: ID;
  name: string;
  company: string;
  email: string;
  phone: string;
  city: string;
  address: string;
  gstin: string;
  createdAt: string;
}

export interface Supplier {
  id: ID;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  city: string;
  address: string;
  gstin: string;
  paymentTerms: string;
  createdAt: string;
}

export type PaymentStatus = "Paid" | "Partial" | "Unpaid";
export type PaymentMethod = "Cash" | "UPI" | "Card" | "Bank Transfer" | "Credit";
export type SaleStatus = "Completed" | "Pending" | "Cancelled";
export type DiscountType = "percent" | "amount";

export interface SaleItem {
  productId: ID;
  name: string;
  sku: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Sale {
  id: ID;
  invoiceNo: string;
  customerId: ID;
  customerName: string;
  date: string;
  warehouseId: ID;
  items: SaleItem[];
  subtotal: number;
  discountType: DiscountType;
  discountValue: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  amountPaid: number;
  status: SaleStatus;
  notes: string;
  createdAt: string;
  cancelledAt: string | null;
  cancelReason: string | null;
}

export type PurchaseStatus =
  | "Draft"
  | "Pending"
  | "Partially Received"
  | "Received"
  | "Cancelled";

export interface PurchaseItem {
  productId: ID;
  name: string;
  sku: string;
  unit: string;
  quantity: number;
  receivedQty: number;
  unitCost: number;
  total: number;
}

export interface PurchaseReceipt {
  id: ID;
  reference: string;
  date: string;
  items: { productId: ID; quantity: number }[];
  note: string;
}

export interface Purchase {
  id: ID;
  poNumber: string;
  supplierId: ID;
  supplierName: string;
  orderDate: string;
  expectedDate: string;
  warehouseId: ID;
  items: PurchaseItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  status: PurchaseStatus;
  notes: string;
  receipts: PurchaseReceipt[];
  createdAt: string;
  cancelledAt: string | null;
}

export type MovementType =
  | "Opening"
  | "Purchase"
  | "Sale"
  | "Sale Cancellation"
  | "Adjustment"
  | "Transfer";

export interface StockMovement {
  id: ID;
  date: string;
  productId: ID;
  productName: string;
  sku: string;
  warehouseId: ID;
  type: MovementType;
  reference: string;
  /** Signed quantity change (+ in, − out). */
  quantity: number;
  /** Product total stock (all warehouses) before and after the movement. */
  previousStock: number;
  newStock: number;
  note: string;
}

export interface Warehouse {
  id: ID;
  name: string;
  code: string;
  location: string;
  isDefault: boolean;
}

export type TransferStatus = "In Transit" | "Completed" | "Cancelled";

export interface Transfer {
  id: ID;
  reference: string;
  productId: ID;
  productName: string;
  sku: string;
  quantity: number;
  fromWarehouseId: ID;
  toWarehouseId: ID;
  status: TransferStatus;
  date: string;
  completedAt: string | null;
  notes: string;
}

export type ActivityType =
  | "sale_created"
  | "sale_completed"
  | "sale_cancelled"
  | "payment_recorded"
  | "purchase_created"
  | "purchase_received"
  | "purchase_cancelled"
  | "product_added"
  | "product_updated"
  | "product_deleted"
  | "stock_adjusted"
  | "transfer_created"
  | "transfer_completed"
  | "transfer_cancelled"
  | "customer_added"
  | "supplier_added"
  | "settings_updated";

export interface Activity {
  id: ID;
  type: ActivityType;
  title: string;
  description: string;
  reference: string | null;
  href: string | null;
  date: string;
}

export interface BusinessSettings {
  businessName: string;
  legalName: string;
  email: string;
  phone: string;
  address: string;
  gstin: string;
  currency: CurrencyCode;
  defaultTaxRate: number;
  pricesIncludeTax: boolean;
  invoicePrefix: string;
  purchasePrefix: string;
  lowStockNotifications: boolean;
}

export type CurrencyCode = "INR" | "USD" | "EUR" | "GBP" | "AED";

export interface Counters {
  sale: number;
  purchase: number;
  receipt: number;
  transfer: number;
  adjustment: number;
}

export interface InventoryState {
  schemaVersion: number;
  products: Product[];
  customers: Customer[];
  suppliers: Supplier[];
  sales: Sale[];
  purchases: Purchase[];
  movements: StockMovement[];
  warehouses: Warehouse[];
  transfers: Transfer[];
  activities: Activity[];
  settings: BusinessSettings;
  counters: Counters;
  readNotificationIds: ID[];
}

/* ---------------- Inputs to transaction functions ---------------- */

export interface ProductInput {
  name: string;
  sku: string;
  category: string;
  description: string;
  unit: string;
  sellingPrice: number;
  costPrice: number;
  openingStock: number;
  minStock: number;
  supplierId: ID | null;
  warehouseId?: ID;
}

export type ProductUpdateInput = Omit<ProductInput, "openingStock" | "warehouseId">;

export interface SaleInput {
  customerId: ID;
  date: string;
  warehouseId: ID;
  items: { productId: ID; quantity: number; unitPrice: number }[];
  discountType: DiscountType;
  discountValue: number;
  taxRate: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  amountPaid?: number;
  status?: Exclude<SaleStatus, "Cancelled">;
  notes: string;
}

export interface PurchaseInput {
  supplierId: ID;
  orderDate: string;
  expectedDate: string;
  warehouseId: ID;
  items: { productId: ID; quantity: number; unitCost: number }[];
  taxRate: number;
  notes: string;
  asDraft: boolean;
}

export interface ReceiveInput {
  purchaseId: ID;
  items: { productId: ID; quantity: number }[];
  date?: string;
  note?: string;
}

export interface AdjustmentInput {
  productId: ID;
  warehouseId: ID;
  direction: "increase" | "decrease";
  quantity: number;
  reason: string;
  notes: string;
}

export interface TransferInput {
  productId: ID;
  quantity: number;
  fromWarehouseId: ID;
  toWarehouseId: ID;
  completeNow: boolean;
  notes: string;
  date?: string;
}

export type CustomerInput = Omit<Customer, "id" | "createdAt">;
export type SupplierInput = Omit<Supplier, "id" | "createdAt">;
