import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { intlServerFor, translatorFor } from "./i18n-test-fixture.mjs";
import { getDepartmentRoleLabel } from "./departments.ts";
import * as forms from "./occupation-form.ts";
import * as occupations from "./crew-occupations.ts";
import * as primary from "./primary-occupation.ts";
import * as types from "./profile-types.ts";
import * as display from "./profile-display.ts";
import * as layouts from "./profile-layout.ts";
import * as identity from "./profile-identity.ts";
import * as compatibility from "./profile-db-compat.ts";
import { profileArtDatabaseFailure } from "./profile-art-reservations.ts";
const require = createRequire(import.meta.url), ts = require("typescript");
const { NextRequest, NextResponse } = require("next/server");
const source = readFileSync(new URL("../app/api/profile/route.ts", import.meta.url), "utf8");

function fixture(crew = null, { signedIn = true, profile = {}, missingLayout = false, exists = true, artError = null } = {}) {
  const actor = "own-test-user", reads = [], writes = [], invalidated = [], artCalls = [];
  let saved = { user_id: actor, display_name: "Own test", location: "Berlin", place_city_name: "Berlin", place_status: "verified", role: "member", positions: [], profile_type: "actor", profile_types: ["actor"], crew: structuredClone(crew), bio: "Keep", ...structuredClone(profile) };
  const db = { from(table) {
    assert.equal(table, "profiles");
    let projection, payload, mutation, scoped;
    const query = {
      select(value) { projection = value; return query; },
      eq(key, value) { assert.equal(key, "user_id"); assert.equal(value, actor); scoped = value; return query; },
      upsert(value) { payload = structuredClone(value); mutation = "POST"; assert.equal(payload.user_id, actor); return query; },
      update(value) { payload = structuredClone(value); mutation = "PATCH"; return query; },
      async maybeSingle() { return result(); }, async single() { return result(); },
    };
    function result() {
      if (mutation === "PATCH" || !mutation) assert.equal(scoped, actor);
      if (missingLayout && (Object.hasOwn(payload ?? {}, "profile_layout") || String(projection).split(",").map(s => s.trim()).includes("profile_layout"))) return { data: null, error: { code: "PGRST204", message: "Could not find the 'profile_layout' column of 'profiles' in the schema cache" } };
      if (!exists && !mutation) return { data: null, error: null };
      if (mutation) { writes.push({ mutation, payload }); saved = { ...saved, ...payload }; return { data: structuredClone(saved), error: null }; }
      reads.push(projection);
      const keys = String(projection).split(",").map(value => value.trim());
      return { data: Object.fromEntries(keys.filter(key => Object.hasOwn(saved, key)).map(key => [key, structuredClone(saved[key])])), error: null };
    }
    return query;
  } };
  const deps = {
    "@/lib/profile-art-save-server": { saveProfileWithArt: async (userId, payload) => {
      assert.equal(userId, actor); artCalls.push(structuredClone(payload));
      return { data: null, error: artError ?? { code: "PT409", message: "ART_EXPIRED" } };
    } },
    "@/lib/profile-art-reservations": { profileArtDatabaseFailure },
    "@/lib/occupation-form": forms,
    "@/lib/profile-identity": identity,
    "@/lib/profile-layout": layouts,
    "@/lib/places/catalog": { placeWriteFields: () => ({ place_city_name: "Berlin", place_status: "verified" }) },
    "@/lib/places/core": { PLACE_COLUMNS: "place_city_name,place_status" },
    "@/lib/crew-occupations": occupations, "@/lib/primary-occupation": primary,
    "@/lib/profile-types": types, "@/lib/profile-display": display,
    "@/lib/profile-cover": {}, "@/lib/profile-db-compat": compatibility,
    "@/lib/db": { db },
    "@/lib/auth": { requireAuth: async () => signedIn ? { userId: actor } : NextResponse.json({ error: "unauthorized" }, { status: 401 }) },
    "@clerk/nextjs/server": { clerkClient: async () => ({ users: { updateUserMetadata: async () => {} } }) },
    "next/cache": { revalidateTag: (...args) => invalidated.push(args) },
    "next-intl/server": intlServerFor(), "next/server": { NextRequest, NextResponse },
  };
  const loaded = { exports: {} };
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function("require", "module", "exports", compiled)(name => { assert.ok(Object.hasOwn(deps, name), name); return deps[name]; }, loaded, loaded.exports);
  return { reads, writes, invalidated, artCalls, saved: () => structuredClone(saved),
    call: (method, body, expectedAccount = actor) => loaded.exports[method](new NextRequest("https://fixture.invalid/api/profile", { method, headers: { "content-type": "application/json", "X-Profile-Account": expectedAccount }, ...(method !== "GET" ? { body: JSON.stringify(body) } : {}) })),
  };
}
const post = crew => ({ display_name: "Own test", location: "Berlin", profile_types: ["actor"], positions: [], ...(crew === undefined ? {} : { crew }) });

for (const method of ["POST", "PATCH"]) test(`${method}: an artwork save still reports missing layout schema and retains expired-art errors`, async () => {
  for (const error of [{code:"42703",message:"column r.profile_layout does not exist"}, {code:"PT409",message:"ART_EXPIRED"}]) {
    const f=fixture(null,{artError:error});
    const response=await f.call(method,{...(method==="POST"?post():{}),profile_layout:"large-photo",profileArt:{fixture:"adapter-input"}});
    assert.equal(response.status,error.code==="42703"?503:409);
    assert.equal((await response.json()).code,error.code==="42703"?"PROFILE_LAYOUT_UNAVAILABLE":"ART_EXPIRED");
    assert.equal(f.artCalls.length,1);assert.equal(f.artCalls[0].profile_layout,"large-photo");assert.equal(f.writes.length,0);
  }
});


