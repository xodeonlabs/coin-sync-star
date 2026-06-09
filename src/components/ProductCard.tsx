import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useCartStore } from "@/stores/cartStore";
import type { ShopifyProduct } from "@/lib/shopify";

export function ProductCard({ product }: { product: ShopifyProduct }) {
  const addItem = useCartStore((s) => s.addItem);
  const isLoading = useCartStore((s) => s.isLoading);
  const variant = product.node.variants.edges[0]?.node;
  const image = product.node.images.edges[0]?.node;

  const handleAdd = async () => {
    if (!variant) return;
    await addItem({
      product,
      variantId: variant.id,
      variantTitle: variant.title,
      price: variant.price,
      quantity: 1,
      selectedOptions: variant.selectedOptions || [],
    });
  };

  return (
    <div className="group rounded-lg border bg-card overflow-hidden flex flex-col">
      <Link to="/product/$handle" params={{ handle: product.node.handle }} className="aspect-square bg-muted overflow-hidden">
        {image ? (
          <img src={image.url} alt={image.altText ?? product.node.title} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">No image</div>
        )}
      </Link>
      <div className="p-4 flex flex-col gap-3 flex-1">
        <Link to="/product/$handle" params={{ handle: product.node.handle }} className="font-medium hover:underline">
          {product.node.title}
        </Link>
        <p className="text-sm text-muted-foreground line-clamp-2 flex-1">{product.node.description}</p>
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold">
            {product.node.priceRange.minVariantPrice.currencyCode}{" "}
            {parseFloat(product.node.priceRange.minVariantPrice.amount).toFixed(2)}
          </span>
          <Button size="sm" onClick={handleAdd} disabled={isLoading || !variant}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add to Cart"}
          </Button>
        </div>
      </div>
    </div>
  );
}
