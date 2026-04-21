/**
 * lib/db.ts — server-only database access wrapper.
 *
 * ALL database access in API routes and server components must go through
 * this module. Direct imports of supabaseAdmin are reserved for this file only.
 *
 * Features:
 *  - server-only guard: import in a 'use client' component → build error
 *  - automatic error logging on every query and RPC call
 *  - single import surface: `import { db } from "@/lib/db"`
 *
 * Usage:
 *   const { data, error } = await db.from("listings").select("id, title").eq("published", true);
 *   const { data, error } = await db.rpc("fn_name", { p_arg: value });
 *   const { error }       = await db.storage.from("bucket").upload(path, buffer, opts);
 */

import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

type DbError = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

function logDbError(context: string, error: DbError): void {
  const parts: string[] = [`[db:${context}]`];
  if (error.code)    parts.push(`code=${error.code}`);
  if (error.message) parts.push(error.message);
  if (error.details) parts.push(`| details: ${error.details}`);
  if (error.hint)    parts.push(`| hint: ${error.hint}`);
  console.error(parts.join(" "));
}

// ---------------------------------------------------------------------------
// Builder proxy
// ---------------------------------------------------------------------------

// Wraps any PostgREST builder (PostgrestQueryBuilder / PostgrestFilterBuilder /
// PostgrestTransformBuilder) so that when the chain finally executes — i.e.
// when `await` calls `.then()` — errors are automatically logged.
//
// The proxy is recursive: every chained method that returns another builder
// is also wrapped, so logging fires regardless of where in the chain `await` sits.

function wrapBuilder<T extends object>(builder: T, context: string): T {
  return new Proxy(builder, {
    get(target, prop) {
      const val = (target as Record<string | symbol, unknown>)[prop];

      // ── Intercept .then() ─────────────────────────────────────────────────
      // This is the execution point. Both `await expr` and
      // `expr.then(cb)` call `.then()` on the builder.
      if (prop === "then") {
        return function (
          onFulfilled?: (result: { data: unknown; error: DbError | null }) => unknown,
          onRejected?: (reason: unknown) => unknown
        ) {
          return (val as Function).call(
            target,
            (result: { data: unknown; error: DbError | null }) => {
              if (result?.error) {
                logDbError(context, result.error);
              }
              return onFulfilled ? onFulfilled(result) : result;
            },
            onRejected
          );
        };
      }

      // ── Pass .catch() and .finally() through ──────────────────────────────
      if (prop === "catch" || prop === "finally") {
        return typeof val === "function"
          ? (val as Function).bind(target)
          : val;
      }

      // ── Wrap all other methods ─────────────────────────────────────────────
      // Builder methods like .select(), .eq(), .order(), .limit(), .single(),
      // .maybeSingle(), .insert(), .update(), .delete(), .upsert() etc. all
      // return a new builder. Wrap the return value if it looks like a builder.
      if (typeof val !== "function") return val;

      return function (...args: unknown[]) {
        const result = (val as Function).apply(target, args);
        if (
          result != null &&
          typeof result === "object" &&
          ("then" in result || "select" in result)
        ) {
          return wrapBuilder(result as object, context);
        }
        return result;
      };
    },
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const db = {
  /**
   * Entry point for all table operations. Returns a PostgREST query builder
   * wrapped with automatic error logging.
   *
   * @example
   *   const { data } = await db.from("listings").select("id, title").eq("published", true);
   *   const { error } = await db.from("profiles").update({ bio }).eq("user_id", userId);
   *   const { data } = await db.from("bookings").insert({ ... }).select().single();
   */
  from(table: string) {
    return wrapBuilder(supabaseAdmin.from(table), table);
  },

  /**
   * Wraps supabaseAdmin.rpc() with automatic error logging.
   *
   * @example
   *   const { data, error } = await db.rpc("update_profile_physical", { p_user_id: userId });
   */
  rpc(fn: string, args?: Record<string, unknown>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return wrapBuilder(supabaseAdmin.rpc(fn, args as any), `rpc:${fn}`);
  },

  /**
   * Supabase Storage. Upload, download and URL operations are not PostgREST
   * builders — pass errors through to the caller as-is.
   *
   * @example
   *   const { error } = await db.storage.from("listing-images").upload(path, buffer, opts);
   *   const { data }  = db.storage.from("listing-images").getPublicUrl(path);
   */
  storage: supabaseAdmin.storage,
};
