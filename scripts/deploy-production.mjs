import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const expectedProjectName = "cinegenius";

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function fail(message) {
  console.error(`Production release stopped: ${message}`);
  process.exit(1);
}

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
if (project.projectName !== expectedProjectName || !project.projectId || !project.orgId) {
  fail("this folder is not linked to the CineGenius production project");
}

console.log(`Building and deploying CineGenius ${head} to production…`);
execFileSync("npm", ["run", "check:design"], { stdio: "inherit" });
execFileSync("npx", ["vercel", "pull", "--yes", "--environment", "production"], { stdio: "inherit" });
execFileSync("npx", ["vercel", "build", "--prod"], { stdio: "inherit" });
execFileSync("npx", ["vercel", "deploy", "--prebuilt", "--prod"], { stdio: "inherit" });
