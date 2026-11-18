"use client";
import {useEffect, useRef, useState} from "react";
import {useTranslations} from "next-intl";
import {isArtUUID, parseProfileArtPublicPath, profileArtPublicPath, type PlatformArtKind} from "@/lib/profile-art-refill-contract";
import type {ExclusiveProfileArtOption, ExclusiveProfileArtPickerProps, ExclusiveProfileArtStatus} from "@/components/ExclusiveProfileArtPicker";
import type {ProfileArtClaim, ProfileArtSave} from "@/lib/profile-art-save";

type Lease = ProfileArtClaim & {artworkId: string; previewSrc: string; expiresAt: string};
type Snapshot = {revision: number; available: {artworkId: string; kind: PlatformArtKind; mediaKey: string}[]; lease: {artworkId: string; token: string; expiresAt: string; kind: PlatformArtKind; mediaKey: string} | null};
const validOption = (v: Snapshot["available"][number], kind: PlatformArtKind) => v?.kind === kind && isArtUUID(v.artworkId) && isArtUUID(v.mediaKey);

/** Parent lifecycle, keyed by the authenticated form. Tokens stay in memory only. */
export function useExclusiveProfileArt({accountId, kind, value, savedValue, onChange, disabled = false}: {
  accountId: string; kind: PlatformArtKind; value: string; savedValue: string; onChange: (url: string) => void; disabled?: boolean;
}) {
  const t = useTranslations("ExclusiveProfileArt");
  const [options, setOptions] = useState<ExclusiveProfileArtOption[]>([]);
  const optionsRef = useRef<ExclusiveProfileArtOption[]>([]);
  const [status, setStatus] = useState<ExclusiveProfileArtStatus>("loading");
  const [pending, setPending] = useState<string | null>(null);
  const [lease, setLease] = useState<Lease | null>(null);
  const revision = useRef(0);
  const alive = useRef(true);
  const epoch = useRef(0);
  const busy = useRef(false);
  const loaded = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const retry = useRef<Record<string, unknown> | null>(null);
  const selected = useRef<Lease | null>(null);
  const latest = useRef({value, savedValue, onChange});
  latest.current = {value, savedValue, onChange};
  useEffect(() => {
    alive.current = true;
    revision.current = 0; loaded.current = false; retry.current = null;
    selected.current = null; optionsRef.current = []; busy.current = false;
    setOptions([]); setLease(null); setPending(null); setStatus("loading");
    return () => {alive.current = false; epoch.current += 1; controller.current?.abort();};
  }, [accountId]);
  useEffect(() => {
    if (!lease) return;
    const timer = setTimeout(() => {if (alive.current) setStatus("expired");}, Math.max(0, Date.parse(lease.expiresAt) - Date.now()));
    return () => clearTimeout(timer);
  }, [lease]);

  async function request(body: Record<string, unknown>): Promise<unknown> {
    const generation = epoch.current;
    controller.current = new AbortController();
    const signal = AbortSignal.any([controller.current.signal, AbortSignal.timeout(10_000)]);
    const response = await fetch("/api/profile-art", {method: "POST", cache: "no-store", signal,
      headers: {"Content-Type": "application/json", "X-Profile-Account": accountId}, body: JSON.stringify({...body, kind})});
    const result = await response.json();
    if (!alive.current || generation !== epoch.current) throw new Error(t("error"));
    if (!response.ok || !result.data) {
      if (response.status >= 400 && response.status < 500) retry.current = null;
      throw new Error(t(result.code === "ART_EXPIRED" ? "expired" : "error"));
    }
    return result.data;
  }
  async function read() {
    const snapshot = await request({action: "read"}) as Snapshot;
    if (!Number.isSafeInteger(snapshot.revision) || snapshot.revision < 0 || !Array.isArray(snapshot.available) || snapshot.available.length > 24 || !snapshot.available.every(v => validOption(v, kind))) throw new Error(t("error"));
    revision.current = snapshot.revision;
    const opts = snapshot.available.map(v => ({artworkId: v.artworkId, previewSrc: profileArtPublicPath(kind, v.mediaKey)}));
    optionsRef.current = opts;
    setOptions(opts);
    const l = snapshot.lease;
    if (l && (!validOption(l, kind) || !isArtUUID(l.token) || !Number.isFinite(Date.parse(l.expiresAt)))) throw new Error(t("error"));
    // Resume only the actual recovered form choice; never adopt another tab's choice.
    if (l && profileArtPublicPath(kind, l.mediaKey) === latest.current.value && Date.parse(l.expiresAt) > Date.now()) {
      const next = {kind, token: l.token, revision: snapshot.revision, requestKey: selected.current?.token === l.token ? selected.current.requestKey : crypto.randomUUID(), artworkId: l.artworkId, previewSrc: profileArtPublicPath(kind, l.mediaKey), expiresAt: l.expiresAt};
      selected.current = next; setLease(next); setStatus("ready");
    } else {
      selected.current = null; setLease(null);
      setStatus(parseProfileArtPublicPath(latest.current.value) && latest.current.value !== latest.current.savedValue ? "expired" : opts.length ? "ready" : "empty");
    }
    loaded.current = true;
    return opts;
  }
  async function perform(body: Record<string, unknown>) {
    const result = await request(body) as {revision: number; artworkId?: string; token?: string; expiresAt?: string};
    if (!Number.isSafeInteger(result.revision) || result.revision < 0) throw new Error(t("error"));
    revision.current = result.revision;
    if (body.action === "lease") {
      const choice = optionsRef.current.find(v => v.artworkId === body.artworkId);
      if (!choice || result.artworkId !== choice.artworkId || !isArtUUID(result.token) || typeof result.expiresAt !== "string" || Date.parse(result.expiresAt) <= Date.now()) throw new Error(t("error"));
      const next: Lease = {...choice, kind, token: result.token, revision: result.revision, requestKey: crypto.randomUUID(), expiresAt: result.expiresAt};
      selected.current = next; setLease(next); setStatus("ready"); latest.current.onChange(choice.previewSrc);
    } else {
      selected.current = null; setLease(null); latest.current.onChange(latest.current.savedValue); setStatus(options.length ? "ready" : "empty");
    }
    retry.current = null;
  }
  async function run(body?: Record<string, unknown>) {
    if (busy.current || !accountId || disabled) return;
    busy.current = true;
    const generation = epoch.current;
    setPending(typeof body?.artworkId === "string" ? body.artworkId : "request");
    try {
      if (body) {retry.current = body; await perform(body);} else if (retry.current) {await perform(retry.current);} else {await read();}
    } catch {if (alive.current && generation === epoch.current) {
      if (!retry.current) {try {await read();} catch { /* preserve form and last confirmed choice */ }}
      setStatus("error");
    }}
    finally {if (alive.current && generation === epoch.current) {busy.current = false; setPending(null);}}
  }
  async function claim(): Promise<ProfileArtClaim | null> {
    if (value === savedValue || !parseProfileArtPublicPath(value)) return null;
    if (busy.current) throw new Error(t("pending"));
    // Explicit profile save can reserve its unchanged suggestion or renew an
    // expired choice. It never substitutes another artwork without consent.
    if (!selected.current || selected.current.previewSrc !== value || Date.parse(selected.current.expiresAt) <= Date.now()) {
      const generation = epoch.current;
      busy.current = true;
      try {
        if (retry.current) await perform(retry.current);
        else {
          const available = await read();
          if (!selected.current || selected.current.previewSrc !== value) {
            const option = available.find(v => v.previewSrc === value);
            if (!option) throw new Error(t("expired"));
            retry.current = {action: "lease", artworkId: option.artworkId, expectedRevision: revision.current, requestKey: crypto.randomUUID()};
            await perform(retry.current);
          }
        }
      } finally {if (generation === epoch.current) busy.current = false;}
    }
    const chosen = selected.current;
    if (!chosen || chosen.previewSrc !== value || Date.parse(chosen.expiresAt) <= Date.now()) throw new Error(t("expired"));
    return {kind, token: chosen.token, revision: chosen.revision, requestKey: chosen.requestKey};
  }
  async function suggest() {
    if (busy.current || disabled || !accountId || savedValue) return;
    const original = latest.current.value;
    const generation = epoch.current;
    busy.current = true;
    try {
      const available = await read();
      if (available.length && latest.current.value === original) {
        let hash = 2166136261;
        for (const character of accountId) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
        latest.current.onChange(available[(hash >>> 0) % available.length].previewSrc);
        setStatus("ready");
      }
    } catch { /* Optional suggestion never blocks registration or existing images. */ }
    finally {if (generation === epoch.current) busy.current = false;}
  }
  const props: ExclusiveProfileArtPickerProps = {
    kind, options, status, disabled: disabled || !!pending, pendingArtworkId: pending,
    savedChoice: savedValue ? {previewSrc: savedValue} : null,
    confirmedChoice: lease?.previewSrc === value ? lease : null,
    onOpen: () => {if (!loaded.current) void run();},
    onRetry: () => void run(),
    onSelect: artworkId => {if (!retry.current) void run({action: "lease", artworkId, expectedRevision: revision.current, requestKey: crypto.randomUUID()});},
    onRestoreSaved: () => {retry.current = null; void run({action: "cancel", expectedRevision: revision.current, requestKey: crypto.randomUUID()});},
  };
  return {props, claim, suggest, saved: () => {selected.current = null; setLease(null); loaded.current = false; retry.current = null;}};
}

/** Retain the exact key after lost acknowledgements; a changed form is a new save. */
export function useProfileArtSaveRequest() {
  const previous = useRef<{signature: string; value: ProfileArtSave} | null>(null);
  return (payload: Record<string, unknown>, expectedUpdatedAt: string | null, claims: (ProfileArtClaim | null)[]) => {
    const choices = claims.filter((v): v is ProfileArtClaim => v !== null);
    if (!choices.length) return payload;
    const signature = JSON.stringify([payload, expectedUpdatedAt, choices]);
    if (previous.current?.signature !== signature) previous.current = {signature, value: {choices, expectedUpdatedAt, requestKey: crypto.randomUUID()}};
    return {...payload, profileArt: previous.current.value};
  };
}
