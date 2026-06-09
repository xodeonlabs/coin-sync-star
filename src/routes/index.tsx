import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Coins, KeyRound, RefreshCw, Shield } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Coin Sync — One coin balance across all your apps" },
      { name: "description", content: "Sync per-user coin balances across every connected app with a single API." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            <span className="font-semibold">Coin Sync</span>
          </div>
          <div className="flex gap-2">
            <Link to="/shop"><Button size="sm" variant="outline">Shop</Button></Link>
            <Link to="/auth"><Button size="sm">Sign in</Button></Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-20 space-y-20">
        <section className="max-w-2xl mx-auto text-center space-y-6">
          <h1 className="text-5xl font-bold tracking-tight">One coin balance across all your apps.</h1>
          <p className="text-lg text-muted-foreground">Register each of your apps, get an API key, and sync per-user coins to one central database.</p>
          <div className="flex justify-center gap-3">
            <Link to="/auth"><Button size="lg">Get started</Button></Link>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-3 max-w-4xl mx-auto">
          <Feature icon={KeyRound} title="API key per app" desc="Each connected app gets its own key. Revoke any time." />
          <Feature icon={RefreshCw} title="Real-time sync" desc="Add, subtract, or set balances with a single HTTP call." />
          <Feature icon={Shield} title="Secure by default" desc="Keys are hashed. Only you can read your apps' data." />
        </section>
      </main>
    </div>
  );
}

function Feature({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <div className="space-y-2">
      <Icon className="h-6 w-6 text-primary" />
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}
