import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listApps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("apps")
      .select("id, name, api_key_prefix, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ name: z.string().min(1).max(80) }).parse(input))
  .handler(async ({ data, context }) => {
    const { generateApiKey } = await import("./api-key.server");
    const { plaintext, prefix, hash } = generateApiKey();
    const { data: row, error } = await context.supabase
      .from("apps")
      .insert({ name: data.name, owner_id: context.userId, api_key_prefix: prefix, api_key_hash: hash })
      .select("id, name, api_key_prefix, created_at")
      .single();
    if (error) throw new Error(error.message);
    return { app: row, apiKey: plaintext };
  });

export const deleteApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("apps").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listBalances = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ appId: z.string().uuid().optional() }).parse(input))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("coin_balances")
      .select("id, app_id, external_user_id, balance, updated_at, apps!inner(name)")
      .order("updated_at", { ascending: false })
      .limit(500);
    if (data.appId) q = q.eq("app_id", data.appId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ appId: z.string().uuid().optional() }).parse(input))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("coin_events")
      .select("id, app_id, external_user_id, delta, reason, created_at, apps!inner(name)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.appId) q = q.eq("app_id", data.appId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
