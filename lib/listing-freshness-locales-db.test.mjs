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
async function createListing(company = false, type = "location") {
  const id = await one("insert into listings(user_id,company_id,type,title,description,city,category,last_editor_id) values($1,$2,$3,'Own local offer','Content must survive','Own city','Own category',$1) returning id value", [company ? "technical-creator" : "own-provider", company ? COMPANY : null, type]);
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


async function state(id) { return (await row("listing_freshness_state", id)) ?? null; }
async function setting(type="location", enabled=true, initial=30) {
  return one("select configure_listing_freshness($1,$2,$3,7,14,'own-admin','Own isolated settings test') value", [type,enabled,initial]);
}
async function read(id, actor="own-provider") { return one("select get_listing_freshness($1,$2) value",[id,actor]); }
async function act(id, current, action="renew", actor="own-provider", request="30000000-0000-4000-8000-000000000001", locale="en") {
  return one("select listing_freshness_transition($1,$2,$3,$4,$5,$6,$7) value",[id,actor,action,current.version,current.cycle,request,locale]);
}

const localeMigration=()=>migration('20261110140000_listing_freshness_locales.sql');
const supported=['de','en','es','it','cs','hu','nl','nl-BE','sv'];
const tables=['profiles','companies','company_members','listings','company_equipment','admin_audit_log','notifications','listing_freshness_settings','listing_freshness_state','listing_freshness_outbox','listing_freshness_events'];
async function dataSnapshot(){const result={};for(const table of tables)result[table]=(await pg.query(`select to_jsonb(r) value from public.${table} r order by to_jsonb(r)::text`)).rows.map(row=>row.value);return result;}
async function functionsSnapshot(){return (await pg.query("select oid::text id,proname,to_jsonb(p)-'prosrc' metadata,md5(prosrc) body from pg_proc p where pronamespace='public'::regnamespace and proname like '%listing_freshness%' order by oid")).rows;}
async function relationsSnapshot(){return (await pg.query("select oid::text id,relname,relacl::text,relrowsecurity,relforcerowsecurity from pg_class where relnamespace='public'::regnamespace and relname like 'listing_freshness_%' order by oid")).rows;}
async function constraint(){return (await pg.query("select oid::text id,pg_get_constraintdef(oid) definition from pg_constraint where conrelid='listing_freshness_state'::regclass and conname='listing_freshness_state_provider_locale_check'")).rows[0];}
async function rejectedStatement(sql){await pg.exec('savepoint expected_rejection');await assert.rejects(()=>pg.exec(sql));await pg.exec('rollback to savepoint expected_rejection');}

test('additive locale migration preserves every existing row, function OID/ACL/security/config and retries; repeat is a no-op',()=>isolated(async()=>{
 const claim=await dueClaim();await bind(claim);await finish(claim,'sent','synthetic-already-sent');
 const before=await dataSnapshot(),functions=await functionsSnapshot(),relations=await relationsSnapshot();
 await pg.exec(localeMigration());
 assert.deepEqual(await dataSnapshot(),before,'Migration must not alter member, moderation, event, outbox or frozen data');
 assert.deepEqual(await relationsSnapshot(),relations);
 const after=await functionsSnapshot();
 assert.deepEqual(after.map(({body,...row})=>row),functions.map(({body,...row})=>row));
 for(const fn of after)assert.equal(fn.body===functions.find(before=>before.id===fn.id).body,!['listing_freshness_transition','bind_listing_freshness_delivery'].includes(fn.proname));
 const firstConstraint=await constraint();
 await pg.exec(localeMigration());
 assert.deepEqual(await dataSnapshot(),before);assert.deepEqual(await functionsSnapshot(),after);assert.deepEqual(await constraint(),firstConstraint);
 for(const role of ['anon','authenticated'])for(const signature of ['public.listing_freshness_transition(uuid,text,text,bigint,bigint,uuid,text)','public.bind_listing_freshness_delivery(uuid,uuid,text,jsonb)'])assert.equal(await one('select has_function_privilege($1,$2,\'execute\') value',[role,signature]),false);
 for(const signature of ['public.listing_freshness_transition(uuid,text,text,bigint,bigint,uuid,text)','public.bind_listing_freshness_delivery(uuid,uuid,text,jsonb)'])assert.equal(await one('select has_function_privilege(\'service_role\',$1,\'execute\') value',[signature]),true);
}));

test('all nine locales pass the real state constraint, owner renewal and frozen delivery binding without re-rendering a retry',()=>isolated(async()=>{
 await pg.exec(localeMigration());
 for(const locale of supported){
  const initial=await dueClaim(),listingBefore=await row('listings',initial.listing_id),current=await state(initial.listing_id);
  const request=await one('select gen_random_uuid()::text value');
  const renewed=await act(initial.listing_id,current,'renew','own-provider',request,locale);
  assert.equal(renewed.status,'saved',locale);assert.equal(renewed.state.provider_locale,locale);
  await pg.query("update listing_freshness_state set due_at=clock_timestamp()-interval '1 minute' where listing_id=$1",[initial.listing_id]);
  const fresh=(await claims())[0];assert.equal(fresh.listing_id,initial.listing_id);assert.equal(fresh.provider_locale,locale);
  const selected={...payload,locale};const bound=await bind(fresh,selected);assert.equal(bound.status,'bound',locale);assert.deepEqual(bound.frozen_payload,selected);
  const retry=await bind(fresh,{...payload,locale:'de',subject:'A changed locale and subject must not replace frozen bytes'});
  assert.equal(retry.status,'existing');assert.deepEqual(retry.frozen_payload,bound.frozen_payload);assert.equal(retry.idempotency_key,bound.idempotency_key);
  await finish(fresh,'sent','synthetic-message-'+locale);
  assert.deepEqual(await row('listings',initial.listing_id),listingBefore);
 }
}));

test('unsupported locales and forged recipients still fail closed after the extension',()=>isolated(async()=>{
 await pg.exec(localeMigration());
 for(const locale of ['xx','NL','nl-be','sv-SE','__proto__','',null]){
  const claim=await dueClaim(),current=await state(claim.listing_id);
  if(locale!==null){
   const result=await act(claim.listing_id,current,'renew','own-provider',await one('select gen_random_uuid()::text value'),locale);
   assert.equal(result.status,'invalid');
   await rejectedStatement(`update listing_freshness_state set provider_locale='${locale}' where listing_id='${claim.listing_id}'`);
  }
  const result=await bind(claim,{...payload,locale});assert.equal(result.status,'stale');
  const outbox=await row('listing_freshness_outbox',claim.outbox_id);assert.equal(outbox.frozen_payload,null);assert.equal(outbox.first_attempt_at,null);assert.equal(outbox.error_code,'invalid_payload');
 }
 const claim=await dueClaim();assert.equal((await bind(claim,{...payload,locale:'sv'},'foreign-provider')).status,'stale');assert.equal((await row('listing_freshness_outbox',claim.outbox_id)).frozen_payload,null);
}));

test('unexpected function drift aborts the complete migration before changing constraints, rows or privileges',()=>isolated(async()=>{
 const signature='public.bind_listing_freshness_delivery(uuid,uuid,text,jsonb)';
 const definition=await one('select pg_get_functiondef($1::regprocedure) value',[signature]);
 await pg.exec(definition.replace('begin\n','begin\n -- Synthetic independently changed function\n'));
 const before=await functionsSnapshot(),rows=await dataSnapshot(),check=await constraint();
 await rejectedStatement(localeMigration());
 assert.deepEqual(await functionsSnapshot(),before);assert.deepEqual(await dataSnapshot(),rows);assert.deepEqual(await constraint(),check);
}));

test('unexpected locale constraint drift aborts without changing either guarded function',()=>isolated(async()=>{
 await pg.exec("alter table listing_freshness_state drop constraint listing_freshness_state_provider_locale_check;alter table listing_freshness_state add constraint listing_freshness_state_provider_locale_check check(provider_locale in ('de','en','es','it','cs','hu','xx'))");
 const before=await functionsSnapshot(),check=await constraint(),rows=await dataSnapshot();
 await rejectedStatement(localeMigration());assert.deepEqual(await functionsSnapshot(),before);assert.deepEqual(await constraint(),check);assert.deepEqual(await dataSnapshot(),rows);
}));

test('missing original freshness migration aborts clearly without creating objects',async()=>{
 const empty=new PGlite();
 try{await assert.rejects(()=>empty.exec(localeMigration()),/Missing listing freshness function/);assert.equal((await empty.query("select count(*)::int n from pg_class where relname like 'listing_freshness_%'")).rows[0].n,0);}finally{await empty.close();}
});

test('operator pre/postflight are SELECT-only, expose aggregates and metadata only, and preserve exact counts',()=>isolated(async()=>{
 const claim=await dueClaim();await bind(claim);await finish(claim,'sent','synthetic-existing-message');
 const pre=readFileSync(new URL('../docs/sql/preflight-listing-freshness-locales.sql',import.meta.url),'utf8'),post=readFileSync(new URL('../docs/sql/verify-listing-freshness-locales.sql',import.meta.url),'utf8');
 for(const sql of [pre,post]){
  const statements=sql.replace(/--[^\n]*/g,'').split(';').map(value=>value.trim()).filter(Boolean);assert.equal(statements.length,3);assert.ok(statements.every(value=>/^select\b/i.test(value)));
  assert.doesNotMatch(sql,/frozen_payload|provider_user_id|email|recipient/i);
 }
 const before=await pg.exec(pre);assert.ok(before[0].rows.every(row=>row.readiness==='known_six_locales'));
 await pg.exec(localeMigration());const after=await pg.exec(post);
 assert.ok(after[0].rows.every(row=>row.readiness==='known_nine_locales'));
 assert.deepEqual(after[0].rows.map(({body_md5,readiness,...row})=>row),before[0].rows.map(({body_md5,readiness,...row})=>row));
 assert.deepEqual(after[2].rows,before[2].rows);
}));

test('unexpected browser execution grants fail closed and are never silently revoked or expanded',()=>isolated(async()=>{
 await pg.exec('grant execute on function public.bind_listing_freshness_delivery(uuid,uuid,text,jsonb) to anon');
 const before=await functionsSnapshot(),check=await constraint(),rows=await dataSnapshot();
 await rejectedStatement(localeMigration());assert.deepEqual(await functionsSnapshot(),before);assert.deepEqual(await constraint(),check);assert.deepEqual(await dataSnapshot(),rows);
}));
