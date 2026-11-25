/**
 * Demo data for StockFlow.
 *
 * Instead of hand-writing stock levels (which would drift from the history),
 * the seed REPLAYS a realistic six-month timeline through the same transaction
 * engine the UI uses: opening stock → purchases → receipts → sales →
 * cancellations → adjustments → transfers. Every stock quantity, movement,
 * invoice number and activity is therefore internally consistent.
 *
 * Opening stock per product is solved automatically so that the replay lands
 * on the intended "today" quantities (including low-stock and out-of-stock).
 */
import { addHours, setHours, setMinutes, subDays, subHours, format } from "date-fns";
import type { Customer, InventoryState, PaymentMethod, PaymentStatus, Supplier, Warehouse } from "@/types";
import { SCHEMA_VERSION } from "@/lib/constants";
import { totalStock } from "@/lib/calc";
import * as engine from "@/lib/inventory";

const MAIN = "wh_main";
const RETAIL = "wh_retail";

const warehouses: Warehouse[] = [
  { id: MAIN, name: "Main Warehouse", code: "MWH", location: "Bhiwandi, Thane", isDefault: true },
  { id: RETAIL, name: "Retail Warehouse", code: "RWH", location: "Andheri West, Mumbai", isDefault: false },
];

const customers: Omit<Customer, "createdAt">[] = [
  { id: "cus_rohan", name: "Rohan Sharma", company: "Sharma Electronics", email: "rohan@sharmaelectronics.in", phone: "+91 98201 44562", city: "Mumbai", address: "Shop 14, Lamington Road, Grant Road East, Mumbai 400007", gstin: "27AAKFS4521M1Z3" },
  { id: "cus_priya", name: "Priya Nair", company: "TechNest Solutions", email: "priya.nair@technest.co.in", phone: "+91 99860 21877", city: "Bengaluru", address: "3rd Floor, 80 Feet Road, Koramangala, Bengaluru 560034", gstin: "29AAHCT7782K1ZQ" },
  { id: "cus_ankit", name: "Ankit Patel", company: "Patel Computers", email: "ankit@patelcomputers.in", phone: "+91 98250 77341", city: "Ahmedabad", address: "G-7, Shivalik Plaza, Ambawadi, Ahmedabad 380015", gstin: "24ABFPP6612R1ZK" },
  { id: "cus_meera", name: "Meera Iyer", company: "Iyer & Co. Office Supplies", email: "meera@iyerandco.com", phone: "+91 94440 18820", city: "Chennai", address: "22 Usman Road, T. Nagar, Chennai 600017", gstin: "33AAEFI3390D1Z8" },
  { id: "cus_vikram", name: "Vikram Singh", company: "Singh Digital Hub", email: "vikram@singhdigital.in", phone: "+91 98110 63290", city: "New Delhi", address: "14/2 Nehru Place, New Delhi 110019", gstin: "07AAPFS9921L1ZB" },
  { id: "cus_sneha", name: "Sneha Kulkarni", company: "Kulkarni Infotech", email: "sneha.k@kulkarniinfotech.com", phone: "+91 97300 55218", city: "Pune", address: "Office 504, Baner Road, Pune 411045", gstin: "27AAJCK1187H1ZW" },
  { id: "cus_arjun", name: "Arjun Reddy", company: "Reddy Retail Mart", email: "arjun@reddyretail.in", phone: "+91 90000 48127", city: "Hyderabad", address: "Plot 9, Jubilee Hills Road No. 36, Hyderabad 500033", gstin: "36AAKFR2208G1ZM" },
  { id: "cus_fatima", name: "Fatima Sheikh", company: "Crescent IT Services", email: "fatima@crescentit.in", phone: "+91 98925 30114", city: "Mumbai", address: "201, Kurla Kamani Junction, LBS Marg, Mumbai 400070", gstin: "27AAGCC6634N1ZD" },
];

