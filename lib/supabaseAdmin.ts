// INTERNAL — import from "@/lib/db" in application code, not this file directly.
// The server-only import ensures the service role key never reaches the client bundle.
import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Lazy proxy — the real client is created only on first method call,
// not at module import time. This avoids build-time errors when the
// env var is absent during static analysis or CI.
let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("[supabaseAdmin] NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set");
    }
    _client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _client;
}

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_, prop: string | symbol) {
    return (getClient() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
