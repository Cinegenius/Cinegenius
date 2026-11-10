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

test("rules default disabled; reads never enroll or modify existing approved offers", () => isolated(async()=>{
  assert.equal(await one("select count(*)::int value from listing_freshness_settings where enabled"),0);
  assert.equal(await one("select count(*)::int value from listing_freshness_state"),0);
  const id=await createListing(); const before=await row("listings",id);
  const data=await read(id); assert.equal(data.status,"ok"); assert.equal(data.state,null);
  assert.equal(data.canRenew,false); assert.equal(data.canEnd,false);
  assert.equal((await claims()).length,0); assert.equal(await state(id),null);
  assert.deepEqual(await row("listings",id),before);
}));

test("activation enrolls every supported public type with a new full initial period only",()=>isolated(async()=>{
  for(const type of ["prop","vehicle","location","job","animal"]){
    const id=await createListing(false,type); await setting(type,true,type==="location"?180:90);
    await claims(); const current=await state(id);
    assert.equal(current.status,"active"); assert.equal(current.cycle,1);
    const days=(Date.parse(current.due_at)-Date.parse(current.confirmed_at))/86400000;
    assert.equal(days,type==="location"?180:90); assert.equal(current.reminder_sent_at,null);
    assert.equal((await row("listings",id)).published,true);
  }
  const draft=await one("insert into listings(user_id,type,title,city,category,last_editor_id) values('own-provider','location','Own private draft','Own city','Own category','own-provider') returning id value");
  await claims(); assert.equal(await state(draft),null); assert.equal((await row("listings",draft)).published,false);
}));

test("settings batch validates all rows before changing any setting or audit entry",()=>isolated(async()=>{
  const initial=await one("select jsonb_agg(s order by listing_type) value from listing_freshness_settings s");
  const valid={listing_type:"location",enabled:true,initial_days:180,followup_days:7,response_days:14};
  for(const rows of [[valid,{...valid,listing_type:"prop",response_days:731}],[valid,valid],[{...valid,enabled:"true"}],[{...valid,initial_days:1.5}]]){
    const result=await one("select configure_listing_freshness_batch($1,'own-admin','Own batch test') value",[rows]);
    assert.equal(result.status,"invalid");
    assert.deepEqual(await one("select jsonb_agg(s order by listing_type) value from listing_freshness_settings s"),initial);
    assert.equal(await one("select count(*)::int value from listing_freshness_events"),0);
  }
  const saved=await one("select configure_listing_freshness_batch($1,'own-admin','Own atomic batch test') value",[[valid,{...valid,listing_type:"prop",initial_days:90}]]);
  assert.equal(saved.status,"saved"); assert.deepEqual(saved.settings.map(x=>x.listing_type),["location","prop"]);
  assert.equal(await one("select count(*)::int value from listing_freshness_events where action='settings_updated'"),2);
}));

test("renewal is per listing, version checked and request-idempotent",()=>isolated(async()=>{
  await setting(); const id=await createListing();const other=await createListing();await claims();
  const before=await state(id),unaffected=await state(other);
  const result=await act(id,before);assert.equal(result.status,"saved");
  assert.equal(result.state.cycle,before.cycle+1);assert.equal(result.state.version,before.version+1);assert.equal(result.state.provider_locale,"en");
  assert.equal((await act(id,before)).status,"unchanged");
  assert.deepEqual(await state(id),result.state); assert.deepEqual(await state(other),unaffected);
  assert.equal((await act(id,before,"renew","own-provider","30000000-0000-4000-8000-000000000002")).status,"stale");
  assert.equal((await act(other,unaffected)).status,"invalid");
  assert.equal((await act(id,result.state,"renew","own-provider","30000000-0000-4000-8000-000000000003","xx")).status,"invalid");
  assert.equal(await one("select count(*)::int value from listing_freshness_events where action='renewed'"),1);
}));

