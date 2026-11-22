import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const expectedProjectName = "cinegenius";
// Fingerprint of the established ignored projectId/orgId pair. Keep the
// account-specific identifiers themselves out of the public repository.
const expectedProjectIdentity = "f73ed5418f13e7f6803545669840fc128d1a217558ddc63820be15a73f107b27";

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function fail(message) {
  console.error(`Production release stopped: ${message}`);
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length === 1 && ["--help", "-h"].includes(args[0])) {
  console.log(`Usage:
  npm run deploy:production             Publish a new production build normally.
  npm run deploy:production -- --stage  Build with production configuration,
                                      without assigning production domains;
                                      listing freshness worker disabled.
  npm run deploy:production -- --stage --prepare-locales
                                      Prepare the eight approved language drafts
                                      using the existing build-only AI access.

Both modes require clean main at origin/main and the established CineGenius project.
After staged checks, run the normal command again to build with the ordinary
production configuration. Never promote or alias the worker-disabled staged build.
No other arguments are accepted.`);
  process.exit(0);
}
const prepareLocales = args.length === 2 && args[0] === "--stage" && args[1] === "--prepare-locales";
const stage = (args.length === 1 && args[0] === "--stage") || prepareLocales;
if (args.length && !stage) fail("unsupported arguments; use --help for the two supported release modes");

const branch = git("branch", "--show-current");
if (branch !== "main") fail(`expected branch main, found ${branch || "detached HEAD"}`);

const dirty = git("status", "--porcelain", "--untracked-files=all");
if (dirty) fail("working tree has uncommitted or untracked files; commit and push the release first");

const head = git("rev-parse", "HEAD");
const originMain = git("rev-parse", "origin/main");
if (head !== originMain) fail(`HEAD (${head}) does not match origin/main (${originMain})`);

let project;
try {
  project = JSON.parse(readFileSync(".vercel/project.json", "utf8"));
} catch {
  fail("could not read .vercel/project.json; link the CineGenius project before releasing");
}
if (project?.projectName !== expectedProjectName || typeof project.projectId !== "string" || typeof project.orgId !== "string"
  || createHash("sha256").update(JSON.stringify([project.projectId, project.orgId])).digest("hex") !== expectedProjectIdentity) {
  fail("this folder is not linked to the CineGenius production project");
}
if ((process.env.VERCEL_PROJECT_ID && process.env.VERCEL_PROJECT_ID !== project.projectId)
  || (process.env.VERCEL_ORG_ID && process.env.VERCEL_ORG_ID !== project.orgId)) {
  fail("Vercel environment overrides disagree with the established CineGenius project");
}

console.log(stage
  ? `Building CineGenius ${head} with production configuration for staged checks; domains unchanged and freshness worker disabled…`
  : `Building and deploying CineGenius ${head} to production…`);
execFileSync("npm", ["run", "check:design"], { stdio: "inherit" });
execFileSync("npm", ["run", "check:i18n"], { stdio: "inherit" });
// Build on Vercel so production secrets stay in the project environment. `vercel pull`
// redacts sensitive values in local files; a prebuilt upload would then compile with
// placeholders instead of the real production configuration.
// Keep the checker and other build-only Node subprocesses below the standard
// 8 GiB container limit. The full strict checker passed within this heap bound;
// an unbounded staged build was killed by the container's OOM guard. These are
// build overrides only: runtime settings, type checks and project limits stay
// unchanged, and stage and production use the same checking configuration.
const deployArgs = ["vercel", "deploy", "--prod", "--yes", "--logs",
  "--build-env", "NODE_OPTIONS=--max-old-space-size=3072",
  "--build-env", "VERCEL_BUILD_SYSTEM_REPORT=1"];
if (stage) deployArgs.push("--skip-domain", "--env", "LISTING_FRESHNESS_ENABLED=false", "--env", "PROFILE_ART_WORKER_ENABLED=false");
if (prepareLocales) deployArgs.push("--build-env", "CG_PREPARE_LOCALES=1");
execFileSync("npx", deployArgs, { stdio: "inherit" });
