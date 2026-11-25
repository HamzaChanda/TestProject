"use client";

import { PageHeader } from "@/components/ui/Primitives";
import { ProductForm } from "@/components/forms/ProductForm";

export default function NewProductPage() {
  return (
    <>
      <PageHeader title="Add product" description="Create a new product and record its opening stock." />
      <ProductForm />
    </>
  );
}
