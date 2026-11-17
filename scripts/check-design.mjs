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

const mobileBrowsePages = [
  ["Projects", "app/projects/ProjectsContent.tsx"],
  ["Locations", "app/locations/LocationsLanding.tsx"],
  ["Marktplatz", "app/props/PropsContent.tsx"],
  ["Crew", "app/creators/CreatorsContent.tsx"],
  ["Firmen", "app/companies/CompaniesContent.tsx"],
  ["Jobs", "app/jobs/JobsContent.tsx"],
];
for (const [label, path] of mobileBrowsePages) {
  const source = read(path);
  if (!source.includes("<MobileBrowseControls")) {
    failures.push(`${label} must use the shared mobile browse controls (${path})`);
  }
  if (label !== "Locations" && !source.includes("mobile-bottom-nav-clear")) {
    failures.push(`${label} content must clear the fixed mobile navigation (${path})`);
  }
}
if (!read("app/locations/LocationsLanding.tsx").includes("mobile-bottom-nav-clear")) {
  failures.push("Location landing content must clear the fixed mobile navigation");
}

const navbar = read("components/Navbar.tsx");
const bottomNav = read("components/BottomNav.tsx");
const navigation = await import("../lib/site-navigation.ts");
const primaryItems = navigation.PRIMARY_NAV_ITEMS;
const expectedPrimary = [
  ["crew", "link", "/creators"],
  ["locations", "link", "/locations"],
  ["marketplace", "link", "/props"],
  ["jobs", "link", "/jobs"],
  ["companies", "link", "/companies"],
  ["news", "link", "/news"],
  ["more", "menu", null],
];
const primaryShape = primaryItems.map(({ id, kind, href }) => [id, kind, href ?? null]);
if (JSON.stringify(primaryShape) !== JSON.stringify(expectedPrimary)) {
  failures.push("Primary navigation must keep Crew, Locations, Marketplace, Jobs, Companies, News and More in the shared order");
}
const expectedMobile = [
  ["crew", "/creators"], ["marketplace", "/props"], ["news", "/news"],
  ["locations", "/locations"], ["companies", "/companies"],
];
const mobileShape = navigation.MOBILE_NAV_ITEMS.map(({ id, href }) => [id, href]);
if (JSON.stringify(mobileShape) !== JSON.stringify(expectedMobile)) {
  failures.push("Mobile navigation must keep Crew, Marketplace, News, Locations and Companies; messages and account belong in the header");
}
for (const [name, source, model] of [["Header", navbar, "PRIMARY_NAV_ITEMS"], ["Mobile", bottomNav, "MOBILE_NAV_ITEMS"]]) {
  if (!source.includes(model) || !source.includes("@/lib/site-navigation")) {
    failures.push(`${name} navigation must consume its shared ${model} model`);
  }
}
const browseDestinations = new Set(navigation.BROWSE_NAV_ITEMS.map(({ href }) => href));
for (const href of ["/", "/creators", "/locations", "/props", "/jobs", "/companies", "/projects", "/news", "/organizations"]) {
  if (!browseDestinations.has(href)) failures.push(`The shared menu must retain ${href}`);
}
const expectedAccount = [
  ["overview", "/dashboard"], ["public-profile", "/profile"], ["settings", "/dashboard?tab=settings"],
];
if (JSON.stringify(navigation.ACCOUNT_NAV_ITEMS.map(({ id, href }) => [id, href])) !== JSON.stringify(expectedAccount)) {
  failures.push("The portrait menu must keep exactly personal area, public profile and settings; sign-out remains an action");
}
const personalDestinations = new Set([...navigation.PERSONAL_CONTENT_ITEMS, ...navigation.PERSONAL_ACTIVITY_ITEMS].map(({ href }) => href));
for (const href of ["/profile", "/dashboard?tab=listings", "/dashboard?tab=bookings", "/company-dashboard", "/messages", "/messages?view=friends", "/favorites"]) {
  if (!personalDestinations.has(href)) failures.push(`The central personal area must retain ${href}`);
}
const personalHome = read("components/PersonalAreaHome.tsx");
if (!personalHome.includes("PERSONAL_CONTENT_ITEMS") || !personalHome.includes("PERSONAL_ACTIVITY_ITEMS")) {
  failures.push("The central personal area must render the shared content and activity destinations");
}
const personalSettings = read("components/PersonalSettings.tsx");
for (const token of ["/invoices", "PrivacySettings", "NotificationPreferences", "openUserProfile"]) {
  if (!personalSettings.includes(token)) failures.push(`Central account settings must preserve ${token}`);
}
if (!navbar.includes('href="/notifications"')) failures.push("Platform notifications must remain directly reachable through the header bell");
const appChrome = read("components/AppChrome.tsx");
if ([...appChrome.matchAll(/<BottomNav\b/g)].length !== 1) {
  failures.push("AppChrome must mount the mobile bottom navigation exactly once");
}
if (appChrome.includes("PersonalAreaNavigation") || /<nav\b[^>]*className=[^>]*\bfixed\b[^>]*\bbottom-0\b/.test(personalHome)) {
  failures.push("The central personal home must not reintroduce duplicate desktop or mobile navigation bars");
}

const styles = read("app/globals.css");
for (const selector of [".site-container", ".browse-toolbar", ".browse-card"]) {
  if (!styles.includes(selector)) failures.push(`Missing shared design rule ${selector}`);
}
for (const selector of [".mobile-browse-controls", ".mobile-filter-panel", ".mobile-filter-apply", ".mobile-bottom-nav-clear"]) {
  if (!styles.includes(selector)) failures.push(`Missing shared mobile browse rule ${selector}`);
}
if (!styles.includes("min-height: 46px") || !styles.includes("min-height: 48px")) {
  failures.push("Mobile browsing controls must keep 44px or larger touch targets");
}
const mobileFilters = read("components/MobileBrowseControls.tsx");
const nativeFilterDialog = /<dialog\b[^>]*aria-modal="true"/.test(mobileFilters) && mobileFilters.includes(".showModal()");
if (!nativeFilterDialog && !mobileFilters.includes('role="dialog" aria-modal="true"')) {
  failures.push("Mobile filters must remain an accessible dialog");
}
if (!/\.mobile-browse-controls\s*\{[^}]*background:\s*transparent\s*;/.test(styles)) {
  failures.push("The shared browse toolbar must leave the directory backdrop visible");
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
const menuOwners = adUiFiles.filter((path) => {
  const source = read(path);
  return source.includes("BROWSE_NAV_ITEMS");
});
if (menuOwners.length !== 1) {
  failures.push("One shared menu must render the public navigation model");
}
const publicMenu = readFileSync("components/SiteNavigationMenu.tsx", "utf8");
const accountMenu = readFileSync("components/Navbar.tsx", "utf8");
if (publicMenu.includes("ACCOUNT_NAV_ITEMS") || publicMenu.includes("SITE_NAV_SIGN_OUT_EVENT") || !accountMenu.includes("ACCOUNT_NAV_ITEMS.map")) {
  failures.push("Compact personal entry points and sign-out belong in the portrait menu, never in the public directory menu");
}
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
  if (Object.keys(messages.footer ?? {}).some((key) => /advertis|werben/i.test(key))) {
    failures.push(`A retired advertising link remains in messages/${entry.name}`);
  }
}

if (failures.length) {
  console.error("Shared design checks failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Shared design checks passed: six page headers and mobile controls, seven header items and five independent direct bottom links, shared menus, one mobile bar, common layout rules, removed hero variant, and no public ad surfaces.");