const suppliers: Omit<Supplier, "createdAt">[] = [
  { id: "sup_logicore", name: "Logicore Distributors Pvt. Ltd.", contactPerson: "Rajesh Gupta", email: "orders@logicore.in", phone: "+91 11 4567 2210", city: "New Delhi", address: "B-42, Okhla Industrial Area Phase II, New Delhi 110020", gstin: "07AABCL5521Q1ZT", paymentTerms: "Net 30" },
  { id: "sup_soundwave", name: "SoundWave Imports", contactPerson: "Neha Kapoor", email: "neha@soundwaveimports.com", phone: "+91 22 2650 8841", city: "Mumbai", address: "Unit 12, Marol Industrial Estate, Andheri East, Mumbai 400059", gstin: "27AAPFS3378E1ZN", paymentTerms: "Net 15" },
  { id: "sup_vertex", name: "Vertex Components India", contactPerson: "Suresh Menon", email: "sales@vertexcomponents.in", phone: "+91 80 4120 7766", city: "Bengaluru", address: "No. 7, Peenya Industrial Area, Bengaluru 560058", gstin: "29AACCV8810P1ZG", paymentTerms: "Net 45" },
  { id: "sup_cablekart", name: "CableKart Wholesale", contactPerson: "Imran Qureshi", email: "imran@cablekart.co.in", phone: "+91 11 2398 4410", city: "New Delhi", address: "1452 Bhagirath Palace, Chandni Chowk, Delhi 110006", gstin: "07AAMFC4471J1ZA", paymentTerms: "Advance" },
  { id: "sup_deskpro", name: "DeskPro Accessories", contactPerson: "Kavita Joshi", email: "kavita@deskpro.in", phone: "+91 20 6610 3392", city: "Pune", address: "Gat No. 118, Chakan MIDC, Pune 410501", gstin: "27AAECD9054B1ZP", paymentTerms: "Net 30" },
];

interface ProductSeed {
  key: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  costPrice: number;
  sellingPrice: number;
  minStock: number;
  supplierId: string;
  description: string;
  /** Intended quantity on hand today (all warehouses). */
  target: number;
}

const productSeeds: ProductSeed[] = [
  { key: "WM", name: "Wireless Mouse", sku: "PER-WM-235", category: "Peripherals", unit: "pcs", costPrice: 520, sellingPrice: 899, minStock: 20, supplierId: "sup_logicore", target: 64, description: "2.4 GHz silent-click wireless mouse with USB nano receiver and 18-month battery life." },
  { key: "KB", name: "Mechanical Keyboard", sku: "PER-KB-087", category: "Peripherals", unit: "pcs", costPrice: 2650, sellingPrice: 4299, minStock: 10, supplierId: "sup_logicore", target: 23, description: "Tenkeyless 87-key mechanical keyboard, hot-swappable brown switches, white backlight." },
  { key: "HUB", name: "USB-C Hub 7-in-1", sku: "ACC-HUB-C07", category: "Accessories", unit: "pcs", costPrice: 1450, sellingPrice: 2499, minStock: 12, supplierId: "sup_deskpro", target: 31, description: "Aluminium USB-C hub with 4K HDMI, 100W PD pass-through, SD/microSD and 3× USB-A." },
  { key: "LS", name: "Laptop Stand", sku: "ACC-LST-ALU", category: "Accessories", unit: "pcs", costPrice: 780, sellingPrice: 1499, minStock: 10, supplierId: "sup_deskpro", target: 26, description: "Height-adjustable aluminium laptop stand for 11–17 inch notebooks, foldable." },
  { key: "SPK", name: "Bluetooth Speaker", sku: "AUD-SPK-20W", category: "Audio", unit: "pcs", costPrice: 1650, sellingPrice: 2799, minStock: 8, supplierId: "sup_soundwave", target: 17, description: "20W portable Bluetooth 5.3 speaker, IPX7 waterproof, 12-hour playback." },
  { key: "CAM", name: "Webcam HD", sku: "PER-CAM-1080", category: "Peripherals", unit: "pcs", costPrice: 1850, sellingPrice: 3199, minStock: 8, supplierId: "sup_logicore", target: 6, description: "1080p 30fps webcam with dual noise-cancelling mics and privacy shutter." },
  { key: "PB", name: "Power Bank 20000mAh", sku: "PWR-PB-20K", category: "Power", unit: "pcs", costPrice: 1150, sellingPrice: 1899, minStock: 15, supplierId: "sup_cablekart", target: 11, description: "20000mAh power bank with 22.5W fast charging, USB-C PD in/out." },
  { key: "HDMI", name: "HDMI Cable 2m", sku: "CBL-HDM-2M", category: "Cables", unit: "pcs", costPrice: 180, sellingPrice: 449, minStock: 30, supplierId: "sup_cablekart", target: 140, description: "High-speed HDMI 2.0 cable, 4K@60Hz, braided, 2 metres." },
  { key: "MON", name: "Monitor 24-inch", sku: "DSP-MON-24F", category: "Displays", unit: "pcs", costPrice: 8200, sellingPrice: 11999, minStock: 5, supplierId: "sup_vertex", target: 9, description: "24-inch FHD IPS monitor, 75Hz, 3-side borderless, HDMI + VGA." },
  { key: "HP", name: "Wireless Headphones", sku: "AUD-HP-ANC", category: "Audio", unit: "pcs", costPrice: 3900, sellingPrice: 6499, minStock: 6, supplierId: "sup_soundwave", target: 0, description: "Over-ear active noise-cancelling Bluetooth headphones, 40-hour battery." },
  { key: "SSD", name: "SSD 1TB", sku: "STR-SSD-1TB", category: "Storage", unit: "pcs", costPrice: 4600, sellingPrice: 6999, minStock: 8, supplierId: "sup_vertex", target: 5, description: "1TB NVMe PCIe Gen3 M.2 SSD, up to 3500 MB/s read." },
  { key: "UCC", name: "USB-C Cable 1m", sku: "CBL-UCC-1M", category: "Cables", unit: "pcs", costPrice: 140, sellingPrice: 349, minStock: 40, supplierId: "sup_cablekart", target: 180, description: "USB-C to USB-C 60W braided charging & data cable, 1 metre." },
];

