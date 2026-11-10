import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

let pg;
const COMPANY = "20000000-0000-4000-8000-000000000001";
const payload = {
  from: "CineGenius <noreply@cinegenius.co>", to: "provider@example.invalid", replyTo: "cinegenius.co@gmail.com",
  subject: "Own local test reminder", html: "<p>Own local fixture</p>", text: "Own local fixture", locale: "de",
};
const migration = name => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");
before(async () => {
  pg = new PGlite();
  await pg.exec(`set timezone='UTC';
    create role anon; create role authenticated; create role service_role;
    create table profiles(user_id text primary key,display_name text,location text,profile_type text,positions text[]);
    create table companies(id uuid primary key,owner_user_id text,name text,published boolean,slug text);
    create table company_members(company_id uuid,user_id text,role text,status text);
    create table listings(id uuid primary key default gen_random_uuid(),user_id text,company_id uuid,type text,category text,title text,description text,price numeric,city text,image_url text,extra_images jsonb,metadata jsonb,published boolean default true,created_at timestamptz default now());
    create table company_equipment(id uuid primary key default gen_random_uuid(),company_id uuid,name text,published boolean default true);
    create table admin_audit_log(actor_user_id text,action text,entity_type text,entity_id text,reason text,outcome text,metadata jsonb);
    create table notifications(user_id text,type text,title text,body text,href text);
    insert into profiles values('own-provider','Own Provider','Own city','crew','{}'),('technical-creator','Own Creator','Own city','crew','{}'),('next-owner','Own Next Owner','Own city','crew','{}');
    insert into companies values('${COMPANY}','own-provider','Own test company',true,'own-test-company');`);
  for (const name of ["20261028200000_offer_moderation.sql", "20261028210000_marketplace_profile_publication.sql", "20261029010000_optional_listing_images.sql", "20261029020000_admin_review_discretion.sql", "20261110120000_listing_freshness.sql"]) {
    await pg.exec(migration(name));
  }
});
after(async () => { await pg?.close(); });
async function isolated(run) {
  await pg.exec("begin");
  try { await run(); } finally { await pg.exec("rollback"); }
}
async function one(sql, args = []) { return (await pg.query(sql, args)).rows[0]?.value; }
async function row(table, id) {
  assert.ok(["listings", "listing_freshness_state", "listing_freshness_outbox"].includes(table));
  return one(`select to_jsonb(r) value from ${table} r where ${table === "listing_freshness_state" ? "listing_id" : "id"}=$1`, [id]);
}
async function configure(enabled = true) {
  return one("select configure_listing_freshness('location',$1,30,7,14,'own-admin','Own isolated test') value", [enabled]);
}
async function createListing(company = false) {
  const id = await one("insert into listings(user_id,company_id,type,title,description,city,category,last_editor_id) values($1,$2,'location','Own local offer','Content must survive','Own city','Own category',$1) returning id value", [company ? "technical-creator" : "own-provider", company ? COMPANY : null]);
  const snapshot = await row("listings", id);
  const provider = await one("select to_jsonb(p) value from profiles p where user_id='own-provider'");
  const co = company ? await one("select to_jsonb(c) value from companies c where id=$1", [COMPANY]) : null;
  assert.equal(await one("select offer_review_transition('listing',$1,$2,$3,$4,'approve','own-admin','Own explicit test approval',null) value", [id, snapshot, co, provider]), "saved");
  return id;
}
async function claims(worker = "own-worker") { return (await pg.query("select * from claim_listing_freshness_reminders(10,$1)", [worker])).rows; }
async function dueClaim(company = false) {
  await configure();
  const id = await createListing(company);
  assert.equal((await claims()).length, 0, "activation enrolls freshly without immediate mail");
  await pg.query("update listing_freshness_state set due_at=clock_timestamp()-interval '1 minute' where listing_id=$1", [id]);
  const queued = await claims();
  assert.equal(queued.length, 1);
  return queued[0];
}
async function bind(claim, body = payload, recipient = "own-provider") {
  return one("select bind_listing_freshness_delivery($1,$2,$3,$4) value", [claim.outbox_id, claim.claim_token, recipient, body]);
}
async function finish(claim, outcome, messageId = null, error = null) {
  return one("select finish_listing_freshness_delivery($1,$2,$3,$4,$5) value", [claim.outbox_id, claim.claim_token, outcome, messageId, error]);
}
async function deliveryCheck(claim, status, overrides = {}) {
  const outbox = await row("listing_freshness_outbox", claim.outbox_id);
  return one("select record_listing_freshness_delivery_check($1,$2,$3,$4) value", [claim.outbox_id, overrides.messageId ?? outbox.provider_message_id, Object.hasOwn(overrides, "checkedAt") ? overrides.checkedAt : outbox.delivery_checked_at, status]);
}
async function acceptedFollowup(company = false) {
  const initial = await dueClaim(company);
  await bind(initial); await finish(initial, "sent", "fake-initial");
  await pg.query("update listing_freshness_state set due_at=clock_timestamp()-interval '1 second' where listing_id=$1", [initial.listing_id]);
  const followup = (await claims())[0];
  assert.equal(followup.stage, "followup");
  await bind(followup); await finish(followup, "sent", "fake-followup");
  return followup;
}

