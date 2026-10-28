"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { createFormDraftQueue, draftContentFingerprint, draftFingerprint, mergeFormDraft, validFormDraftData } from "@/lib/form-draft";
import { useFormNavigation } from "@/contexts/FormDraftContext";

export type FormDraftStatus = "loading" | "idle" | "pending" | "saving" | "saved" | "error";
type Options<T> = { formKey: string; value: T; restore: (value: T) => void; ready?: boolean; enabled?: boolean; busy?: boolean };

async function request(url: string, options?: RequestInit) {
  const response = await fetch(url, { ...options, cache: "no-store", signal: AbortSignal.timeout(12_000) });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.code === "conflict" ? "conflict" : "unavailable");
  return json;
}

/** Account-scoped private recovery. Never calls any publication endpoint. */
export function useFormDraft<T extends Record<string, unknown>>({ formKey, value, restore, ready = true, enabled = true, busy = false }: Options<T>) {
  const { userId, isLoaded } = useAuth();
  const { register, notify } = useFormNavigation();
  const id = useRef(Symbol("form-draft"));
  const latest = useRef({ value, restore, busy });
  useLayoutEffect(() => { latest.current = { value, restore, busy }; });
  const initial = useRef({ formKey, ready, fingerprint: draftFingerprint(value) });
  const userEdited = useRef(false);
  useLayoutEffect(() => {
    if (initial.current.formKey !== formKey || ready && !initial.current.ready) {
      initial.current = { formKey, ready, fingerprint: draftFingerprint(value) };
      userEdited.current = false;
    } else initial.current.ready = ready;
  });
  useEffect(() => {
    const edited = (event: Event) => { if (event.isTrusted) userEdited.current = true; };
    document.addEventListener("input", edited, true); document.addEventListener("change", edited, true);
    return () => { document.removeEventListener("input", edited, true); document.removeEventListener("change", edited, true); };
  }, []);
  const [status, setStatus] = useState<FormDraftStatus>("loading");
  const [error, setError] = useState("");
  const [loadedFor, setLoadedFor] = useState("");
  const [ackRevision, setAckRevision] = useState(0);
  const owner = userId ? `${userId}:${formKey}` : "";
  const queue = useRef<ReturnType<typeof createFormDraftQueue> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopped = useRef(false);
  const loadedOwner = useRef("");
  const loadingBaseline = useRef("");
  const pendingRestore = useRef<string | null>(null);
  const conflict = useRef(false);
  const fingerprint = draftFingerprint(value);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    if (!isLoaded || !userId || !ready || !enabled) return;
    let active = true;
    loadingBaseline.current = initial.current.fingerprint;
    stopped.current = false; conflict.current = false; loadedOwner.current = "";
    queueMicrotask(() => { if (active) { setStatus("loading"); setError(""); } });
    const ownUser = userId;
    const ownKey = formKey;
    const q = createFormDraftQueue(async (snapshot, revision) => {
      // A detached controller may finish its original owner's request, but is
      // never reused by a different session or form.
      if (!active && snapshot !== null) throw new Error("session_changed");
      const result = await request("/api/form-drafts", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: ownKey, data: snapshot, revision, account: ownUser }) });
      return { revision: result.revision, data: snapshot };
    });
    queue.current = q;
    void request(`/api/form-drafts?key=${encodeURIComponent(formKey)}`, { headers: { "X-Draft-Account": ownUser } }).then(result => {
      if (!active || stopped.current || ownUser !== userId) return;
      const restored = result.data;
      // Do not overwrite input made while a slow draft read was in flight.
      if (userEdited.current && draftFingerprint(latest.current.value) !== loadingBaseline.current) {
        conflict.current = !!restored;
        q.load(restored ?? JSON.parse(loadingBaseline.current), result.revision);
        loadedOwner.current = owner; setLoadedFor(owner); setError(restored ? "conflict" : ""); setStatus(restored ? "error" : "pending");
        return;
      }
      if (restored && validFormDraftData(restored)) {
        const compatible = mergeFormDraft(latest.current.value, restored);
        q.load(compatible, result.revision);
        pendingRestore.current = String(result.revision);
        latest.current.restore(compatible);
        setStatus("saved");
      } else { q.load(latest.current.value, result.revision); setStatus("idle"); }
      loadedOwner.current = owner; setLoadedFor(owner);
    }).catch(cause => { if (active) { setError(cause.message); setStatus("error"); } });
    return () => {
      active = false; stopped.current = true; if (timer.current) clearTimeout(timer.current);
    };
  }, [formKey, userId, isLoaded, ready, enabled, owner, loadAttempt]);

  const unsafe = useCallback(() => !!owner && enabled && ready && !stopped.current
    && (latest.current.busy || (loadedOwner.current !== owner
      ? !!loadingBaseline.current && draftContentFingerprint(latest.current.value) !== draftContentFingerprint(JSON.parse(loadingBaseline.current))
      : draftContentFingerprint(latest.current.value) !== draftContentFingerprint(queue.current?.confirmed()))), [enabled, ready, owner]);
  const flush = useCallback(async () => {
    if (!owner || !enabled || stopped.current) return true;
    if (latest.current.busy || conflict.current || loadedOwner.current !== owner || !queue.current || pendingRestore.current) return false;
    if (timer.current) clearTimeout(timer.current);
    setStatus("saving"); setError("");
    try {
      const snapshot = latest.current.value;
      if (!validFormDraftData(snapshot)) throw new Error("invalid");
      const ownQueue = queue.current;
      await ownQueue.save(snapshot);
      if (ownQueue !== queue.current || loadedOwner.current !== owner) return false;
      const saved = queue.current.isSaved(latest.current.value) && !latest.current.busy;
      if (!stopped.current) { setAckRevision(revision => revision + 1); setStatus(saved ? "saved" : "pending"); }
      return saved;
    } catch (cause) {
      if (cause instanceof Error && cause.message === "conflict") conflict.current = true;
      if (!stopped.current) { setStatus("error"); setError(cause instanceof Error ? cause.message : "unavailable"); }
      return false;
    }
  }, [enabled, owner]);

  useEffect(() => {
    if (!enabled || !ready || loadedFor !== owner || stopped.current || conflict.current) return;
    if (pendingRestore.current) {
      queue.current?.load(latest.current.value, Number(pendingRestore.current));
      pendingRestore.current = null;
    }
    if (queue.current?.isSaved(latest.current.value) && !busy) {
      queueMicrotask(() => {
        if (!stopped.current && queue.current?.isSaved(latest.current.value) && !latest.current.busy) {
          setStatus(previous => previous === "pending" || previous === "saving" ? "saved" : previous);
        }
      });
      return;
    }
    setStatus("pending");
    if (busy) return;
    timer.current = setTimeout(() => { void flush(); }, 900);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [fingerprint, busy, loadedFor, owner, enabled, ready, flush, ackRevision]);

  const complete = useCallback(async () => {
    stopped.current = true;
    if (timer.current) clearTimeout(timer.current);
    setStatus("saved");
    // Publication/save is already successful. Cleanup must not turn it into a
    // false failure. Tombstones prevent old, delayed autosaves restoring drafts.
    void queue.current?.save(null).catch(() => { /* Retain the private recovery copy on outage. */ });
  }, []);
  const discard = useCallback(async () => {
    stopped.current = true;
    if (timer.current) clearTimeout(timer.current);
    // Never deletes stored images or changes public records. If offline, a last
    // acknowledged private recovery copy can remain; explicit logout still works.
    const confirmed = queue.current?.confirmed();
    try { if (confirmed !== undefined) await queue.current?.save(confirmed); } catch { /* User explicitly chose to leave. */ }
  }, []);
  useEffect(() => register(id.current, { unsafe, flush, discard }), [register, unsafe, flush, discard]);
  useEffect(() => { notify(); });
  const reload = useCallback(() => setLoadAttempt(attempt => attempt + 1), []);
  const resume = useCallback(() => {
    if (stopped.current) queue.current?.rebase(latest.current.value);
    stopped.current = false;
  }, []);
  return { status, error, loaded: loadedFor === owner && !!owner, flush, complete, discard, reload, resume };
}