type Line = [key: string, qty: number];

interface SaleEvent {
  kind: "sale";
  day: number;
  hour?: number;
  customer: string;
  items: Line[];
  payment: PaymentStatus;
  method: PaymentMethod;
  paidRatio?: number;
  pending?: boolean;
  warehouse?: string;
  discount?: number;
  cancelOnDay?: number;
  cancelReason?: string;
}

interface PurchaseEvent {
  kind: "purchase";
  day: number;
  supplier: string;
  items: Line[];
  expectedInDays: number;
  draft?: boolean;
  receipts?: { day: number; items: Line[] }[];
  cancelOnDay?: number;
  notes?: string;
}

interface AdjustEvent {
  kind: "adjust";
  day: number;
  key: string;
  qty: number;
  reason: string;
  notes: string;
}

interface TransferEvent {
  kind: "transfer";
  day: number;
  key: string;
  qty: number;
  from: string;
  to: string;
  complete: boolean;
}

type SeedEvent = SaleEvent | PurchaseEvent | AdjustEvent | TransferEvent;

const events: SeedEvent[] = [
  // Six months ago — stocking the retail floor
  { kind: "transfer", day: 168, key: "WM", qty: 30, from: MAIN, to: RETAIL, complete: true },
  { kind: "transfer", day: 168, key: "UCC", qty: 60, from: MAIN, to: RETAIL, complete: true },

  // Month −5
  { kind: "sale", day: 163, customer: "cus_ankit", items: [["MON", 4], ["KB", 6], ["WM", 15]], payment: "Paid", method: "Bank Transfer" },
  { kind: "purchase", day: 158, supplier: "sup_logicore", items: [["KB", 20], ["WM", 50], ["CAM", 15]], expectedInDays: 7, receipts: [{ day: 151, items: [["KB", 20], ["WM", 50], ["CAM", 15]] }] },
  { kind: "sale", day: 150, customer: "cus_rohan", items: [["HDMI", 40], ["UCC", 60], ["HUB", 8]], payment: "Paid", method: "UPI" },

  // Month −4
  { kind: "sale", day: 138, customer: "cus_vikram", items: [["SSD", 6], ["MON", 3], ["WM", 20]], payment: "Paid", method: "Bank Transfer", discount: 3 },
  { kind: "sale", day: 126, customer: "cus_priya", items: [["KB", 8], ["CAM", 6], ["LS", 10]], payment: "Paid", method: "Card" },
  { kind: "purchase", day: 118, supplier: "sup_vertex", items: [["MON", 20], ["SSD", 20]], expectedInDays: 10, receipts: [{ day: 109, items: [["MON", 20], ["SSD", 20]] }] },

  // Month −3
  { kind: "transfer", day: 104, key: "PB", qty: 12, from: MAIN, to: RETAIL, complete: true },
  { kind: "sale", day: 101, customer: "cus_arjun", items: [["SPK", 10], ["HP", 4], ["PB", 8]], payment: "Paid", method: "UPI" },
  { kind: "sale", day: 94, customer: "cus_meera", items: [["LS", 15], ["HUB", 10], ["HDMI", 30]], payment: "Paid", method: "Bank Transfer" },

  // Month −2
  { kind: "sale", day: 79, customer: "cus_sneha", items: [["MON", 5], ["SSD", 5], ["KB", 5]], payment: "Paid", method: "Bank Transfer", discount: 5 },
  { kind: "adjust", day: 74, key: "WM", qty: -3, reason: "Damaged goods", notes: "Units crushed in transit; claim filed with courier." },
  { kind: "sale", day: 67, customer: "cus_fatima", items: [["CAM", 8], ["HP", 3], ["UCC", 50]], payment: "Paid", method: "Card" },
  { kind: "sale", day: 63, customer: "cus_rohan", items: [["WM", 25], ["KB", 3]], payment: "Unpaid", method: "Credit", cancelOnDay: 61, cancelReason: "Customer withdrew order" },
  { kind: "purchase", day: 60, supplier: "sup_soundwave", items: [["SPK", 20], ["HP", 12]], expectedInDays: 6, receipts: [{ day: 55, items: [["SPK", 20], ["HP", 12]] }] },

  // Month −1
  { kind: "sale", day: 51, customer: "cus_ankit", items: [["MON", 6], ["HUB", 12], ["LS", 8]], payment: "Paid", method: "Bank Transfer" },
  { kind: "purchase", day: 46, supplier: "sup_logicore", items: [["WM", 40], ["KB", 10]], expectedInDays: 10, cancelOnDay: 43, notes: "Supplier could not meet price; re-sourcing." },
  { kind: "sale", day: 40, customer: "cus_priya", items: [["SSD", 8], ["KB", 6], ["SPK", 6]], payment: "Paid", method: "UPI" },
  { kind: "sale", day: 33, customer: "cus_vikram", items: [["HP", 6], ["CAM", 5], ["HDMI", 40]], payment: "Paid", method: "Card" },
  { kind: "purchase", day: 30, supplier: "sup_cablekart", items: [["HDMI", 100], ["UCC", 150], ["PB", 15]], expectedInDays: 5, receipts: [{ day: 26, items: [["HDMI", 100], ["UCC", 150], ["PB", 15]] }] },
  { kind: "transfer", day: 25, key: "HDMI", qty: 30, from: MAIN, to: RETAIL, complete: true },

  // This month
  { kind: "sale", day: 21, customer: "cus_arjun", items: [["MON", 4], ["WM", 20], ["UCC", 40]], payment: "Paid", method: "Bank Transfer" },
  { kind: "adjust", day: 19, key: "HDMI", qty: 5, reason: "Found during audit", notes: "Cycle count found an unlogged carton." },
  { kind: "sale", day: 17, customer: "cus_meera", items: [["SSD", 6], ["HUB", 6]], payment: "Partial", paidRatio: 0.5, method: "Bank Transfer" },
  { kind: "purchase", day: 14, supplier: "sup_vertex", items: [["MON", 10], ["SSD", 20]], expectedInDays: 12, receipts: [{ day: 6, items: [["MON", 6]] }], notes: "SSD batch delayed at customs; balance expected next week." },
  { kind: "sale", day: 12, customer: "cus_rohan", items: [["KB", 5], ["LS", 10], ["SPK", 4]], payment: "Paid", method: "UPI" },
  { kind: "sale", day: 10, customer: "cus_sneha", items: [["SPK", 3]], payment: "Paid", method: "UPI", cancelOnDay: 9, cancelReason: "Wrong model ordered" },
  { kind: "sale", day: 8, customer: "cus_sneha", items: [["HP", 7], ["PB", 12]], payment: "Unpaid", method: "Credit", pending: true },
  { kind: "adjust", day: 7, key: "CAM", qty: -2, reason: "Damaged goods", notes: "Lens cracked — returned to supplier." },
  { kind: "sale", day: 5, customer: "cus_fatima", items: [["CAM", 6], ["HDMI", 25]], payment: "Paid", method: "Card" },
  { kind: "purchase", day: 4, supplier: "sup_soundwave", items: [["HP", 20], ["SPK", 10]], expectedInDays: 5, notes: "Urgent restock — headphones out of stock." },
  { kind: "sale", day: 3, customer: "cus_priya", items: [["MON", 3], ["SSD", 4]], payment: "Partial", paidRatio: 0.4, method: "Bank Transfer" },
  { kind: "transfer", day: 2, key: "SPK", qty: 5, from: MAIN, to: RETAIL, complete: false },
  { kind: "purchase", day: 2, supplier: "sup_deskpro", items: [["LS", 30], ["HUB", 20]], expectedInDays: 10, draft: true, notes: "Awaiting revised quote before placing." },
  { kind: "transfer", day: 1, key: "LS", qty: 6, from: MAIN, to: RETAIL, complete: true },
  { kind: "sale", day: 1, customer: "cus_vikram", items: [["WM", 10], ["UCC", 30], ["PB", 8]], payment: "Paid", method: "Cash", warehouse: RETAIL },
  { kind: "sale", day: 0, customer: "cus_ankit", items: [["KB", 4], ["HUB", 3]], payment: "Unpaid", method: "Credit", pending: true },
];

