import type { InventoryState } from "@/types";
import { SCHEMA_VERSION } from "./constants";

/** Structural check before trusting data read from localStorage. */
export function isValidState(v: unknown): v is InventoryState {
  const s = v as InventoryState;
  return (
    !!s &&
    typeof s === "object" &&
    s.schemaVersion === SCHEMA_VERSION &&
    [s.products, s.customers, s.suppliers, s.sales, s.purchases, s.movements, s.warehouses, s.transfers, s.activities, s.readNotificationIds].every(
      Array.isArray,
    ) &&
    !!s.settings &&
    typeof s.settings === "object" &&
    !!s.counters &&
    typeof s.counters === "object"
  );
}
