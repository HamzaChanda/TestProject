import type { CurrencyCode, PaymentMethod } from "@/types";

export const STORAGE_KEY = "stockflow:v1";
export const SCHEMA_VERSION = 1;

export const CATEGORIES = [
  "Peripherals",
  "Audio",
  "Accessories",
  "Storage",
  "Displays",
  "Cables",
  "Power",
] as const;

export const UNITS = ["pcs", "box", "set", "pack", "unit"] as const;

export const PAYMENT_METHODS: PaymentMethod[] = ["UPI", "Cash", "Card", "Bank Transfer", "Credit"];

export const ADJUSTMENT_REASONS = [
  "Stock count correction",
  "Damaged goods",
  "Expired / obsolete",
  "Returned by customer",
  "Lost or stolen",
  "Sample / promotional use",
  "Found during audit",
  "Other",
] as const;

export const CURRENCIES: { code: CurrencyCode; label: string; symbol: string }[] = [
  { code: "INR", label: "Indian Rupee", symbol: "₹" },
  { code: "USD", label: "US Dollar", symbol: "$" },
  { code: "EUR", label: "Euro", symbol: "€" },
  { code: "GBP", label: "British Pound", symbol: "£" },
  { code: "AED", label: "UAE Dirham", symbol: "AED" },
];

export const TAX_PRESETS = [0, 5, 12, 18, 28];

export const PAGE_SIZE = 10;

/** Categorical chart palette — validated for CVD separation (brand indigo in slot 1). */
export const CHART_COLORS = [
  "#635BFF",
  "#EB6834",
  "#1BAF7A",
  "#EDA100",
  "#E87BA4",
  "#2A78D6",
  "#008300",
];
