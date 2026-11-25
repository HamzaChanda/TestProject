"use client";

/**
 * Centralised inventory state.
 *
 * - Persists to localStorage via usePersistedState. Nothing data-dependent
 *   renders until the first load completes, so there is no SSR mismatch.
 * - Seeds demo data the first time, and only when no saved data exists.
 * - Exposes high-level actions that delegate to the pure transaction engine
 *   in `lib/inventory.ts`. Components never mutate stock themselves.
 * - Every action returns the created record (or null on failure) and reports
 *   errors through a single toast path.
 */
import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { toast } from "sonner";
import type {
  AdjustmentInput,
  BusinessSettings,
  CustomerInput,
  ID,
  InventoryState,
  ProductInput,
  ProductUpdateInput,
  PurchaseInput,
  ReceiveInput,
  SaleInput,
  SupplierInput,
  TransferInput,
  Warehouse,
} from "@/types";
import * as engine from "@/lib/inventory";
import { InventoryError, type TxResult } from "@/lib/inventory";
import { setActiveCurrency } from "@/lib/utils";
import { createSeedState } from "@/data/seed";
import { usePersistedState } from "./usePersistedState";

type Message<T> = string | ((result: T) => string) | null;

function useInventoryStore() {
  // Persistence lives in usePersistedState; this hook only turns user intents
  // into engine transactions.
  const { state, stateRef, commit } = usePersistedState();

  /** Run an engine transaction against the latest state. */
  const run = useCallback(
    <T,>(fn: (s: InventoryState) => TxResult<T>, success: Message<T>, opts: { silentError?: boolean } = {}): T | null => {
      const current = stateRef.current;
      if (!current) return null;
      try {
        const { state: next, result } = fn(current);
        commit(next);
        if (success) toast.success(typeof success === "function" ? success(result) : success);
        return result;
      } catch (err) {
        if (!opts.silentError) {
          if (err instanceof InventoryError) toast.error(err.message);
          else {
            console.error(err);
            toast.error("Something went wrong. Your data was not changed.");
          }
        }
        return null;
      }
    },
    [commit, stateRef],
  );

  /** Apply a non-engine change (no validation needed). */
  const commitOp = useCallback(
    (op: (s: InventoryState) => InventoryState) => {
      const current = stateRef.current;
      if (current) commit(op(current));
    },
    [commit, stateRef],
  );

  const actions = useMemo(
    () => ({
      // Products
      addProduct: (input: ProductInput) => run((s) => engine.addProduct(s, input), (p) => `${p.name} added to inventory.`),
      updateProduct: (id: ID, input: ProductUpdateInput) => run((s) => engine.updateProduct(s, id, input), "Product updated successfully."),
      deleteProduct: (id: ID) => run((s) => engine.deleteProduct(s, id), "Product deleted."),

      // Sales
      createSale: (input: SaleInput) => run((s) => engine.createSale(s, input), "Invoice created successfully."),
      cancelSale: (id: ID, reason: string) => run((s) => engine.cancelSale(s, id, reason), (sale) => `${sale.invoiceNo} cancelled. Stock has been restored.`),
      completeSale: (id: ID) => run((s) => engine.completeSale(s, id), (sale) => `${sale.invoiceNo} marked as completed.`),
      recordPayment: (id: ID, amount: number) => run((s) => engine.recordPayment(s, id, amount), "Payment recorded."),

      // Purchases
      createPurchase: (input: PurchaseInput) =>
        run((s) => engine.createPurchase(s, input), (po) => (po.status === "Draft" ? `Draft ${po.poNumber} saved.` : `Purchase order ${po.poNumber} created.`)),
      placePurchaseOrder: (id: ID) => run((s) => engine.placePurchaseOrder(s, id), (po) => `${po.poNumber} placed with ${po.supplierName}.`),
      deletePurchaseDraft: (id: ID) => run((s) => engine.deletePurchaseDraft(s, id), "Draft deleted."),
      receivePurchaseItems: (input: ReceiveInput) => run((s) => engine.receivePurchaseItems(s, input), "Stock updated successfully."),
      cancelPurchase: (id: ID) => run((s) => engine.cancelPurchase(s, id), (po) => `${po.poNumber} cancelled.`),

      // Stock
      adjustStock: (input: AdjustmentInput) => run((s) => engine.adjustStock(s, input), (ref) => `Stock adjusted (${ref}).`),
      createTransfer: (input: TransferInput) =>
        run((s) => engine.createTransfer(s, input), (t) => (t.status === "Completed" ? `Transfer ${t.reference} completed.` : `Transfer ${t.reference} dispatched.`)),
      completeTransfer: (id: ID) => run((s) => engine.completeTransfer(s, id), (t) => `${t.reference} received at destination.`),
      cancelTransfer: (id: ID) => run((s) => engine.cancelTransfer(s, id), (t) => `${t.reference} cancelled. Stock returned to source.`),

      // Parties
      addCustomer: (input: CustomerInput, opts: { silent?: boolean } = {}) =>
        run((s) => engine.addCustomer(s, input), opts.silent ? null : (c) => `${c.name} added.`),
      updateCustomer: (id: ID, input: CustomerInput) => run((s) => engine.updateCustomer(s, id, input), "Customer updated."),
      deleteCustomer: (id: ID) => run((s) => engine.deleteCustomer(s, id), "Customer deleted."),
      addSupplier: (input: SupplierInput) => run((s) => engine.addSupplier(s, input), (x) => `${x.name} added.`),
      updateSupplier: (id: ID, input: SupplierInput) => run((s) => engine.updateSupplier(s, id, input), "Supplier updated."),
      deleteSupplier: (id: ID) => run((s) => engine.deleteSupplier(s, id), "Supplier deleted."),

      // Settings
      updateSettings: (patch: Partial<BusinessSettings>, message = "Settings saved.") => run((s) => engine.updateSettings(s, patch), message),
      updateWarehouse: (id: ID, patch: Pick<Warehouse, "name" | "location" | "code">) => run((s) => engine.updateWarehouse(s, id, patch), "Warehouse updated."),
      setDefaultWarehouse: (id: ID) => run((s) => engine.setDefaultWarehouse(s, id), "Default warehouse updated."),

      // Notifications & data
      markNotificationsRead: (ids: ID[]) =>
        commitOp((s) => ({ ...s, readNotificationIds: [...new Set([...s.readNotificationIds, ...ids])].slice(-300) })),
      resetDemoData: () => {
        const seed = createSeedState();
        commitOp(() => seed);
        toast.success("Demo data restored.");
      },
    }),
    [run, commitOp],
  );

  return { state, actions };
}

type Store = ReturnType<typeof useInventoryStore>;
type Actions = Store["actions"];

interface InventoryContextValue {
  state: InventoryState;
  actions: Actions;
}

const InventoryContext = createContext<InventoryContextValue | null>(null);

export function InventoryProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const { state, actions } = useInventoryStore();
  const value = useMemo(() => (state ? { state, actions } : null), [state, actions]);
  if (state) setActiveCurrency(state.settings.currency);
  if (!value) return <>{fallback}</>;
  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
}

export function useInventory() {
  const ctx = useContext(InventoryContext);
  if (!ctx) throw new Error("useInventory must be used inside <InventoryProvider>");
  return ctx;
}
