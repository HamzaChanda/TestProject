"use client";

/**
 * Recently visited records (invoices, POs, products, customers, suppliers),
 * shown first in the command palette. Stored per browser — a convenience,
 * not business data — and every access is guarded so it never breaks the app.
 */
export interface RecentItem {
  href: string;
  label: string;
  sub: string;
  kind: "invoice" | "purchase" | "product" | "customer" | "supplier";
}

const KEY = "stockflow:recent";
const MAX = 6;

export function readRecents(): RecentItem[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as RecentItem[]) : [];
    return Array.isArray(list) ? list.slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function pushRecent(item: RecentItem) {
  try {
    const next = [item, ...readRecents().filter((r) => r.href !== item.href)].slice(0, MAX);
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — recents are optional */
  }
}
