import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../scripts/deploy-production.mjs", import.meta.url), "utf8");
const executable = source.replace(/^import .+;\r?$/gm, "");
const fingerprint = source.match(/const expectedProjectIdentity = "([a-f0-9]{64})";/)?.[1];
assert.ok(fingerprint, "The exact production project identity must be pinned");
const project = { projectName: "cinegenius", projectId: "prj_fixture_cinegenius", orgId: "team_fixture_cinegenius" };
const head = "a".repeat(40);
class Exit extends Error { constructor(status) { super("controlled exit"); this.status = status; } }

/** Execute the real guard with synthetic Git/config/command transports only.
 * Fixture IDs stand in for the opaque production identity; the real private
 * project identifiers never enter this test or a public repository. */
function fixture(args = [], options = {}) {
  const calls = [], reads = [], messages = [], env = { ...(options.env ?? {}) };
  const gitValues = {
    "branch --show-current": options.branch ?? "main",
    "status --porcelain --untracked-files=all": options.dirty ?? "",
    "rev-parse HEAD": options.head ?? head,
    "rev-parse origin/main": options.origin ?? head,
  };
  let status = 0, error;
  try {
    runInNewContext(executable, {
      process: { argv: ["node", "scripts/deploy-production.mjs", ...args], env, exit(code) { throw new Exit(code); } },
      console: { log(...values) { messages.push(values.join(" ")); }, error(...values) { messages.push(values.join(" ")); } },
      readFileSync(path, encoding) {
        reads.push(path);
        assert.equal(path, ".vercel/project.json"); assert.equal(encoding, "utf8");
        if (options.missingProject) throw new Error("missing fixture config");
        return options.invalidJson ? "{invalid" : JSON.stringify(Object.hasOwn(options, "project") ? options.project : project);
      },
      createHash(algorithm) {
        assert.equal(algorithm, "sha256");
        let value;
        return { update(input) { value = input; return this; }, digest(format) {
          assert.equal(format, "hex");
          return value === JSON.stringify([project.projectId, project.orgId]) ? fingerprint : createHash(algorithm).update(value).digest(format);
        } };
      },
      execFileSync(command, argv, commandOptions) {
        calls.push({ command, argv: [...argv], options: { ...commandOptions } });
        const call = `${command} ${argv.join(" ")}`;
        if (options.fail === call || (options.fail === "deploy" && command === "npx")) throw new Error("simulated command failure");
        if (command === "git") {
          assert.ok(Object.hasOwn(gitValues, argv.join(" ")), call);
          return gitValues[argv.join(" ")];
        }
        assert.ok(command === "npm" || command === "npx", `No real or unexpected command: ${call}`);
        return "";
      },
    });
  } catch (caught) { status = caught instanceof Exit ? caught.status : 1; error = caught; }
  return { status, error, calls, reads, messages, env, cloud: calls.filter(call => call.command === "npx") };
}

test("normal publication retains the exact existing gates and production deploy arguments", () => {
  const result = fixture();
  assert.equal(result.status, 0);
  assert.deepEqual(result.calls.map(call => [call.command, ...call.argv]), [
    ["git", "branch", "--show-current"], ["git", "status", "--porcelain", "--untracked-files=all"],
    ["git", "rev-parse", "HEAD"], ["git", "rev-parse", "origin/main"],
    ["npm", "run", "check:design"], ["npm", "run", "check:i18n"],
    ["npx", "vercel", "deploy", "--prod", "--yes", "--logs"],
  ]);
  assert.deepEqual(result.cloud[0].options, { stdio: "inherit" });
});

test("stage uses production configuration with a disabled worker and no domain assignment or promotion", () => {
  const env = { LISTING_FRESHNESS_ENABLED: "true" };
  const result = fixture(["--stage"], { env });
  assert.equal(result.status, 0); assert.equal(result.cloud.length, 1);
  assert.deepEqual(result.cloud[0].argv, ["vercel", "deploy", "--prod", "--yes", "--logs", "--skip-domain", "--env", "LISTING_FRESHNESS_ENABLED=false"]);
  assert.deepEqual(result.calls.filter(call => call.command === "npm").map(call => call.argv), [["run", "check:design"], ["run", "check:i18n"]]);
  assert.equal(result.calls.some(call => call.argv.includes("alias") || call.argv.includes("promote")), false);
  assert.deepEqual(result.env, env, "The deployment override must not mutate local or project environment settings");
});

