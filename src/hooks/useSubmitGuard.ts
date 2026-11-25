"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Prevents duplicate transactions from double clicks / repeated Enter presses.
 *
 * `guard(fn)` runs `fn` only if no submission is in flight. If `fn` returns a
 * truthy result (the transaction succeeded) the lock is KEPT — the form is
 * about to close or navigate away, so it must not be submittable again.
 * A falsy result (validation/engine error) releases the lock for a retry.
 */
export function useSubmitGuard() {
  const locked = useRef(false);
  const [pending, setPending] = useState(false);

  const guard = useCallback(<T,>(fn: () => T): T | undefined => {
    if (locked.current) return undefined;
    locked.current = true;
    setPending(true);
    let result: T | undefined;
    try {
      result = fn();
    } finally {
      if (!result) {
        locked.current = false;
        setPending(false);
      }
    }
    return result;
  }, []);

  const release = useCallback(() => {
    locked.current = false;
    setPending(false);
  }, []);

  return { guard, pending, release };
}