/** Existing onboarding storage stays authoritative; protect its debounce window. */
export function useExistingDraftProtection<T>({ value, ready, busy, save, saved, enabled = true }: { value: T; ready: boolean; busy: boolean; save: (value: T) => Promise<boolean>; saved?: (value: T) => boolean | null; enabled?: boolean }) {
  const { register, notify } = useFormNavigation();
  const id = useRef(Symbol("existing-draft"));
  const acknowledged = useRef("");
  const stopped = useRef(false);
  const current = useRef({ value, ready, busy, save, saved, enabled });
  useLayoutEffect(() => { current.current = { value, ready, busy, save, saved, enabled }; });
  useEffect(() => {
    if (ready && !acknowledged.current) acknowledged.current = draftFingerprint(value);
  }, [ready, value]);
  const acknowledge = useCallback((snapshot: T) => { acknowledged.current = draftFingerprint(snapshot); }, []);
  useEffect(() => register(id.current, {
    unsafe: () => !stopped.current && current.current.enabled && current.current.ready && (current.current.busy
      || !(current.current.saved?.(current.current.value) ?? draftFingerprint(current.current.value) === acknowledged.current)),
    flush: async () => {
      if (current.current.busy) return false;
      const snapshot = current.current.value;
      if (!await current.current.save(snapshot)) return false;
      acknowledged.current = draftFingerprint(snapshot);
      return !current.current.busy && draftFingerprint(current.current.value) === acknowledged.current;
    },
    // Discarding never deletes a published image. Existing last saved onboarding
    // progress remains available; only the not-yet-saved edits are abandoned.
    discard: async () => { stopped.current = true; },
  }), [register]);
  useEffect(() => { notify(); });
  const complete = useCallback(() => { stopped.current = true; }, []);
  return { acknowledge, complete };
}

/** Use for a legacy form that cannot safely store a private draft yet. */
export function useUnsavedForm(unsafe: boolean) {
  const { register, notify } = useFormNavigation();
  const id = useRef(Symbol("unsaved-form"));
  const current = useRef(unsafe);
  useLayoutEffect(() => { current.current = unsafe; });
  useEffect(() => register(id.current, { unsafe: () => current.current }), [register]);
  useEffect(() => { notify(); });
}
