/**
 * Pure calculations shared by the transaction engine, selectors and UI.
 * Keeping them in one place guarantees that what a form previews is
 * exactly what the engine records.
 */
import type { DiscountType, Product, StockStatus } from "@/types";
import { round2 } from "./utils";

export function totalStock(product: Pick<Product, "stock">) {
  return Object.values(product.stock).reduce((sum, q) => sum + q, 0);
}

export function stockStatus(qty: number, minStock: number): StockStatus {
  if (qty <= 0) return "Out of Stock";
  if (qty <= minStock) return "Low Stock";
  return "In Stock";
}

export function productStatus(product: Product): StockStatus {
  return stockStatus(totalStock(product), product.minStock);
}

export function stockValue(product: Product) {
  return totalStock(product) * product.costPrice;
}

export interface LineInput {
  quantity: number;
  price: number;
}

export function lineTotal(quantity: number, price: number) {
  return round2((Number(quantity) || 0) * (Number(price) || 0));
}

export interface SaleTotals {
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  taxAmount: number;
  total: number;
}

export function computeSaleTotals(
  lines: LineInput[],
  discountType: DiscountType,
  discountValue: number,
  taxRate: number,
): SaleTotals {
  const subtotal = round2(lines.reduce((s, l) => s + lineTotal(l.quantity, l.price), 0));
  const rawDiscount =
    discountType === "percent"
      ? (subtotal * Math.min(Math.max(discountValue || 0, 0), 100)) / 100
      : Math.max(discountValue || 0, 0);
  const discountAmount = round2(Math.min(rawDiscount, subtotal));
  const taxableAmount = round2(subtotal - discountAmount);
  const taxAmount = round2((taxableAmount * Math.max(taxRate || 0, 0)) / 100);
  return { subtotal, discountAmount, taxableAmount, taxAmount, total: round2(taxableAmount + taxAmount) };
}

export function computePurchaseTotals(lines: LineInput[], taxRate: number) {
  const subtotal = round2(lines.reduce((s, l) => s + lineTotal(l.quantity, l.price), 0));
  const taxAmount = round2((subtotal * Math.max(taxRate || 0, 0)) / 100);
  return { subtotal, taxAmount, total: round2(subtotal + taxAmount) };
}