test("actual company owner and confirmed editors have access; technical creator, ordinary and former members do not",()=>isolated(async()=>{
  await setting();const id=await createListing(true);await claims();const current=await state(id);
  assert.equal(current.provider_user_id,"own-provider");assert.equal(current.provider_company_id,COMPANY);
  assert.equal((await read(id,"technical-creator")).status,"forbidden");
  assert.equal((await act(id,current,"renew","technical-creator")).status,"forbidden");
  for(const [role,status,expected] of [["member","accepted","forbidden"],["editor","pending","forbidden"],["editor","accepted","ok"],["manager","accepted","ok"]]){
    await pg.query("delete from company_members where company_id=$1",[COMPANY]);
    await pg.query("insert into company_members values($1,'own-editor',$2,$3)",[COMPANY,role,status]);
    assert.equal((await read(id,"own-editor")).status,expected);
  }
  await pg.query("delete from company_members where company_id=$1",[COMPANY]);
  assert.equal((await act(id,current,"renew","own-editor")).status,"forbidden");
  assert.deepEqual(await state(id),current);
}));

test("ending or pausing preserves content and cannot renew or republish through the freshness action",()=>isolated(async()=>{
  await setting();
  for(const [index,action] of ["end","pause"].entries()){
    const id=await createListing();await claims();const before=await row("listings",id),current=await state(id);
    const result=await act(id,current,action,"own-provider",`30000000-0000-4000-8000-00000000000${index+1}`);
    assert.equal(result.status,"saved");assert.equal(result.state.status,action==="end"?"ended":"paused");
    const after=await row("listings",id);assert.equal(after.published,false);
    for(const key of ["id","user_id","title","description","category","image_url","extra_images","metadata","content_revision"])assert.deepEqual(after[key],before[key]);
    assert.equal((await act(id,result.state,"renew","own-provider",`30000000-0000-4000-8000-00000000000${index+3}`)).status,"restricted");
    assert.equal((await row("listings",id)).published,false);
  }
}));

test("stale content/provider bindings and admin hiding cannot be bypassed by renewal",()=>isolated(async()=>{
  await setting();const id=await createListing(true);await claims();const current=await state(id);
  await pg.query("update companies set owner_user_id='next-owner' where id=$1",[COMPANY]);
  assert.equal((await read(id)).status,"forbidden");
  assert.equal((await act(id,current,"renew","next-owner")).status,"stale");
  await claims();const changed=await state(id);assert.equal(changed.provider_user_id,"next-owner");assert.equal(changed.cycle,current.cycle+1);
  await pg.query("update listings set description='Own changed content',last_editor_id='next-owner' where id=$1",[id]);
  assert.equal((await act(id,changed,"renew","next-owner","30000000-0000-4000-8000-000000000002")).status,"stale");
  assert.equal((await row("listings",id)).published,false);
  const plain=await createListing();await claims();const s=await state(plain),snapshot=await row("listings",plain);
  const provider=await one("select to_jsonb(p) value from profiles p where user_id='own-provider'");
  assert.equal(await one("select offer_review_transition('listing',$1,$2,null,$3,'hide','own-admin','Own explicit admin restriction',null) value",[plain,snapshot,provider]),"saved");
  assert.notEqual((await act(plain,s,"renew","own-provider","30000000-0000-4000-8000-000000000003")).status,"saved");
  assert.equal((await row("listings",plain)).published,false);
}));