test("a normal guard run after stage has no carried worker override, skip-domain, promotion or prebuilt artifact", () => {
  const stage = fixture(["--stage"], { env: { LISTING_FRESHNESS_ENABLED: "true" } });
  const normal = fixture([], { env: stage.env });
  assert.equal(normal.status, 0);
  assert.deepEqual(normal.cloud[0].argv, ["vercel", "deploy", "--prod", "--yes", "--logs"]);
  assert.equal(normal.cloud[0].options.env, undefined);
});

test("unknown, combined, duplicate and positional arguments fail before any command or project read", () => {
  for (const args of [["--stgae"], ["--stage=true"], ["--stage", "--stage"], ["--prod"], ["--stage", "--env", "LISTING_FRESHNESS_ENABLED=true"], ["--help", "--stage"], ["--token", "DO_NOT_PRINT_SECRET"], ["other-directory"], ["--", "--stage"]]) {
    const result = fixture(args);
    assert.equal(result.status, 1, args.join(" ")); assert.deepEqual(result.calls, []); assert.deepEqual(result.reads, []);
    assert.match(result.messages.join(" "), /unsupported arguments/);
    assert.doesNotMatch(result.messages.join(" "), /DO_NOT_PRINT_SECRET/);
  }
});

test("help is read-only and explains the rebuild and prohibition on promoting stage", () => {
  for (const option of ["--help", "-h"]) {
    const result = fixture([option]);
    assert.equal(result.status, 0); assert.deepEqual(result.calls, []); assert.deepEqual(result.reads, []);
    assert.match(result.messages.join(" "), /normal command again/); assert.match(result.messages.join(" "), /Never promote or alias/);
  }
});

for (const args of [[], ["--stage"]]) {
  const mode = args.length ? "stage" : "normal";
  test(`${mode}: detached/wrong branch, tracked/untracked changes and unequal heads cannot reach gates or cloud`, () => {
    for (const options of [{ branch: "feature" }, { branch: "" }, { dirty: " M app/file.ts" }, { dirty: "?? own-new-file" }, { head: "b".repeat(40) }, { origin: "b".repeat(40) }, { fail: "git rev-parse origin/main" }]) {
      const result = fixture(args, options);
      assert.equal(result.status, 1); assert.equal(result.calls.some(call => call.command !== "git"), false);
      assert.deepEqual(result.reads, []);
    }
  });
  test(`${mode}: missing, malformed and same-named foreign project/team configurations are rejected`, () => {
    for (const options of [{ missingProject: true }, { invalidJson: true }, { project: null }, { project: {} },
      { project: { ...project, projectName: "different" } }, { project: { ...project, projectId: "prj_foreign" } },
      { project: { ...project, orgId: "team_foreign" } }, { project: { ...project, projectId: "" } }, { project: { ...project, orgId: 42 } }]) {
      const result = fixture(args, options);
      assert.equal(result.status, 1); assert.equal(result.cloud.length, 0); assert.equal(result.calls.some(call => call.command === "npm"), false);
    }
  });
  test(`${mode}: conflicting Vercel identity environment overrides are rejected; matching identities remain usable`, () => {
    for (const env of [{ VERCEL_PROJECT_ID: "prj_foreign" }, { VERCEL_ORG_ID: "team_foreign" }]) {
      const result = fixture(args, { env }); assert.equal(result.status, 1); assert.equal(result.cloud.length, 0);
    }
    const result = fixture(args, { env: { VERCEL_PROJECT_ID: project.projectId, VERCEL_ORG_ID: project.orgId } });
    assert.equal(result.status, 0); assert.equal(result.cloud.length, 1);
  });
  test(`${mode}: gate failures stop before deployment and a deployment failure cannot trigger an alias, retry or promotion`, () => {
    for (const fail of ["npm run check:design", "npm run check:i18n"]) {
      const result = fixture(args, { fail }); assert.equal(result.status, 1); assert.equal(result.cloud.length, 0);
    }
    const result = fixture(args, { fail: "deploy" }); assert.equal(result.status, 1); assert.equal(result.cloud.length, 1);
    assert.equal(result.calls.at(-1).command, "npx");
  });
}
