import * as privacy from "./profile-privacy.ts";
import {intlServerFor} from './i18n-test-fixture.mjs';
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import * as profileTypes from "./profile-types.ts";
import * as profileDisplay from "./profile-display.ts";
import * as placeCatalog from "./places/catalog.ts";
import * as placeCore from "./places/core.ts";

const require = createRequire(import.meta.url);
const pageSource = readFileSync(new URL("../app/profile/[slug]/page.tsx", import.meta.url), "utf8");
const compiledPage = ts.transpileModule(`${pageSource}\nexport { _getProfile as loadProfile };`, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX,
    esModuleInterop: true,
  },
}).outputText;

function fixture(overrides = {}, similarProfiles = [], organizationLinks = async () => null) {
  const saved = {
    user_id: "own-legacy-profile",
    slug: "own-legacy-profile",
    display_name: "Legacy Crew Test",
    role: "",
    positions: ["Zusatzbeleuchter*in", "Lichtassistent*in", "Fotograf/in", "Fotoassistenz"],
    location: "Berlin, Deutschland",
    bio: "Saved public introduction",
    avatar_url: null,
    profile_images: [],
    ...structuredClone(overrides),
  };
  const queries = [];
  const db = {
    from(table) {
      const query = { table, select: "", filters: [], single: false };
      const execute = () => {
        queries.push(structuredClone(query));
        if (table !== "profiles") return { data: [], error: null };
        if (query.single) {
          const extraFields = query.select.startsWith("physical,");
          return { data: extraFields ? {} : structuredClone(saved), error: null };
        }
        const typeFilter = query.filters.find(([method, field]) => method === "eq" && field === "profile_type");
        return {
          data: typeFilter ? similarProfiles.filter((profile) => profile.profile_type === typeFilter[2]) : [],
          error: null,
        };
      };
      const builder = {
        select(value) { query.select = value; return builder; },
        maybeSingle() { query.single = true; return Promise.resolve(execute()); },
        then(resolve, reject) { return Promise.resolve(execute()).then(resolve, reject); },
      };
      for (const method of ["eq", "neq", "is", "not", "in", "order", "limit"]) {
        builder[method] = (...args) => { query.filters.push([method, ...args]); return builder; };
      }
      return builder;
    },
  };
  function ProfileViewFixture() { return null; }
  const dependencies = {
    "@/lib/profile-privacy": privacy,
    "@/lib/profile-privacy-server": {profileAccessFor:async ids=>new Map(ids.map(id=>[id,privacy.profileAccess(null,id,null)])),filterPublicListings:async rows=>rows},
    "next-intl/server": intlServerFor(),
    "@/lib/places/catalog": placeCatalog,
    "@/lib/places/core": placeCore,
    "@/components/organizations/PublicOrganizationLinks": organizationLinks,
    "@/lib/project-media-rights": { publicProjectCredits: (rows) => rows },
    "@/lib/linked-profile-access": { visibleLinkedProfileIds: async (ids) => new Set(ids) },
    "next/navigation": { notFound: () => { throw new Error("Unexpected missing fixture profile"); } },
    "@/lib/db": { db },
    "@/lib/profile-views": { recordProfileView: async () => {} },
    "next/cache": { unstable_cache: (read) => read },
    react: { ...require("react"), cache: (read) => read },
    "@/lib/listing-price": { listingPriceMetadata: () => ({}) },
    "@/components/JsonLd": () => null,
    "@clerk/nextjs/server": { auth: async () => ({ userId: null }) },
    "./ProfileView": ProfileViewFixture,
    "@/lib/trust": {
      canViewProfile: async () => true,
      getBlockStatus: async () => null,
      getProfileContactVisibility: async () => ({ phone: "hidden", contact_email: "hidden" }),
    },
    "@/lib/contact-visibility": {
      visibleProfileContactFields: () => [],
      projectProfileContacts: () => ({}),
    },
    "@/lib/profile-types": profileTypes,
    "@/lib/profile-display": profileDisplay,
  };
  const loaded = { exports: {} };
  new Function("require", "module", "exports", compiledPage)(
    (name) => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name),
    loaded,
    loaded.exports,
  );
  return {
    saved,
    queries,
    loadProfile: () => loaded.exports.loadProfile(saved.slug),
    async publicPageProps() {
      const element = await loaded.exports.default({ params: Promise.resolve({ slug: saved.slug }) });
      const view = element.props.children.find((child) => child.type === ProfileViewFixture);
      assert.ok(view, "the public page must pass its loaded profile to ProfileView");
      return view.props;
    },
  };
}