function emptyState(): InventoryState {
  return {
    schemaVersion: SCHEMA_VERSION,
    products: [],
    customers: [],
    suppliers: [],
    sales: [],
    purchases: [],
    movements: [],
    warehouses: structuredClone(warehouses),
    transfers: [],
    activities: [],
    settings: {
      businessName: "StockFlow Demo Store",
      legalName: "StockFlow Retail Pvt. Ltd.",
      email: "accounts@stockflow.demo",
      phone: "+91 22 4000 1234",
      address: "402, Trade Centre, Bandra Kurla Complex, Mumbai 400051",
      gstin: "27AABCS1234F1Z5",
      currency: "INR",
      defaultTaxRate: 18,
      pricesIncludeTax: false,
      invoicePrefix: "INV",
      purchasePrefix: "PO",
      lowStockNotifications: true,
    },
    counters: { sale: 0, purchase: 0, receipt: 0, transfer: 0, adjustment: 0 },
    readNotificationIds: [],
  };
}

export function build(now: Date, openings: Record<string, number>): InventoryState {
  // Business-hours timestamps, offset per event so same-day events keep order.
  let offset = 0;
  const at = (day: number, hour = 10) => {
    offset += 1;
    if (day === 0) return subHours(now, 3 - Math.min(offset % 3, 2) * 0.5).toISOString();
    const base = setMinutes(setHours(subDays(now, day), hour), (offset * 7) % 60);
    return base.toISOString();
  };
  const dateOnly = (iso: string) => format(new Date(iso), "yyyy-MM-dd");

  let state = emptyState();
  const opening = (day: number) => ({ now: at(day, 9) });
  state.customers = customers.map((c, i) => ({ ...c, createdAt: subDays(now, 190 - i * 3).toISOString() }));
  state.suppliers = suppliers.map((s, i) => ({ ...s, createdAt: subDays(now, 200 - i * 2).toISOString() }));

  const ids: Record<string, string> = {};
  for (const p of productSeeds) {
    const r = engine.addProduct(
      state,
      {
        name: p.name,
        sku: p.sku,
        category: p.category,
        description: p.description,
        unit: p.unit,
        sellingPrice: p.sellingPrice,
        costPrice: p.costPrice,
        openingStock: openings[p.key] ?? 0,
        minStock: p.minStock,
        supplierId: p.supplierId,
        warehouseId: MAIN,
      },
      opening(175),
    );
    state = r.state;
    ids[p.key] = r.result.id;
  }
  const price = (key: string) => productSeeds.find((p) => p.key === key)!;

  // Expand events so follow-up actions (receipts, cancellations) happen on their own day.
  type Step = { day: number; order: number; run: () => void };
  const steps: Step[] = [];
  let order = 0;
  const refs: Record<number, string> = {};

  events.forEach((ev, idx) => {
    const o = order++;
    if (ev.kind === "sale") {
      steps.push({
        day: ev.day,
        order: o,
        run: () => {
          const when = at(ev.day, ev.hour ?? 11);
          const lines = ev.items.map(([k, q]) => ({ productId: ids[k], quantity: q, unitPrice: price(k).sellingPrice }));
          const preview = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0) * (1 - (ev.discount ?? 0) / 100) * 1.18;
          const r = engine.createSale(
            state,
            {
              customerId: ev.customer,
              date: when,
              warehouseId: ev.warehouse ?? MAIN,
              items: lines,
              discountType: "percent",
              discountValue: ev.discount ?? 0,
              taxRate: 18,
              paymentMethod: ev.method,
              paymentStatus: ev.payment,
              amountPaid: ev.paidRatio ? Math.round(preview * ev.paidRatio) : undefined,
              status: ev.pending ? "Pending" : "Completed",
              notes: "",
            },
            { now: when },
          );
          state = r.state;
          refs[idx] = r.result.id;
        },
      });
      if (ev.cancelOnDay !== undefined) {
        const cancelDay = ev.cancelOnDay;
        steps.push({
          day: cancelDay,
          order: order++,
          run: () => {
            state = engine.cancelSale(state, refs[idx], ev.cancelReason ?? "", { now: at(cancelDay, 15) }).state;
          },
        });
      }
    } else if (ev.kind === "purchase") {
      steps.push({
        day: ev.day,
        order: o,
        run: () => {
          const when = at(ev.day, 10);
          const r = engine.createPurchase(
            state,
            {
              supplierId: ev.supplier,
              orderDate: dateOnly(when),
              expectedDate: dateOnly(addHours(new Date(when), ev.expectedInDays * 24).toISOString()),
              warehouseId: MAIN,
              items: ev.items.map(([k, q]) => ({ productId: ids[k], quantity: q, unitCost: price(k).costPrice })),
              taxRate: 18,
              notes: ev.notes ?? "",
              asDraft: !!ev.draft,
            },
            { now: when },
          );
          state = r.state;
          refs[idx] = r.result.id;
        },
      });
      ev.receipts?.forEach((rc) => {
        steps.push({
          day: rc.day,
          order: order++,
          run: () => {
            const when = at(rc.day, 14);
            state = engine.receivePurchaseItems(
              state,
              { purchaseId: refs[idx], items: rc.items.map(([k, q]) => ({ productId: ids[k], quantity: q })), date: when },
              { now: when },
            ).state;
          },
        });
      });
      if (ev.cancelOnDay !== undefined) {
        const cancelDay = ev.cancelOnDay;
        steps.push({ day: cancelDay, order: order++, run: () => { state = engine.cancelPurchase(state, refs[idx], { now: at(cancelDay, 16) }).state; } });
      }
    } else if (ev.kind === "adjust") {
      steps.push({
        day: ev.day,
        order: o,
        run: () => {
          state = engine.adjustStock(
            state,
            { productId: ids[ev.key], warehouseId: MAIN, direction: ev.qty > 0 ? "increase" : "decrease", quantity: Math.abs(ev.qty), reason: ev.reason, notes: ev.notes },
            { now: at(ev.day, 17) },
          ).state;
        },
      });
    } else {
      steps.push({
        day: ev.day,
        order: o,
        run: () => {
          const when = at(ev.day, 12);
          state = engine.createTransfer(
            state,
            { productId: ids[ev.key], quantity: ev.qty, fromWarehouseId: ev.from, toWarehouseId: ev.to, completeNow: ev.complete, notes: "", date: when },
            { now: when },
          ).state;
        },
      });
    }
  });

  steps.sort((a, b) => b.day - a.day || a.order - b.order).forEach((s) => s.run());

  // Seed notifications start unread; activity timeline is already sorted newest-first.
  state.activities.sort((a, b) => b.date.localeCompare(a.date));
  state.movements.sort((a, b) => b.date.localeCompare(a.date));
  state.sales.sort((a, b) => b.date.localeCompare(a.date));
  state.purchases.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  state.transfers.sort((a, b) => b.date.localeCompare(a.date));
  return state;
}

/**
 * Builds the demo state relative to `now`. A first "probe" replay with very
 * large opening stock measures each product's net movement; opening stock is
 * then solved as (target − net) and the timeline is replayed for real.
 */
export function createSeedState(now: Date = new Date()): InventoryState {
  const BIG = 100_000;
  const probe = build(now, Object.fromEntries(productSeeds.map((p) => [p.key, BIG])));
  const openings: Record<string, number> = {};
  for (const p of productSeeds) {
    const product = probe.products.find((x) => x.sku === p.sku)!;
    const net = totalStock(product) - BIG;
    openings[p.key] = p.target - net;
  }
  return build(now, openings);
}

export function createEmptyState(): InventoryState {
  return emptyState();
}
