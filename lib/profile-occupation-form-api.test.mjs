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
import * as identity from "./profile-identity.ts";
import * as compatibility from "./profile-db-compat.ts";
const require = createRequire(import.meta.url), ts = require("typescript");
const { NextRequest, NextResponse } = require("next/server");
const source = readFileSync(new URL("../app/api/profile/route.ts", import.meta.url), "utf8");

function fixture(crew = null, { signedIn = true, profile = {} } = {}) {
  const actor = "own-test-user", reads = [], writes = [], invalidated = [];
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
      if (mutation) { writes.push({ mutation, payload }); saved = { ...saved, ...payload }; return { data: structuredClone(saved), error: null }; }
      reads.push(projection);
      const keys = String(projection).split(",").map(value => value.trim());
      return { data: Object.fromEntries(keys.filter(key => Object.hasOwn(saved, key)).map(key => [key, structuredClone(saved[key])])), error: null };
    }
    return query;
  } };
  const deps = {
    "@/lib/profile-art-save-server": {saveProfileWithArt(){throw Error("No exclusive choice in this ordinary-profile fixture");}},
    "@/lib/profile-art-reservations": {profileArtDatabaseFailure(){throw Error("No art error expected");}},
    "@/lib/occupation-form": forms,
    "@/lib/profile-identity": identity,
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
  return { reads, writes, invalidated, saved: () => structuredClone(saved),
    call: (method, body, expectedAccount = actor) => loaded.exports[method](new NextRequest("https://fixture.invalid/api/profile", { method, headers: { "content-type": "application/json", "X-Profile-Account": expectedAccount }, ...(method !== "GET" ? { body: JSON.stringify(body) } : {}) })),
  };
}
const post = crew => ({ display_name: "Own test", location: "Berlin", profile_types: ["actor"], positions: [], ...(crew === undefined ? {} : { crew }) });

for (const method of ["POST", "PATCH"]) test(`${method}: explicit grammatical form persists through the real save and own-profile reload`, async () => {
  const f = fixture({ certificates: ["Keep"] });
  for (const occupationForm of ["feminine", "masculine", "neutral", "standard"]) {
    const crew = { occupationForm, certificates: ["Keep"] };
    assert.equal((await f.call(method, method === "POST" ? post(crew) : { crew })).status, 200);
    const response = await f.call("GET"); assert.equal(response.status, 200);
    const { profile } = await response.json();
    assert.equal(forms.occupationFormFromCrew(profile.crew), occupationForm);
    assert.equal(profile.user_id, "own-test-user");
    assert.deepEqual(profile.crew.certificates, ["Keep"]);
    assert.equal(Object.hasOwn(profile.crew, "occupationForm"), occupationForm !== "standard");
    assert.deepEqual(profile.positions, []);
  }
  assert.equal(f.invalidated.length, 4);
  assert.ok(f.invalidated.every(([tag, options]) => tag === "profiles" && options.expire === 0));
});

for (const method of ["POST", "PATCH"]) test(`${method}: older client omission, partial crew and null do not erase a confirmed choice`, async () => {
  for (const nextCrew of [undefined, null, { certificates: ["New"] }]) {
    const f = fixture({ occupationForm: "feminine", certificates: ["Keep"] });
    const body = method === "POST" ? post(nextCrew) : nextCrew === undefined ? { bio: "Updated" } : { crew: nextCrew };
    assert.equal((await f.call(method, body)).status, 200);
    assert.equal(f.saved().crew.occupationForm, "feminine");
    assert.deepEqual(f.saved().positions, []);
  }
});

for (const method of ["POST", "PATCH"]) test(`${method}: malformed explicit forms fail before private reads or writes`, async () => {
  for (const occupationForm of [null, false, [], {}, "female", " feminine ", ""]) {
    const f = fixture({ occupationForm: "feminine" });
    const crew = { occupationForm };
    const response = await f.call(method, method === "POST" ? post(crew) : { crew });
    assert.equal(response.status, 400); assert.equal(f.reads.length, 0); assert.equal(f.writes.length, 0);
    assert.equal(f.saved().crew.occupationForm, "feminine");
  }
});

for (const method of ["POST", "PATCH"]) test(`${method}: signed-out and changed-account saves cannot alter the preference`, async () => {
  const body = method === "POST" ? post({ occupationForm: "feminine" }) : { crew: { occupationForm: "feminine" } };
  const guest = fixture(null, { signedIn: false }); assert.equal((await guest.call(method, body)).status, 401);
  const changed = fixture(); assert.equal((await changed.call(method, body, "other-account")).status, 409);
  for (const f of [guest, changed]) { assert.equal(f.reads.length, 0); assert.equal(f.writes.length, 0); }
});

test("the default remains absent and personal attributes never choose a grammatical form", async () => {
  const f = fixture();
  assert.equal((await f.call("POST", { ...post(undefined), display_name: "Anna", pronouns: "she/her", show_pronouns: true, physical: { gender: "female" } })).status, 200);
  assert.equal(forms.occupationFormFromCrew(f.saved().crew), "standard");
  assert.equal(f.saved().crew, null);
});


test("form changes and reset preserve canonical positions, primary occupation and existing crew fields", async () => {
  const title = "Gaffer (Oberbeleuchter)";
  const main = primary.occupationReference(primary.occupationChoices([title])[0]);
  const crew = { primaryOccupation: main, occupations: [main], occupationForm: "feminine", certificates: ["Keep"] };
  const f = fixture(crew, { profile: { positions: [title], profile_type: "lighting", profile_types: ["lighting"] } });
  for (const occupationForm of ["feminine", "masculine", "neutral", "standard"]) {
    assert.equal((await f.call("PATCH", { crew: { occupationForm }, user_id: "other-account" })).status, 200);
    assert.deepEqual(f.saved().positions, [title]);
    assert.deepEqual(f.saved().crew.primaryOccupation, main);
    assert.deepEqual(f.saved().crew.occupations, [main]);
    assert.deepEqual(f.saved().crew.certificates, ["Keep"]);
    assert.equal(f.saved().user_id, "own-test-user");
    const { profile: reloaded } = await (await f.call("GET")).json();
    const rendered = getDepartmentRoleLabel("licht", reloaded.positions[0], "de", translatorFor("de", "FilmAnimals"), translatorFor("de", "Taxonomy"), forms.occupationFormFromCrew(reloaded.crew));
    const expected = { feminine: "Gaffer (Oberbeleuchterin)", masculine: "Gaffer (Oberbeleuchter)", neutral: "Gaffer", standard: "Gaffer (Oberbeleuchter*in)" };
    assert.equal(rendered, expected[occupationForm], "the saved explicit form reaches the actual localized public-role formatter");
  }
  const response = await f.call("POST", { ...post({ ...crew, occupationForm: "neutral" }), profile_types: ["lighting"], positions: [title] });
  assert.equal(response.status, 200); assert.deepEqual(f.saved().positions, [title]); assert.deepEqual(f.saved().crew.primaryOccupation, main);
});
