import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Coins, Loader2 } from "lucide-react";
import { storefrontApiRequest, PRODUCT_BY_HANDLE_QUERY } from "@/lib/shopify";
import { CartDrawer } from "@/components/CartDrawer";
import { useCartStore } from "@/stores/cartStore";
import { useCartSync } from "@/hooks/useCartSync";

export const Route = createFileRoute("/_authenticated/product/$handle")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.handle} — Coin Sync Shop` },
      { name: "description", content: `Buy ${params.handle} in the Coin Sync shop.` },
    ],
  }),
  component: ProductPage,
  errorComponent: ({ error, reset }) => (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <p className="text-destructive">{error.message}</p>
        <Button onClick={reset}>Retry</Button>
      </div>
    </div>
  ),
  notFoundComponent: () => <div className="p-10 text-center">Product not found</div>,
});

function ProductPage() {
  useCartSync();
  const { handle } = Route.useParams();
  const addItem = useCartStore((s) => s.addItem);
  const isLoading = useCartStore((s) => s.isLoading);

  const { data, isLoading: loading } = useQuery({
    queryKey: ["shopify-product", handle],
    queryFn: async () => {
      const res = await storefrontApiRequest(PRODUCT_BY_HANDLE_QUERY, { handle });
      return res?.data?.product;
    },
  });

  if (loading) {
    return (
      <div className="min-h-screen flex justify-center items-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!data) return <div className="p-10 text-center">Product not found</div>;

  const variant = data.variants.edges[0]?.node;
  const image = data.images.edges[0]?.node;

  const handleAdd = async () => {
    if (!variant) return;
    await addItem({
      product: { node: data },
      variantId: variant.id,
      variantTitle: variant.title,
      price: variant.price,
      quantity: 1,
      selectedOptions: variant.selectedOptions || [],
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/shop" className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            <span className="font-semibold">Coin Sync</span>
          </Link>
          <CartDrawer />
        </div>
      </header>
      <main className="container mx-auto px-4 py-12 grid md:grid-cols-2 gap-12 max-w-5xl">
        <div className="aspect-square bg-muted rounded-lg overflow-hidden">
          {image && <img src={image.url} alt={image.altText ?? data.title} className="w-full h-full object-cover" />}
        </div>
        <div className="space-y-6">
          <Link to="/shop" className="text-sm text-muted-foreground hover:underline">
            ← Back to shop
          </Link>
          <h1 className="text-3xl font-bold">{data.title}</h1>
          <p className="text-2xl font-semibold">
            {variant?.price.currencyCode} {parseFloat(variant?.price.amount ?? "0").toFixed(2)}
          </p>
          <p className="text-muted-foreground whitespace-pre-line">{data.description}</p>
          <Button size="lg" onClick={handleAdd} disabled={isLoading || !variant}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add to Cart"}
          </Button>
        </div>
      </main>
    </div>
  );
}