test("hide and unchanged owner-republish before worker run invalidates an old elapsed response deadline",()=>isolated(async()=>{
  await setting("prop");
  const id=await one("insert into listings(user_id,type,title,description,city,category,last_editor_id) values('own-provider','prop','Own marketplace offer','Preserved content','Own city','Own category','own-provider') returning id value");
  assert.equal(await one("select marketplace_publish_transition($1,$2,'own-provider') value",[id,await row("listings",id)]),"saved");
  const published=await row("listings",id); assert.equal(published.moderation_status,"owner_published");await claims();const previous=await state(id);
  await pg.query("update listing_freshness_state set reminder_sent_at=clock_timestamp()-interval '30 days',followup_sent_at=clock_timestamp()-interval '20 days',response_deadline_at=clock_timestamp()-interval '1 day' where listing_id=$1",[id]);
  await pg.query("update listings set published=false where id=$1",[id]); assert.equal((await state(id)).status,"suspended");
  assert.equal(await one("select marketplace_publish_transition($1,$2,'own-provider') value",[id,await row("listings",id)]),"saved");
  assert.equal((await row("listings",id)).content_revision,published.content_revision);
  await claims(); const current=await state(id);
  assert.equal(current.status,"active");assert.equal(current.cycle,previous.cycle+1);assert.equal(current.response_deadline_at,null);
  assert.ok(Date.parse(current.due_at)>Date.now()+29*86400000);assert.equal((await row("listings",id)).published,true);
}));

test("disabling a rule stops renewals and reactivation grants a new initial period",()=>isolated(async()=>{
  await setting();const id=await createListing();await claims();const before=await state(id);
  await setting("location",false);assert.equal((await read(id)).canRenew,false);
  assert.equal((await act(id,before)).status,"restricted");
  await pg.query("update listing_freshness_state set due_at=clock_timestamp()-interval '1 day' where listing_id=$1",[id]);
  assert.equal((await claims()).length,0);await setting("location",true);await claims();
  const current=await state(id);assert.equal(current.cycle,before.cycle+1);assert.equal(current.status,"active");
  assert.ok(Date.parse(current.due_at)>Date.now()+29*86400000);assert.equal((await row("listings",id)).published,true);
}));

test("anonymous and authenticated database roles cannot read private lifecycle data or invoke service RPCs",async()=>{
  for(const role of ["anon","authenticated"]){
    await pg.exec(`set role ${role}`);
    try{
      await assert.rejects(pg.query("select * from listing_freshness_state"),/permission denied/);
      await assert.rejects(pg.query("select * from listing_freshness_outbox"),/permission denied/);
      await assert.rejects(pg.query("select configure_listing_freshness('location',true,30,7,14,'spoof-admin','Spoofed request')"),/permission denied/);
      await assert.rejects(pg.query("select get_listing_freshness('10000000-0000-4000-8000-000000000001','spoof-owner')"),/permission denied/);
      await assert.rejects(pg.query("select * from claim_listing_freshness_reminders(10,'spoof-worker')"),/permission denied/);
      await assert.rejects(pg.query("select * from get_listing_freshness_delivery_checks(10)"),/permission denied/);
      await assert.rejects(pg.query("select record_listing_freshness_delivery_check('10000000-0000-4000-8000-000000000001','spoof-message',null,'delivered')"),/permission denied/);
    }finally{await pg.exec("reset role")}
  }
});


test("unavailable companies cannot repeatedly consume the bounded maintenance batch",()=>isolated(async()=>{
  const ids=[]; for(let i=0;i<100;i++) ids.push(await createListing(true));
  await setting(); await claims();
  await pg.query("update companies set published=false where id=$1",[COMPANY]);
  await claims(); const suspended=await state(ids[0]); assert.equal(suspended.status,"suspended");
  await pg.query("update listing_freshness_state set updated_at='2000-01-01'");
  const ordinary=await createListing(); await claims(); assert.equal((await state(ordinary)).status,"active");
  await pg.query("update listing_freshness_state set due_at=now()-interval '1 day' where listing_id=$1",[ordinary]);
  const deliveries=await claims(); assert.equal(deliveries.length,1); assert.equal(deliveries[0].listing_id,ordinary);
  assert.equal((await state(ids[0])).version,suspended.version);
  await pg.query("update companies set published=true where id=$1",[COMPANY]);
  await claims(); assert.equal((await state(ids[0])).status,"active");
  assert.equal((await state(ids[0])).cycle,suspended.cycle+1);
}));
