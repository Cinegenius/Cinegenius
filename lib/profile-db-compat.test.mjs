import test from "node:test";
import assert from "node:assert/strict";
import {
  isMissingProfileColumn,
  missingProfileColumnName,
  retryWithoutMissingOptionalProfileColumns,
  selectOptionalProfileColumns,
} from "./profile-db-compat.ts";

test("recognizes PostgREST and PostgreSQL missing-column errors", () => {
  const postgrest = { code: "PGRST204", message: "Could not find the 'performance' column of 'profiles' in the schema cache" };
  const postgres = { code: "42703", message: "column profiles.profile_types does not exist" };
  assert.equal(isMissingProfileColumn(postgrest), true);
  assert.equal(missingProfileColumnName(postgrest), "performance");
  assert.equal(missingProfileColumnName(postgres), "profile_types");
  assert.equal(isMissingProfileColumn({ code: "42501", message: "permission denied" }), false);
});

test("optional-column reads retry without absent fields and retain supported values", async () => {
  const calls = [];
  const result = await selectOptionalProfileColumns(["profile_types", "physical", "performance"], async (projection) => {
    calls.push(projection);
    if (projection.includes("physical")) {
      const column = "physical";
      return { data: null, error: { code: "PGRST204", message: `Could not find the '${column}' column of 'profiles' in the schema cache` } };
    }
    if (projection.includes("performance")) {
      return { data: null, error: { code: "PGRST204", message: "Could not find the 'performance' column of 'profiles' in the schema cache" } };
    }
    return { data: { profile_types: ["actor"] }, error: null };
  });
  assert.deepEqual(calls, ["profile_types, physical, performance", "profile_types, performance", "profile_types"]);
  assert.deepEqual(result.data, { profile_types: ["actor"] });
  assert.deepEqual(result.unavailableFields, ["physical", "performance"]);
  assert.equal(result.error, null);
});

test("mutation retries only missing optional columns and reports non-empty values", async () => {
  const calls = [];
  const result = await retryWithoutMissingOptionalProfileColumns(
    { display_name: "Test", physical: { height_cm: 172 }, performance: null },
    new Set(["physical", "performance"]),
    async (payload) => {
      calls.push(Object.keys(payload).sort());
      if ("physical" in payload) {
        return { data: null, error: { code: "42703", message: "column profiles.physical does not exist" } };
      }
      return { data: { user_id: "test-user" }, error: null };
    },
  );
  assert.deepEqual(calls, [["display_name", "performance", "physical"], ["display_name", "performance"]]);
  assert.deepEqual(result.unavailableFields, ["physical"]);
  assert.deepEqual(result.data, { user_id: "test-user" });
});

test("empty optional values do not block profile mutations", async () => {
  const result = await retryWithoutMissingOptionalProfileColumns(
    { display_name: "Test", profile_types: [], physical: null },
    new Set(["profile_types", "physical"]),
    async (payload) => "profile_types" in payload
      ? { data: null, error: { code: "PGRST204", message: "Could not find the 'profile_types' column of 'profiles' in the schema cache" } }
      : { data: { user_id: "test-user" }, error: null },
  );
  assert.equal(result.error, null);
  assert.deepEqual(result.unavailableFields, []);
  assert.deepEqual(result.data, { user_id: "test-user" });
});

test("new and existing profile writes retain multiple roles and optional sedcard fields after reload", async () => {
  const storedProfiles = new Map();
  const optionalColumns = new Set(["profile_types", "physical", "performance"]);
  const profile = {
    user_id: "test-user",
    display_name: "Mara Seidel",
    location: "Berlin",
    positions: ["Komparse"],
    profile_types: ["extra", "actor", "model"],
    physical: { playing_age_min: 24, playing_age_max: 34, height_cm: 168 },
    performance: { languages: ["Deutsch"], dialects: ["Berlinerisch"] },
  };

  const create = await retryWithoutMissingOptionalProfileColumns(profile, optionalColumns, async (payload) => {
    storedProfiles.set("test-user", structuredClone(payload));
    return { data: { user_id: "test-user" }, error: null };
  });
  assert.deepEqual(create.unavailableFields, []);
  assert.deepEqual(storedProfiles.get("test-user"), profile);

  const edit = await retryWithoutMissingOptionalProfileColumns({ ...profile, bio: "Aktualisiert" }, optionalColumns, async (payload) => {
    storedProfiles.set("test-user", { ...storedProfiles.get("test-user"), ...structuredClone(payload) });
    return { data: { user_id: "test-user" }, error: null };
  });
  const reloaded = storedProfiles.get("test-user");
  assert.deepEqual(edit.unavailableFields, []);
  assert.equal(reloaded.bio, "Aktualisiert");
  assert.deepEqual(reloaded.profile_types, ["extra", "actor", "model"]);
  assert.deepEqual(reloaded.physical, profile.physical);
  assert.deepEqual(reloaded.performance, profile.performance);
});

test("existing profile can clear optional sedcard fields without losing its selected activities", async () => {
  const stored = {
    user_id: "test-user",
    display_name: "Mara Seidel",
    positions: ["Komparse"],
    profile_types: ["extra", "actor", "model"],
    physical: { height_cm: 168 },
    performance: { dialects: ["Berlinerisch"] },
  };
  const edit = await retryWithoutMissingOptionalProfileColumns(
    { physical: null, performance: null },
    new Set(["physical", "performance"]),
    async (payload) => {
      Object.assign(stored, structuredClone(payload));
      return { data: { user_id: stored.user_id }, error: null };
    },
  );

  assert.equal(edit.error, null);
  assert.deepEqual(stored.physical, null);
  assert.deepEqual(stored.performance, null);
  assert.deepEqual(stored.profile_types, ["extra", "actor", "model"]);
  assert.deepEqual(stored.positions, ["Komparse"]);
});
