import { existsSync, readFileSync } from "node:fs";

const failures = [];
const read = (path) => readFileSync(path, "utf8");
const sharedPages = [
  ["Projects", "app/projects/page.tsx"],
  ["Locations", "app/locations/LocationsLanding.tsx"],
  ["Marktplatz", "app/props/page.tsx"],
  ["Crew", "app/creators/page.tsx"],
  ["Firmen", "app/companies/page.tsx"],
  ["Jobs", "app/jobs/JobsContent.tsx"],
];

for (const [label, path] of sharedPages) {
  const source = read(path);
  if (!source.includes("PageHeader") || !source.includes("<PageHeader")) {
    failures.push(`${label} must use the shared PageHeader (${path})`);
  }
}

const navbar = read("components/Navbar.tsx");
const bottomNav = read("components/BottomNav.tsx");
const expectedDestinations = ["/locations", "/creators", "/jobs", "/props", "/projects", "/companies"];
const extractDestinations = (source, start, end) => {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from);
  if (from < 0 || to < 0) return [];
  return [...source.slice(from, to).matchAll(/href:\s*"([^"]+)"/g)].map((match) => match[1]);
};

const desktopDestinations = extractDestinations(navbar, "const desktopNavHrefs = [", "] as const;");
const mobileDestinations = extractDestinations(bottomNav, "const items = [", "] as const;");
if (JSON.stringify(desktopDestinations) !== JSON.stringify(expectedDestinations)) {
  failures.push(`Desktop navigation order differs: ${desktopDestinations.join(", ")}`);
}
if (JSON.stringify(mobileDestinations) !== JSON.stringify(expectedDestinations)) {
  failures.push(`Mobile navigation order differs: ${mobileDestinations.join(", ")}`);
}

const styles = read("app/globals.css");
for (const selector of [".site-container", ".browse-toolbar", ".browse-card"]) {
  if (!styles.includes(selector)) failures.push(`Missing shared design rule ${selector}`);
}
if (!styles.includes("background: var(--color-bg-primary)")) {
  failures.push("Browse filters must keep the solid page background");
}
if (existsSync("components/CategoryHero.tsx")) {
  failures.push("The superseded CategoryHero layout has returned");
}

if (failures.length) {
  console.error("Shared design checks failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Shared design checks passed: all six page headers, nav order, common layout rules, and removed hero variant.");
