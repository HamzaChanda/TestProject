import { z } from "zod";

const num = (label: string) =>
  z.number({ invalid_type_error: `${label} is required`, required_error: `${label} is required` });

export const productSchema = z
  .object({
    name: z.string().trim().min(2, "Product name must be at least 2 characters").max(80),
    sku: z
      .string()
      .trim()
      .min(3, "SKU must be at least 3 characters")
      .max(24, "SKU is too long")
      .regex(/^[A-Za-z0-9-_]+$/, "Use letters, numbers, dashes or underscores only"),
    category: z.string().min(1, "Select a category"),
    description: z.string().max(400, "Keep the description under 400 characters"),
    unit: z.string().min(1, "Select a unit"),
    sellingPrice: num("Selling price").min(0, "Price cannot be negative"),
    costPrice: num("Purchase price").min(0, "Price cannot be negative"),
    openingStock: num("Opening stock").int("Use a whole number").min(0, "Cannot be negative"),
    minStock: num("Minimum stock").int("Use a whole number").min(0, "Cannot be negative"),
    supplierId: z.string(),
  });
export type ProductFormValues = z.infer<typeof productSchema>;

const phone = z
  .string()
  .trim()
  .min(1, "Phone is required")
  .regex(/^[+\d][\d\s-]{7,16}$/, "Enter a valid phone number");

export const customerSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  company: z.string().trim().max(80),
  email: z.string().trim().email("Enter a valid email"),
  phone,
  city: z.string().trim().max(40),
  address: z.string().trim().max(200),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === "" || /^[0-9]{2}[A-Z0-9]{13}$/.test(v), "GSTIN must be 15 characters"),
});
export type CustomerFormValues = z.infer<typeof customerSchema>;

export const supplierSchema = customerSchema.omit({ company: true }).extend({
  contactPerson: z.string().trim().min(2, "Contact person is required"),
  paymentTerms: z.string().min(1, "Select payment terms"),
});
export type SupplierFormValues = z.infer<typeof supplierSchema>;

const lineSchema = z.object({
  productId: z.string().min(1, "Select a product"),
  quantity: num("Quantity").int("Whole numbers only").positive("Must be at least 1"),
  price: num("Price").min(0, "Cannot be negative"),
});

export const saleSchema = z
  .object({
    customerId: z.string().min(1, "Select a customer"),
    date: z.string().min(1, "Select a date"),
    warehouseId: z.string().min(1),
    items: z.array(lineSchema).min(1, "Add at least one product"),
    discountType: z.enum(["percent", "amount"]),
    discountValue: num("Discount").min(0, "Cannot be negative"),
    taxRate: num("Tax rate").min(0).max(100, "Max 100%"),
    paymentMethod: z.enum(["Cash", "UPI", "Card", "Bank Transfer", "Credit"]),
    paymentStatus: z.enum(["Paid", "Partial", "Unpaid"]),
    amountPaid: z.number().optional(),
    orderStatus: z.enum(["Completed", "Pending"]),
    notes: z.string().max(500),
  })
  .refine((v) => v.discountType !== "percent" || v.discountValue <= 100, {
    message: "Max 100%",
    path: ["discountValue"],
  });
export type SaleFormValues = z.infer<typeof saleSchema>;

export const purchaseSchema = z
  .object({
    supplierId: z.string().min(1, "Select a supplier"),
    orderDate: z.string().min(1, "Order date is required"),
    expectedDate: z.string().min(1, "Expected date is required"),
    warehouseId: z.string().min(1),
    items: z.array(lineSchema).min(1, "Add at least one product"),
    taxRate: num("Tax rate").min(0).max(100),
    notes: z.string().max(500),
  })
  .refine((v) => v.expectedDate >= v.orderDate, {
    message: "Must be on or after the order date",
    path: ["expectedDate"],
  });
export type PurchaseFormValues = z.infer<typeof purchaseSchema>;

export const adjustmentSchema = z.object({
  productId: z.string().min(1, "Select a product"),
  warehouseId: z.string().min(1, "Select a warehouse"),
  direction: z.enum(["increase", "decrease"]),
  quantity: num("Quantity").int("Whole numbers only").positive("Must be at least 1"),
  reason: z.string().min(1, "Select a reason"),
  notes: z.string().max(300),
});
export type AdjustmentFormValues = z.infer<typeof adjustmentSchema>;

export const transferSchema = z
  .object({
    productId: z.string().min(1, "Select a product"),
    fromWarehouseId: z.string().min(1, "Select source"),
    toWarehouseId: z.string().min(1, "Select destination"),
    quantity: num("Quantity").int("Whole numbers only").positive("Must be at least 1"),
    completeNow: z.boolean(),
    notes: z.string().max(300),
  })
  .refine((v) => v.fromWarehouseId !== v.toWarehouseId, {
    message: "Destination must differ from source",
    path: ["toWarehouseId"],
  });
export type TransferFormValues = z.infer<typeof transferSchema>;

export const settingsSchema = z.object({
  businessName: z.string().trim().min(2, "Business name is required").max(60),
  legalName: z.string().trim().max(80),
  email: z.string().trim().email("Enter a valid email"),
  phone: z.string().trim().max(24),
  address: z.string().trim().max(200),
  gstin: z.string().trim().max(15),
  invoicePrefix: z.string().trim().min(2).max(6).regex(/^[A-Z]+$/, "Uppercase letters only"),
  purchasePrefix: z.string().trim().min(2).max(6).regex(/^[A-Z]+$/, "Uppercase letters only"),
});
export type SettingsFormValues = z.infer<typeof settingsSchema>;