for (const method of ["POST", "PATCH"]) test(`${method}: explicit layout round-trips and omission preserves it`, async () => {
  const f=fixture(null,{profile:{profile_layout:null}});
  for(const choice of ["compact","large-photo","compact"]){
    const response=await f.call(method,{...(method==="POST"?post():{}),profile_layout:choice,user_id:"foreign"});
    assert.equal(response.status,200);
    assert.equal((await (await f.call("GET")).json()).profile.profile_layout,choice);
  }
  assert.equal((await f.call(method,method==="POST"?post():{bio:"Update only"})).status,200);
  assert.equal(f.saved().profile_layout,"compact");
  assert.equal(f.saved().user_id,"own-test-user");
});

test("a layout-only update preserves occupations, media, focal points and specialist content", async()=>{
 const original={profile_layout:null,avatar_url:"/api/media/own/avatar",cover_image_url:"/api/media/own/cover",focal_point:{x:25,y:35,cover:{x:60,y:50},card:{x:40,y:20,zoom:1.5}},physical:{height_cm:180},performance:{dialects:["Own dialect"]},model_measurements:{waist:70},casting:{own:"keep"},profile_images:[{url:"/api/media/own/portfolio"}],reel_url:"https://example.com/reel",positions:["Own role"],profile_types:["model","lighting"]};
 const f=fixture({equipment_known:["Own equipment"]},{profile:original}),before=f.saved();
 assert.equal((await f.call("PATCH",{profile_layout:"large-photo"})).status,200);
 const after=f.saved();delete after.updated_at;assert.deepEqual(after,{...before,profile_layout:"large-photo"});
});

for(const method of ["POST","PATCH"])test(`${method}: invalid, signed-out and stale-account layout writes fail before mutation`,async()=>{
 for(const value of [null,"","large","actor",false,{},["compact"]]){
  const f=fixture();assert.equal((await f.call(method,{...(method==="POST"?post():{}),profile_layout:value})).status,400);assert.equal(f.writes.length,0);
 }
 const guest=fixture(null,{signedIn:false});assert.equal((await guest.call(method,{profile_layout:"compact"})).status,401);assert.equal(guest.writes.length,0);
 const changed=fixture();assert.equal((await changed.call(method,{profile_layout:"compact"},"previous-account")).status,409);assert.equal(changed.writes.length,0);
});

test("missing migration is disclosed on reads even before profile creation, and cannot acknowledge a dropped save",async()=>{
 for(const exists of [false,true]){
  const f=fixture(null,{missingLayout:true,exists});const response=await f.call("GET");assert.equal(response.status,200);assert.match(response.headers.get("cache-control"),/no-store/);const data=await response.json();assert.equal(data.exists,exists);assert.ok(data.unavailableFields.includes("profile_layout"));
  for(const method of ["POST","PATCH"]){const result=await f.call(method,{...(method==="POST"?post():{}),profile_layout:"large-photo"});assert.equal(result.status,503);assert.equal((await result.json()).code,"PROFILE_LAYOUT_UNAVAILABLE");}
  assert.equal(f.writes.length,0);
 }
});

test("private setup draft keeps the choice on resume, without changing roles or uploaded art",async()=>{
 const {normalizeQuickStartDraft,START_QUICK_START_DRAFT}=await import("./quick-start-flow.ts");const {setupProfilePayload}=await import("./provider-profile-setup.ts");
 const old={...structuredClone(START_QUICK_START_DRAFT),name:"Own",intents:["equipment"],profileAvatarUrl:"/api/media/own/avatar",profileCoverUrl:"/api/media/own/cover",profileLayout:"large-photo"};
 const resumed=normalizeQuickStartDraft(JSON.parse(JSON.stringify(old)));assert.equal(resumed.profileLayout,"large-photo");assert.equal(resumed.profileAvatarUrl,old.profileAvatarUrl);assert.equal(resumed.profileCoverUrl,old.profileCoverUrl);
 const payload=setupProfilePayload(resumed,{profile_type:"camera",profile_types:["camera"],crew:{equipment_known:["Own"]}},[]);assert.equal(payload.profile_layout,"large-photo");assert.equal("crew" in payload,false);assert.equal("positions" in payload,false);
 const legacy=normalizeQuickStartDraft({...old,profileLayout:undefined});assert.equal("profile_layout" in setupProfilePayload(legacy,{profile_layout:"large-photo"},[]),false);
 assert.equal(normalizeQuickStartDraft({...old,profileLayout:"actor"}).profileLayout,undefined);
});

test("layout migration preserves legacy values and rejects unsupported layouts",async()=>{
 const {PGlite}=await import("@electric-sql/pglite");const pg=new PGlite();
 try{
  await pg.exec("create table profiles(user_id text primary key, data jsonb);alter table profiles enable row level security;insert into profiles values ('old','{\"photo\":\"keep\",\"type\":\"model\"}');");
  await pg.exec(readFileSync(new URL("../supabase/migrations/20261118002930_profile_layout_choice.sql",import.meta.url),"utf8"));
  const old=(await pg.query("select * from profiles")).rows[0];assert.equal(old.profile_layout,null);assert.deepEqual(old.data,{photo:"keep",type:"model"});
  for(const layout of ["compact","large-photo"]){await pg.query("update profiles set profile_layout=$1 where user_id='old'",[layout]);assert.equal((await pg.query("select profile_layout from profiles")).rows[0].profile_layout,layout);}
  await assert.rejects(pg.query("update profiles set profile_layout='actor'"));
  assert.equal((await pg.query("select relrowsecurity from pg_class where relname='profiles'")).rows[0].relrowsecurity,true);
 }finally{await pg.close();}
});
