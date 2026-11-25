"use client";

/**
 * localStorage persistence for the inventory state.
 *
 * - Loads on the client only, so there is no server/client hydration mismatch.
 * - Seeds demo data the first time, and only when no saved data exists.
 * - Recovers from corrupted or outdated saved data (and tells the user).
 * - Keeps multiple open tabs in sync via the `storage` event.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { InventoryState } from "@/types";
import { STORAGE_KEY } from "@/lib/constants";
import { isValidState } from "@/lib/state";
import { createSeedState } from "@/data/seed";

function readSaved(): { state: InventoryState | null; hadData: boolean } {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { state: null, hadData: false };
    const parsed: unknown = JSON.parse(raw);
    return { state: isValidState(parsed) ? parsed : null, hadData: true };
  } catch {
    return { state: null, hadData: true }; // corrupted JSON or storage unavailable
  }
}

function write(state: InventoryState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    toast.error("Could not save changes to this browser. Storage may be full or disabled.");
  }
}

export function usePersistedState() {
  const [state, setState] = useState<InventoryState | null>(null);
  const stateRef = useRef<InventoryState | null>(null);

  const replace = useCallback((next: InventoryState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  useEffect(() => {
    const { state: saved, hadData } = readSaved();
    if (saved) {
      replace(saved);
    } else {
      const seed = createSeedState();
      replace(seed);
      write(seed);
      if (hadData) toast.warning("Saved data in this browser could not be read, so demo data was restored.");
    }

    // Another tab saved a change → show it here too.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        const next: unknown = JSON.parse(e.newValue);
        if (isValidState(next)) replace(next);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [replace]);

  /** Replace the state and persist it. */
  const commit = useCallback(
    (next: InventoryState) => {
      replace(next);
      write(next);
    },
    [replace],
  );

  return { state, stateRef, commit };
}