test("real SQL keeps accepted but unconfirmed follow-ups public and requests bounded delivery checks", () => isolated(async () => {
  const followup = await acceptedFollowup();
  await pg.query("update listing_freshness_state set followup_sent_at=clock_timestamp()-interval '100 days' where listing_id=$1", [followup.listing_id]);
  await claims();
  const checks = (await pg.query("select * from get_listing_freshness_delivery_checks(10)")).rows;
  assert.equal(checks.length, 1);
  assert.equal(checks[0].outbox_id, followup.outbox_id);
  assert.equal(checks[0].recipient, payload.to);
  assert.equal((await deliveryCheck(followup, "unavailable")).status, "unavailable");
  assert.equal((await row("listing_freshness_state", followup.listing_id)).response_deadline_at, null);
  assert.equal((await row("listings", followup.listing_id)).published, true);
  assert.equal((await pg.query("select * from get_listing_freshness_delivery_checks(10)")).rows.length, 0, "status reads are not repeated every worker call");
}));

test("real SQL blocks automatic pause on bounced, failed, suppressed, complained or changed recipients", () => isolated(async () => {
  for (const status of ["bounced", "failed", "suppressed", "complained", "canceled", "recipient_changed"]) {
    await pg.exec("savepoint delivery_failed");
    const followup = await acceptedFollowup();
    await deliveryCheck(followup, "delivered");
    await pg.query("update listing_freshness_state set reminder_sent_at=clock_timestamp()-interval '22 days',followup_sent_at=clock_timestamp()-interval '15 days',response_deadline_at=clock_timestamp()-interval '1 day' where listing_id=$1", [followup.listing_id]);
    assert.equal((await deliveryCheck(followup, status)).status, "not_delivered", status);
    await claims();
    assert.equal((await row("listings", followup.listing_id)).published, true, status);
    assert.equal((await row("listing_freshness_state", followup.listing_id)).response_deadline_at, null, status);
    assert.equal((await deliveryCheck(followup, "delivered")).status, "stale", "terminal failures cannot be overwritten by delayed positive results");
    assert.equal((await pg.query("select * from get_listing_freshness_delivery_checks(10)")).rows.length, 0);
    await pg.exec("rollback to savepoint delivery_failed");
  }
}));

test("real SQL rejects stale delivery observations and revalidates status, settings, content and provider", () => isolated(async () => {
  for (const change of ["receipt", "observed_version", "disable", "provider", "content", "withdraw"]) {
    await pg.exec("savepoint delivery_changed");
    const followup = await acceptedFollowup(true);
    const overrides = {};
    if (change === "receipt") overrides.messageId = "other-message";
    if (change === "observed_version") { await deliveryCheck(followup, "pending"); overrides.checkedAt = null; }
    if (change === "disable") await configure(false);
    if (change === "provider") await pg.query("update companies set owner_user_id='next-owner' where id=$1", [COMPANY]);
    if (change === "content") await pg.query("update listings set title='Own revised content' where id=$1", [followup.listing_id]);
    if (change === "withdraw") await pg.query("update listings set published=false where id=$1", [followup.listing_id]);
    assert.equal((await deliveryCheck(followup, "delivered", overrides)).status, "stale", change);
    assert.equal((await row("listing_freshness_state", followup.listing_id)).response_deadline_at, null, change);
    await pg.exec("rollback to savepoint delivery_changed");
  }
}));

