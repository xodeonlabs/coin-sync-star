import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createHash } from "crypto";

const BodySchema = z.object({
  external_user_id: z.string().min(1).max(255),
  email: z.string().email().max(255).optional(),
  delta: z.number().int().optional(),
  set: z.number().int().min(0).optional(),
  reason: z.string().max(255).optional(),
});

async function authApp(request: Request) {
  const key = request.headers.get("x-api-key") ?? "";
  if (!key.startsWith("csk_")) return { error: "Missing or invalid x-api-key", status: 401 as const };
  const hash = createHash("sha256").update(key).digest("hex");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("apps").select("id, owner_id").eq("api_key_hash", hash).maybeSingle();
  if (error || !data) return { error: "Invalid API key", status: 401 as const };
  return { app: data, supabaseAdmin };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key",
};

export const Route = createFileRoute("/api/public/coins")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),

      GET: async ({ request }) => {
        const auth = await authApp(request);
        if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status, headers: corsHeaders });
        const url = new URL(request.url);
        const externalUserIdRaw = url.searchParams.get("external_user_id");
        const ids = externalUserIdRaw
          ? externalUserIdRaw.split(",").map((s) => s.trim()).filter(Boolean)
          : [];
        let q = auth.supabaseAdmin
          .from("coin_balances")
          .select("external_user_id, email, balance, updated_at")
          .eq("app_id", auth.app.id);
        if (ids.length === 1) q = q.eq("external_user_id", ids[0]);
        else if (ids.length > 1) q = q.in("external_user_id", ids);
        const { data, error } = await q;
        if (error) return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
        return Response.json({ balances: data }, { headers: corsHeaders });
      },

      POST: async ({ request }) => {
        const auth = await authApp(request);
        if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status, headers: corsHeaders });
        let body: unknown;
        try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders }); }
        const parsed = BodySchema.safeParse(body);
        if (!parsed.success) return Response.json({ error: parsed.error.message }, { status: 400, headers: corsHeaders });
        const { delta, set, reason } = parsed.data;
        const email = parsed.data.email?.trim().toLowerCase() || null;
        // When email is provided, use a canonical id so the same person shares
        // one balance across every app.
        const external_user_id = email ? `email:${email}` : parsed.data.external_user_id;
        if (delta === undefined && set === undefined) {
          return Response.json({ error: "Provide 'delta' or 'set'" }, { status: 400, headers: corsHeaders });
        }

        const { supabaseAdmin } = auth;

        // Current balance: when email is given, share across ALL apps for the
        // same canonical id (use the most recently updated row as truth).
        let currentBalance = 0;
        if (email) {
          const { data: shared } = await supabaseAdmin
            .from("coin_balances")
            .select("balance, updated_at")
            .eq("external_user_id", external_user_id)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          currentBalance = shared?.balance ?? 0;
        } else {
          const { data: existing } = await supabaseAdmin
            .from("coin_balances")
            .select("balance")
            .eq("app_id", auth.app.id)
            .eq("external_user_id", external_user_id)
            .maybeSingle();
          currentBalance = existing?.balance ?? 0;
        }

        const newBalance = set !== undefined ? set : currentBalance + (delta ?? 0);
        const actualDelta = newBalance - currentBalance;

        const upsert = await supabaseAdmin
          .from("coin_balances")
          .upsert(
            { app_id: auth.app.id, external_user_id, email, balance: newBalance, updated_at: new Date().toISOString() },
            { onConflict: "app_id,external_user_id" },
          )
          .select("balance")
          .single();
        if (upsert.error) return Response.json({ error: upsert.error.message }, { status: 500, headers: corsHeaders });

        // Sync the new balance to every other app's row for this email so all
        // connected apps see the same total.
        if (email) {
          await supabaseAdmin
            .from("coin_balances")
            .update({ balance: newBalance, email, updated_at: new Date().toISOString() })
            .eq("external_user_id", external_user_id)
            .neq("app_id", auth.app.id);
        }

        if (actualDelta !== 0) {
          await supabaseAdmin.from("coin_events").insert({
            app_id: auth.app.id,
            external_user_id,
            email,
            delta: actualDelta,
            reason: reason ?? null,
          });
        }

        return Response.json({ external_user_id, email, balance: upsert.data.balance }, { headers: corsHeaders });
      },
    },
  },
});
