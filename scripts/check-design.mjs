import { existsSync, readdirSync, readFileSync } from "node:fs";

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

const collectUiFiles = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return collectUiFiles(path);
    return /\.(?:ts|tsx|css)$/.test(entry.name) ? [path] : [];
  });

const adUiFiles = [...collectUiFiles("app"), ...collectUiFiles("components")];
const forbiddenAdvertisingPatterns = [
  ["ad placeholder component", /\bAdPlaceholder\b/],
  ["reserved ad layout", /\bad-side-reserved\b/],
  ["public ad placement copy", /Werbeplatz anfragen|Hier könnte deine Werbung stehen|Werbeplatz auf CineGenius/i],
  ["public link to the advertising page", /href\s*=\s*["']\/werben(?:["'/?#])/],
];

for (const path of adUiFiles) {
  const source = read(path);
  for (const [label, pattern] of forbiddenAdvertisingPatterns) {
    if (pattern.test(source)) failures.push(`Found ${label} in ${path}`);
  }
}

if (existsSync("components/AdPlaceholder.tsx")) {
  failures.push("The removed public ad placeholder component has returned");
}
if (!read("app/werben/page.tsx").includes('redirect("/")')) {
  failures.push("The former advertising page must redirect to the homepage");
}

for (const entry of readdirSync("messages", { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
  const messages = JSON.parse(read(`messages/${entry.name}`));
  if (Object.hasOwn(messages, "advertising")) {
    failures.push(`Obsolete advertising translations remain in messages/${entry.name}`);
  }
}

if (failures.length) {
  console.error("Shared design checks failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Shared design checks passed: six page headers, nav order, common layout rules, removed hero variant, and no public ad surfaces.");