test("real SQL gives one live claim per listing stage and rejects an expired worker token", () => isolated(async () => {
  const first = await dueClaim();
  assert.equal((await claims("another-worker")).length, 0);
  await pg.query("update listing_freshness_outbox set lease_until=clock_timestamp()-interval '1 second' where id=$1", [first.outbox_id]);
  const second = (await claims("replacement-worker"))[0];
  assert.ok(second);
  assert.equal(second.outbox_id, first.outbox_id); assert.notEqual(second.claim_token, first.claim_token);
  assert.equal((await bind(first)).status, "stale");
  assert.equal((await finish(first, "sent", "fake-old-message")).status, "stale");
  const owned = await row("listing_freshness_outbox", second.outbox_id);
  assert.equal(owned.status, "claimed"); assert.equal(owned.claim_token, second.claim_token);
  assert.equal((await bind(second)).status, "bound");
  assert.equal((await finish(second, "sent", "fake-confirmed-message")).status, "sent");
  const acceptedState = await row("listing_freshness_state", second.listing_id);
  await finish(second, "sent", "fake-duplicate-message");
  assert.deepEqual(await row("listing_freshness_state", second.listing_id), acceptedState, "late completion cannot move the next deadline");
  assert.equal((await row("listing_freshness_outbox", second.outbox_id)).provider_message_id, "fake-confirmed-message");
}));

test("real SQL cannot confirm an unbound attempt or a send without a provider message ID", () => isolated(async () => {
  for (const missing of ["binding", "message_id"]) {
    await pg.exec("savepoint unconfirmed_delivery");
    const claim = await dueClaim();
    if (missing === "message_id") await bind(claim);
    assert.notEqual((await finish(claim, "sent", missing === "binding" ? "fake-unbound-message" : null)).status, "sent");
    assert.equal((await row("listing_freshness_state", claim.listing_id)).reminder_sent_at, null);
    await pg.exec("rollback to savepoint unconfirmed_delivery");
  }
}));

test("real SQL accepts the renderer's long subject limit and rejects line-break injection", () => isolated(async () => {
  for (const invalid of [false, true]) {
    await pg.exec("savepoint subject_contract");
    const claim = await dueClaim();
    const message = { ...payload, subject: invalid ? "Own subject\r\nBcc: other@example.invalid" : "L".repeat(450) };
    const result = await bind(claim, message);
    assert.equal(result.status, invalid ? "stale" : "bound");
    await pg.exec("rollback to savepoint subject_contract");
  }
}));

test("real SQL freezes the payload, recipient and key across retry claims and creates no deadline on failure", () => isolated(async () => {
  const first = await dueClaim();
  const bound = await bind(first);
  assert.equal(bound.status, "bound"); assert.deepEqual(bound.frozen_payload, payload);
  assert.equal(bound.idempotency_key, first.idempotency_key);
  const again = await bind(first, { ...payload, subject: "Changed renderer output must not replace the original" });
  assert.equal(again.status, "existing"); assert.deepEqual(again.frozen_payload, payload);
  assert.equal(again.first_attempt_at, bound.first_attempt_at);
  assert.equal((await finish(first, "retry", null, "simulated_network_timeout")).status, "retry");
  const before = await row("listing_freshness_state", first.listing_id);
  assert.equal(before.reminder_sent_at, null); assert.equal(before.followup_sent_at, null); assert.equal(before.response_deadline_at, null);
  await pg.query("update listing_freshness_outbox set next_attempt_at=clock_timestamp()-interval '1 second' where id=$1", [first.outbox_id]);
  const retry = (await claims())[0];
  assert.ok(retry); assert.equal(retry.idempotency_key, first.idempotency_key); assert.deepEqual(retry.frozen_payload, payload);
  const rebound = await bind(retry, { ...payload, locale: "it" });
  assert.equal(rebound.status, "existing"); assert.deepEqual(rebound.frozen_payload, payload);
  assert.equal((await finish(retry, "sent", "fake-retry-message")).status, "sent");
  const after = await row("listing_freshness_state", first.listing_id);
  assert.ok(after.reminder_sent_at); assert.equal(after.followup_sent_at, null); assert.equal(after.response_deadline_at, null);
}));

