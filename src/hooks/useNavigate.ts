"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { signalNavigationStart } from "@/components/layout/NavigationProgress";

/**
 * Programmatic navigation that also drives the top progress bar
 * (plain `router.push` from a row click gives the user no feedback).
 */
export function useNavigate() {
  const router = useRouter();
  return useCallback(
    (href: string) => {
      signalNavigationStart(href);
      router.push(href);
    },
    [router],
  );
}
