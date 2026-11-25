"use client";

import { useParams } from "next/navigation";
import { useInventory } from "@/context/InventoryContext";
import { PageHeader } from "@/components/ui/Primitives";
import { ProductForm } from "@/components/forms/ProductForm";
import { NotFoundState } from "@/components/ui/NotFoundState";

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const { state } = useInventory();
  const product = state.products.find((p) => p.id === id);
  if (!product) return <NotFoundState entity="Product" backHref="/products" />;
  return (
    <>
      <PageHeader title={`Edit ${product.name}`} description={`SKU ${product.sku}`} />
      <ProductForm product={product} />
    </>
  );
}