test("real SQL pauses only after delivered follow-up, full response period and fresh positive delivery check", () => isolated(async () => {
  const initial = await dueClaim();
  const original = await row("listings", initial.listing_id);
  await bind(initial); await finish(initial, "sent", "fake-initial-message");
  assert.equal((await claims()).length, 0);
  await pg.query("update listing_freshness_state set reminder_sent_at=clock_timestamp()-interval '8 days',due_at=clock_timestamp()-interval '1 second' where listing_id=$1", [initial.listing_id]);
  const followup = (await claims())[0];
  assert.ok(followup); assert.equal(followup.stage, "followup"); assert.notEqual(followup.idempotency_key, initial.idempotency_key);
  assert.equal(followup.grace_days, 14);
  assert.equal((await row("listing_freshness_state", initial.listing_id)).response_deadline_at, null);
  await bind(followup); await finish(followup, "sent", "fake-followup-message");
  const accepted = await row("listing_freshness_state", initial.listing_id);
  assert.ok(accepted.followup_sent_at); assert.equal(accepted.response_deadline_at, null, "send acceptance is not proof of delivery");
  assert.equal((await deliveryCheck(followup, "delivered")).status, "delivered");
  const delivered = await row("listing_freshness_state", initial.listing_id);
  const outbox = await row("listing_freshness_outbox", followup.outbox_id);
  assert.equal(Date.parse(delivered.response_deadline_at) - Date.parse(outbox.delivered_at), 14 * 24 * 60 * 60 * 1000);
  await claims(); assert.equal((await row("listings", initial.listing_id)).published, true);
  await pg.query("update listing_freshness_state set reminder_sent_at=clock_timestamp()-interval '22 days',followup_sent_at=clock_timestamp()-interval '15 days',response_deadline_at=clock_timestamp()-interval '1 day' where listing_id=$1", [initial.listing_id]);
  await claims();
  assert.equal((await row("listings", initial.listing_id)).published, true, "an elapsed deadline alone cannot pause an offer");
  assert.equal((await deliveryCheck(followup, "delivered")).status, "paused");
  const paused = await row("listings", initial.listing_id);
  assert.equal(paused.published, false); assert.equal(paused.title, original.title); assert.equal(paused.description, original.description);
  assert.equal(paused.content_revision, original.content_revision);
  assert.equal((await row("listing_freshness_state", initial.listing_id)).status, "paused");
}));

test("real SQL stops ambiguous attempts before the provider's idempotency retention expires", () => isolated(async () => {
  const claim = await dueClaim();
  await bind(claim); await finish(claim, "retry", null, "simulated_ambiguous_send");
  await pg.query("update listing_freshness_outbox set first_attempt_at=clock_timestamp()-interval '23 hours 1 minute',next_attempt_at=clock_timestamp()-interval '1 minute' where id=$1", [claim.outbox_id]);
  assert.equal((await claims()).length, 0);
  assert.equal((await row("listing_freshness_outbox", claim.outbox_id)).status, "unknown");
  const state = await row("listing_freshness_state", claim.listing_id);
  assert.equal(state.reminder_sent_at, null); assert.equal(state.response_deadline_at, null);
  assert.equal((await row("listings", claim.listing_id)).published, true);
}));

test("real SQL never pauses an offer after an unconfirmed follow-up, even when the offer is long overdue", () => isolated(async () => {
  const initial = await dueClaim();
  await bind(initial); await finish(initial, "sent", "fake-initial-before-failure");
  await pg.query("update listing_freshness_state set reminder_sent_at=clock_timestamp()-interval '100 days',due_at=clock_timestamp()-interval '90 days' where listing_id=$1", [initial.listing_id]);
  const followup = (await claims())[0];
  assert.ok(followup); assert.equal(followup.stage, "followup");
  await bind(followup); await finish(followup, "retry", null, "simulated_followup_timeout");
  await pg.query("update listing_freshness_outbox set first_attempt_at=clock_timestamp()-interval '23 hours 1 minute',next_attempt_at=clock_timestamp()-interval '1 minute' where id=$1", [followup.outbox_id]);
  await claims(); await claims();
  assert.equal((await row("listing_freshness_outbox", followup.outbox_id)).status, "unknown");
  const state = await row("listing_freshness_state", initial.listing_id);
  assert.equal(state.followup_sent_at, null); assert.equal(state.response_deadline_at, null); assert.equal(state.status, "active");
  assert.equal((await row("listings", initial.listing_id)).published, true);
}));

