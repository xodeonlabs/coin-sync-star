import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listApps, createApp, deleteApp, listBalances, listEvents } from "@/lib/apps.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Coins, Plus, Trash2, Copy, LogOut, KeyRound } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Coin Sync" }] }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchApps = useServerFn(listApps);
  const fetchBalances = useServerFn(listBalances);
  const fetchEvents = useServerFn(listEvents);
  const createFn = useServerFn(createApp);
  const deleteFn = useServerFn(deleteApp);

  const [newKey, setNewKey] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [open, setOpen] = useState(false);

  const apps = useQuery({ queryKey: ["apps"], queryFn: () => fetchApps() });
  const balances = useQuery({ queryKey: ["balances"], queryFn: () => fetchBalances({ data: {} }) });
  const events = useQuery({ queryKey: ["events"], queryFn: () => fetchEvents({ data: {} }) });

  const createM = useMutation({
    mutationFn: (name: string) => createFn({ data: { name } }),
    onSuccess: (res) => {
      setNewKey(res.apiKey);
      setNewName("");
      qc.invalidateQueries({ queryKey: ["apps"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["apps"] });
      qc.invalidateQueries({ queryKey: ["balances"] });
      qc.invalidateQueries({ queryKey: ["events"] });
      toast.success("App deleted");
    },
  });

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const totalCoins = (balances.data ?? []).reduce((s, b) => s + Number(b.balance), 0);
  const totalUsers = new Set((balances.data ?? []).map((b) => b.external_user_id)).size;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            <span className="font-semibold">Coin Sync</span>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label="Connected apps" value={apps.data?.length ?? 0} />
          <StatCard label="Tracked users" value={totalUsers} />
          <StatCard label="Total coins" value={totalCoins.toLocaleString()} />
        </div>

        <Tabs defaultValue="apps">
          <TabsList>
            <TabsTrigger value="apps">Apps</TabsTrigger>
            <TabsTrigger value="balances">Balances</TabsTrigger>
            <TabsTrigger value="events">Activity</TabsTrigger>
            <TabsTrigger value="api">API</TabsTrigger>
          </TabsList>

          <TabsContent value="apps" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle>Your apps</CardTitle>
                  <CardDescription>Each app gets its own API key for syncing coins.</CardDescription>
                </div>
                <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> New app</Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>API key</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-40 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(apps.data ?? []).map((a) => {
                      const key = (a as { api_key_plaintext: string | null }).api_key_plaintext;
                      return (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium">{a.name}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{a.api_key_prefix}…</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{new Date(a.created_at).toLocaleDateString()}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="outline" disabled={!key} onClick={() => { if (key) { navigator.clipboard.writeText(key); toast.success("Key copied"); } }}>
                                <Copy className="h-3 w-3 mr-1" /> Key
                              </Button>
                              <Button size="sm" variant="outline" disabled={!key} onClick={() => { if (key) { navigator.clipboard.writeText(buildAiPrompt(key, typeof window !== "undefined" ? window.location.origin : "")); toast.success("Prompt copied"); } }}>
                                <Copy className="h-3 w-3 mr-1" /> Prompt
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete this app and all its coin data?")) deleteM.mutate(a.id); }}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {apps.data?.length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No apps yet. Create one to get your first API key.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="balances">
            <Card>
              <CardHeader><CardTitle>Coin balances per user</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>App</TableHead>
                      <TableHead>User ID</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead>Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(balances.data ?? []).map((b) => (
                      <TableRow key={b.id}>
                        <TableCell>{(b.apps as { name: string }).name}</TableCell>
                        <TableCell className="font-mono text-xs">{b.external_user_id}</TableCell>
                        <TableCell className="text-right font-semibold">{Number(b.balance).toLocaleString()}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{new Date(b.updated_at).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    {balances.data?.length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No balances yet.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="events">
            <Card>
              <CardHeader><CardTitle>Recent activity</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>App</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead className="text-right">Δ</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(events.data ?? []).map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="text-muted-foreground text-sm">{new Date(e.created_at).toLocaleString()}</TableCell>
                        <TableCell>{(e.apps as { name: string }).name}</TableCell>
                        <TableCell className="font-mono text-xs">{e.external_user_id}</TableCell>
                        <TableCell className={`text-right font-semibold ${Number(e.delta) >= 0 ? "text-primary" : "text-destructive"}`}>
                          {Number(e.delta) >= 0 ? "+" : ""}{Number(e.delta)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{e.reason ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                    {events.data?.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No activity yet.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="api">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" /> API reference</CardTitle>
                <CardDescription>Use your app's API key in the <code>x-api-key</code> header.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <p className="font-semibold mb-1">Add or subtract coins</p>
                  <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">{`POST ${typeof window !== "undefined" ? window.location.origin : ""}/api/public/coins
x-api-key: csk_xxx
Content-Type: application/json

{ "external_user_id": "user_123", "delta": 10, "reason": "level up" }`}</pre>
                </div>
                <div>
                  <p className="font-semibold mb-1">Set absolute balance</p>
                  <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">{`POST /api/public/coins
{ "external_user_id": "user_123", "set": 500 }`}</pre>
                </div>
                <div>
                  <p className="font-semibold mb-1">Read balances</p>
                  <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">{`GET /api/public/coins
GET /api/public/coins?external_user_id=user_123`}</pre>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setNewKey(null); }}>
        <DialogContent>
          {newKey ? (
            <>
              <DialogHeader>
                <DialogTitle>Your API key</DialogTitle>
                <DialogDescription>Copy this now — you won't see it again.</DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted p-3 rounded text-xs break-all">{newKey}</code>
                <Button size="icon" variant="outline" onClick={() => { navigator.clipboard.writeText(newKey); toast.success("Copied"); }}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Complete AI integration prompt</p>
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(buildAiPrompt(newKey, typeof window !== "undefined" ? window.location.origin : "")); toast.success("Prompt copied"); }}>
                    <Copy className="h-4 w-4 mr-1" /> Copy prompt
                  </Button>
                </div>
                <pre className="bg-muted p-3 rounded text-xs max-h-64 overflow-auto whitespace-pre-wrap">{buildAiPrompt(newKey, typeof window !== "undefined" ? window.location.origin : "")}</pre>
              </div>
              <DialogFooter>
                <Button onClick={() => { setOpen(false); setNewKey(null); }}>Done</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Create a new app</DialogTitle>
                <DialogDescription>Give it a name. You'll get a fresh API key.</DialogDescription>
              </DialogHeader>
              <Input placeholder="App name" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={() => createM.mutate(newName)} disabled={!newName.trim() || createM.isPending}>
                  {createM.isPending ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-3xl font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}

function buildAiPrompt(apiKey: string, origin: string) {
  const base = origin || "https://YOUR-APP.lovable.app";
  return `You are integrating my app with the Coin Sync API. Use it to store and read per-user coin balances.

BASE URL: ${base}
ENDPOINT: ${base}/api/public/coins
AUTH HEADER (keep secret, server-side only): x-api-key: ${apiKey}

# Add or subtract coins (delta can be negative)
POST /api/public/coins
Headers: { "x-api-key": "${apiKey}", "Content-Type": "application/json" }
Body: { "external_user_id": "<your user id>", "delta": 10, "reason": "level up" }
Response: { "external_user_id": "...", "balance": 123 }

# Set absolute balance
POST /api/public/coins
Body: { "external_user_id": "<your user id>", "set": 500 }

# Read all balances for this app
GET /api/public/coins
Headers: { "x-api-key": "${apiKey}" }
Response: { "balances": [{ "external_user_id": "...", "balance": 123, "updated_at": "..." }] }

# Read one user's balance
GET /api/public/coins?external_user_id=<your user id>

Rules:
- Never expose the x-api-key in client/browser code; only call this API from your server/backend.
- external_user_id is whatever stable user identifier your app already uses.
- delta must be an integer; balance can not go below 0 unless you explicitly use "set".
- On 401: invalid key. On 400: invalid body. On 500: server error — retry with backoff.

Please generate the integration code for my stack and wire it into the user actions that should earn or spend coins.`;
}
