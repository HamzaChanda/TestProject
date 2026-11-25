import { clsx, type ClassValue } from "clsx";
import { format, formatDistanceToNowStrict, isValid, parseISO } from "date-fns";
import type { CurrencyCode } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

const CURRENCY_LOCALE: Record<CurrencyCode, string> = {
  INR: "en-IN",
  USD: "en-US",
  EUR: "de-DE",
  GBP: "en-GB",
  AED: "en-AE",
};

let activeCurrency: CurrencyCode = "INR";

/** Called by the inventory provider whenever settings change. */
export function setActiveCurrency(code: CurrencyCode) {
  activeCurrency = code;
}

const formatterCache = new Map<string, Intl.NumberFormat>();
function getFormatter(code: CurrencyCode, fractionDigits: number) {
  const key = `${code}-${fractionDigits}`;
  let f = formatterCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(CURRENCY_LOCALE[code], {
      style: "currency",
      currency: code,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
    formatterCache.set(key, f);
  }
  return f;
}

/**
 * Money formatting. Transactional amounts always show 2 decimals so columns
 * align; `whole` rounds to the nearest unit for headline KPIs.
 */
export function formatCurrency(value: number, opts: { whole?: boolean } = {}) {
  return opts.whole
    ? getFormatter(activeCurrency, 0).format(Math.round(value || 0))
    : getFormatter(activeCurrency, 2).format(value || 0);
}

/** Compact currency for chart axes: ₹1.2L, ₹45K. */
export function formatCompactCurrency(value: number) {
  const symbol = getFormatter(activeCurrency, 0)
    .formatToParts(0)
    .find((p) => p.type === "currency")?.value ?? "";
  const abs = Math.abs(value);
  if (activeCurrency === "INR") {
    if (abs >= 1e7) return `${symbol}${trim(value / 1e7)}Cr`;
    if (abs >= 1e5) return `${symbol}${trim(value / 1e5)}L`;
  } else if (abs >= 1e6) {
    return `${symbol}${trim(value / 1e6)}M`;
  }
  if (abs >= 1e3) return `${symbol}${trim(value / 1e3)}K`;
  return `${symbol}${Math.round(value)}`;
}

function trim(n: number) {
  return n.toFixed(1).replace(/\.0$/, "");
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN").format(value || 0);
}

export function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function toDate(value: string | Date) {
  return typeof value === "string" ? parseISO(value) : value;
}

export function formatDate(value: string | Date | null | undefined, pattern = "dd MMM yyyy") {
  if (!value) return "—";
  const d = toDate(value);
  return isValid(d) ? format(d, pattern) : "—";
}

export function formatDateTime(value: string | Date | null | undefined) {
  return formatDate(value, "dd MMM yyyy, h:mm a");
}

export function timeAgo(value: string | Date) {
  const d = toDate(value);
  if (!isValid(d)) return "—";
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "just now";
  return `${formatDistanceToNowStrict(d)} ago`;
}

export function uid(prefix = "id") {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}


export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function pad(n: number, width = 4) {
  return String(n).padStart(width, "0");
}

export function currencySymbol() {
  return (
    getFormatter(activeCurrency, 0)
      .formatToParts(0)
      .find((p) => p.type === "currency")?.value ?? ""
  );
}

/** Convert a yyyy-MM-dd form value into an ISO timestamp (now if today, else midday). */
export function toIsoDate(dateOnly: string) {
  const today = format(new Date(), "yyyy-MM-dd");
  if (dateOnly === today) return new Date().toISOString();
  return new Date(`${dateOnly}T12:00:00`).toISOString();
}