test("real SQL preserves both promised email intervals when an admin changes settings after binding", () => isolated(async () => {
  const initial = await dueClaim();
  assert.equal(initial.grace_days, 7);
  await bind(initial, { ...payload, text: "Reply within 7 days", html: "<p>Reply within 7 days</p>" });
  await one("select configure_listing_freshness('location',true,30,1,1,'own-admin','Own changed timing') value");
  await finish(initial, "sent", "fake-initial-with-seven-days");
  const state = await row("listing_freshness_state", initial.listing_id);
  assert.equal(Date.parse(state.due_at) - Date.parse(state.reminder_sent_at), 7 * 24 * 60 * 60 * 1000, "initial email's seven-day promise remains intact");
  await pg.query("update listing_freshness_state set reminder_sent_at=clock_timestamp()-interval '2 days',due_at=clock_timestamp()+interval '5 days' where listing_id=$1", [initial.listing_id]);
  assert.equal((await claims()).length, 0, "the new one-day setting cannot bring an already promised follow-up forward");
  await one("select configure_listing_freshness('location',true,30,1,14,'own-admin','Own follow-up timing') value");
  await pg.query("update listing_freshness_state set due_at=clock_timestamp()-interval '1 second' where listing_id=$1", [initial.listing_id]);
  const followup = (await claims())[0];
  assert.ok(followup); assert.equal(followup.grace_days, 14);
  await bind(followup, { ...payload, text: "Reply within 14 days", html: "<p>Reply within 14 days</p>" });
  await one("select configure_listing_freshness('location',true,30,1,1,'own-admin','Own shorter future timing') value");
  await finish(followup, "sent", "fake-followup-with-fourteen-days");
  assert.equal((await row("listing_freshness_state", initial.listing_id)).response_deadline_at, null);
  await deliveryCheck(followup, "delivered");
  const finalState = await row("listing_freshness_state", initial.listing_id);
  const finalOutbox = await row("listing_freshness_outbox", followup.outbox_id);
  assert.equal(Date.parse(finalState.response_deadline_at) - Date.parse(finalOutbox.delivered_at), 14 * 24 * 60 * 60 * 1000, "the sent follow-up's fourteen-day promise remains intact");
  assert.equal((await row("listings", initial.listing_id)).published, true);
}));

test("real SQL cancels stale valid claims when settings, provider, content or recipient change", () => isolated(async () => {
  for (const change of ["disable", "provider", "content", "recipient"]) {
    await pg.exec("savepoint changed_delivery");
    const claim = await dueClaim(true);
    if (change === "disable") await configure(false);
    if (change === "provider") await pg.query("update companies set owner_user_id='next-owner' where id=$1", [COMPANY]);
    if (change === "content") await pg.query("update listings set title='Own revised content' where id=$1", [claim.listing_id]);
    const result = await bind(claim, payload, change === "recipient" ? "technical-creator" : "own-provider");
    assert.equal(result.status, "stale", change);
    const outbox = await row("listing_freshness_outbox", claim.outbox_id);
    assert.ok(["skipped", "unknown"].includes(outbox.status), change);
    assert.equal(outbox.lease_until, null, change);
    assert.equal((await row("listing_freshness_state", claim.listing_id)).response_deadline_at, null, change);
    await pg.exec("rollback to savepoint changed_delivery");
  }
}));

test("real SQL refuses to record accepted delivery against a changed or renewed cycle", () => isolated(async () => {
  for (const change of ["disable", "provider", "content", "renew"]) {
    await pg.exec("savepoint finished_delivery");
    const claim = await dueClaim(true); await bind(claim);
    if (change === "disable") await configure(false);
    if (change === "provider") await pg.query("update companies set owner_user_id='next-owner' where id=$1", [COMPANY]);
    if (change === "content") await pg.query("update listings set description='Own revised description' where id=$1", [claim.listing_id]);
    if (change === "renew") {
      const state = await row("listing_freshness_state", claim.listing_id);
      const renewed = await one("select listing_freshness_transition($1,'own-provider','renew',$2,$3,gen_random_uuid(),'de') value", [claim.listing_id, state.version, state.cycle]);
      assert.equal(renewed.status, "saved");
    }
    assert.equal((await finish(claim, "sent", "fake-late-provider-acceptance")).status, "stale", change);
    const state = await row("listing_freshness_state", claim.listing_id);
    assert.equal(state.reminder_sent_at, null, change); assert.equal(state.response_deadline_at, null, change);
    await pg.exec("rollback to savepoint finished_delivery");
  }
}));