test("public legacy profiles without a stored type keep their occupations and use neutral crew modules", async () => {
  const missingTypes = [
    {},
    { profile_type: null, profile_types: null },
    { profile_type: "", profile_types: [] },
    { profile_type: "   ", profile_types: [] },
    { profile_types: [] },
  ];
  const moduleVariants = [
    undefined,
    [],
    [{ type: "hero", enabled: true, order: 0, config: {} }],
    [{ type: "about", enabled: false, order: 0, config: {} }],
  ];
  for (const storedTypes of missingTypes) {
    for (const modules of moduleVariants) {
      const app = fixture({ ...storedTypes, modules });
      const profile = await app.loadProfile();
      assert.equal(profile.profile_type, null, JSON.stringify(storedTypes));
      assert.deepEqual(profile.profile_types, []);
      assert.deepEqual(profile.positions, app.saved.positions);
      assert.equal(profile.role, app.saved.role);
      assert.deepEqual(profile.modules, profileTypes.PROFILE_PRESETS.crew);
      assert.deepEqual(profileDisplay.getProfileDisplayPositions({
        positions: profile.positions,
        profileTypes: profile.profile_types,
        primaryType: profile.profile_type,
        labels: profileTypes.PROFILE_TYPE_LABELS,
      }), app.saved.positions);
    }
  }
});

test("explicit talent types and primary-first multiple selections retain their existing presets", async () => {
  const cases = [
    { input: { profile_type: "actor" }, types: ["actor"], category: "talent" },
    { input: { profile_type: "model", profile_types: [] }, types: ["model"], category: "talent" },
    { input: { profile_types: ["actor"] }, types: ["actor"], category: "talent" },
    { input: { profile_types: ["model", "actor", "model"] }, types: ["model", "actor"], category: "talent" },
    { input: { profile_type: "camera", profile_types: ["model", "actor", "model"] }, types: ["camera", "model", "actor"], category: "crew" },
    { input: { profile_type: "actor", profile_types: ["model", "extra", "model"] }, types: ["actor", "model", "extra"], category: "talent" },
  ];
  for (const { input, types, category } of cases) {
    const profile = await fixture(input).loadProfile();
    assert.equal(profile.profile_type, types[0]);
    assert.deepEqual(profile.profile_types, types);
    assert.deepEqual(profile.modules, profileTypes.PROFILE_PRESETS[category]);
  }
});

test("a typeless profile retains saved module settings while missing crew modules stay disabled", async () => {
  const modules = [
    { type: "portfolio", enabled: true, order: 17, config: { layout: "grid", maxVisible: 3, captions: false } },
    { type: "about", enabled: false, order: 4, config: { expanded: true } },
  ];
  const profile = await fixture({ profile_type: null, profile_types: [], modules }).loadProfile();
  assert.equal(profile.profile_type, null);
  assert.deepEqual(profile.modules.slice(0, modules.length), modules);
  assert.equal(new Set(profile.modules.map((module) => module.type)).size, profile.modules.length);
  for (const expected of profileTypes.PROFILE_PRESETS.crew) {
    const actual = profile.modules.find((module) => module.type === expected.type);
    assert.ok(actual, `missing crew module ${expected.type}`);
    if (!modules.some((module) => module.type === expected.type)) {
      assert.equal(actual.enabled, false, `${expected.type} must not become enabled automatically`);
      assert.deepEqual(actual.config, expected.config);
    }
  }
  assert.equal(profile.modules.some((module) => module.type === "agency"), false);
});

test("public pages skip type-based recommendations when no type is stored and retain them for explicit talent", async () => {
  const legacy = fixture({ profile_type: null, profile_types: [] });
  const legacyProps = await legacy.publicPageProps();
  assert.equal(legacyProps.profile.profile_type, null);
  assert.deepEqual(legacyProps.similarProfiles, []);
  assert.equal(legacy.queries.some((query) => query.table === "profiles" && !query.single), false);
  assert.equal(legacy.queries.some((query) => query.filters.some(([, field]) => field === "profile_type")), false);

  for (const type of ["actor", "model"]) {
    const recommendation = {
      user_id: `other-${type}`, slug: `other-${type}`, display_name: "Other Test Profile",
      profile_type: type, location: "Berlin, Deutschland", avatar_url: null,
    };
    const explicit = fixture({ profile_type: type }, [recommendation]);
    const props = await explicit.publicPageProps();
    assert.equal(props.profile.profile_type, type);
    assert.deepEqual(props.similarProfiles, [recommendation]);
    const queries = explicit.queries.filter((query) => query.filters.some(([method, field]) => method === "eq" && field === "profile_type"));
    assert.equal(queries.length, 1);
    assert.ok(queries[0].filters.some(([method, field, value]) => method === "eq" && field === "profile_type" && value === type));
  }
});

test("the profile page passes resolved organization content or null rather than an async component wrapper", async () => {
  const section = require("react").createElement("section", null, "Public organization fixture");
  for (const expected of [null, section]) {
    const calls = [];
    const app = fixture({}, [], async props => { calls.push(props); return expected; });
    const props = await app.publicPageProps();
    assert.deepEqual(calls, [{ userId: app.saved.user_id }]);
    assert.equal(props.organizationSection, expected);
  }
});

test("a pending organization lookup is resolved before the client profile props are handed off", async () => {
  let resolveLinks;
  let notifyRequested;
  const requested = new Promise(resolve => { notifyRequested = resolve; });
  const app = fixture({}, [], () => {
    notifyRequested();
    return new Promise(resolve => { resolveLinks = resolve; });
  });
  let handedOff = false;
  const pageProps = app.publicPageProps().then(props => { handedOff = true; return props; });
  await requested;
  assert.equal(handedOff, false);
  resolveLinks(null);
  assert.equal((await pageProps).organizationSection, null);
});
