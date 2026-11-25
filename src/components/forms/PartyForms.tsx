"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Customer, Supplier } from "@/types";
import { useInventory } from "@/context/InventoryContext";
import { customerSchema, supplierSchema, type CustomerFormValues, type SupplierFormValues } from "@/lib/validations";
import { SlideOver } from "@/components/ui/Overlay";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { useSubmitGuard } from "@/hooks/useSubmitGuard";

const emptyCustomer: CustomerFormValues = { name: "", company: "", email: "", phone: "", city: "", address: "", gstin: "" };

/** Only the editable fields, so ids or derived stats never leak into the form. */
function pickCustomerFields(c: Customer): CustomerFormValues {
  return { name: c.name, company: c.company, email: c.email, phone: c.phone, city: c.city, address: c.address, gstin: c.gstin };
}
function pickSupplierFields(s: Supplier): SupplierFormValues {
  return { name: s.name, contactPerson: s.contactPerson, email: s.email, phone: s.phone, city: s.city, address: s.address, gstin: s.gstin, paymentTerms: s.paymentTerms };
}

export function CustomerFormPanel({
  open,
  onClose,
  customer,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  customer?: Customer | null;
  onSaved?: (c: Customer) => void;
}) {
  const { actions } = useInventory();
  const { guard, release } = useSubmitGuard();
  const { register, handleSubmit, reset, formState } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: emptyCustomer,
  });
  const errors = formState.errors;

  useEffect(() => {
    if (open) {
      reset(customer ? pickCustomerFields(customer) : emptyCustomer);
      release();
    }
  }, [open, customer, reset, release]);

  const onSubmit = (v: CustomerFormValues) =>
    guard(() => {
      const saved = customer ? actions.updateCustomer(customer.id, v) : actions.addCustomer(v);
      if (saved) {
        onSaved?.(saved);
        onClose();
      }
      return saved;
    });

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={customer ? "Edit customer" : "Add customer"}
      description={customer ? customer.name : "Customers can be selected when creating sales."}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)}>{customer ? "Save changes" : "Add customer"}</Button>
        </>
      }
    >
      <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
        <Field label="Full name" required error={errors.name?.message}>
          <Input placeholder="e.g. Rohan Sharma" {...register("name")} invalid={!!errors.name} />
        </Field>
        <Field label="Company" error={errors.company?.message}>
          <Input placeholder="Business name (optional)" {...register("company")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" required error={errors.email?.message}>
            <Input type="email" placeholder="name@company.in" {...register("email")} invalid={!!errors.email} />
          </Field>
          <Field label="Phone" required error={errors.phone?.message}>
            <Input type="tel" placeholder="+91 98765 43210" {...register("phone")} invalid={!!errors.phone} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="City" error={errors.city?.message}>
            <Input placeholder="Mumbai" {...register("city")} />
          </Field>
          <Field label="GSTIN" error={errors.gstin?.message}>
            <Input placeholder="27AAKFS4521M1Z3" className="font-mono uppercase" {...register("gstin")} invalid={!!errors.gstin} />
          </Field>
        </div>
        <Field label="Billing address" error={errors.address?.message}>
          <Textarea rows={3} {...register("address")} />
        </Field>
      </form>
    </SlideOver>
  );
}

const emptySupplier: SupplierFormValues = { name: "", contactPerson: "", email: "", phone: "", city: "", address: "", gstin: "", paymentTerms: "Net 30" };

export function SupplierFormPanel({ open, onClose, supplier }: { open: boolean; onClose: () => void; supplier?: Supplier | null }) {
  const { actions } = useInventory();
  const { guard, release } = useSubmitGuard();
  const { register, handleSubmit, reset, formState } = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: emptySupplier,
  });
  const errors = formState.errors;

  useEffect(() => {
    if (open) {
      reset(supplier ? pickSupplierFields(supplier) : emptySupplier);
      release();
    }
  }, [open, supplier, reset, release]);

  const onSubmit = (v: SupplierFormValues) =>
    guard(() => {
      const saved = supplier ? actions.updateSupplier(supplier.id, v) : actions.addSupplier(v);
      if (saved) onClose();
      return saved;
    });

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={supplier ? "Edit supplier" : "Add supplier"}
      description={supplier ? supplier.name : "Suppliers are used on purchase orders."}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)}>{supplier ? "Save changes" : "Add supplier"}</Button>
        </>
      }
    >
      <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
        <Field label="Supplier name" required error={errors.name?.message}>
          <Input placeholder="e.g. Logicore Distributors Pvt. Ltd." {...register("name")} invalid={!!errors.name} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contact person" required error={errors.contactPerson?.message}>
            <Input placeholder="Full name" {...register("contactPerson")} invalid={!!errors.contactPerson} />
          </Field>
          <Field label="Payment terms" required error={errors.paymentTerms?.message}>
            <Select {...register("paymentTerms")}>
              {["Advance", "Net 15", "Net 30", "Net 45", "Net 60"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" required error={errors.email?.message}>
            <Input type="email" placeholder="orders@supplier.in" {...register("email")} invalid={!!errors.email} />
          </Field>
          <Field label="Phone" required error={errors.phone?.message}>
            <Input type="tel" placeholder="+91 22 4000 1234" {...register("phone")} invalid={!!errors.phone} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="City" error={errors.city?.message}>
            <Input {...register("city")} />
          </Field>
          <Field label="GSTIN" error={errors.gstin?.message}>
            <Input className="font-mono uppercase" {...register("gstin")} invalid={!!errors.gstin} />
          </Field>
        </div>
        <Field label="Address" error={errors.address?.message}>
          <Textarea rows={3} {...register("address")} />
        </Field>
      </form>
    </SlideOver>
  );
}
