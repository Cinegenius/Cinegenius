import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createTranslator } from "next-intl";
import ts from "typescript";
import { SUPPORTED_LOCALES } from "./i18n/locales.ts";

const require = createRequire(import.meta.url);
const pageSource = process.env.CINEGENIUS_PROJECT_HEADING_PAGE_SOURCE ?? new URL("../app/projects/page.tsx", import.meta.url);
const dictionaries = Object.fromEntries(SUPPORTED_LOCALES.map(locale => [locale, JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), "utf8"))]));
// Independent full native titles: never derive expected text from the new
// presentation fragments or from punctuation in the title.
const nativeTitles = {
  de: "Filmografien & Produktionen",
  en: "Filmographies & Productions",
  es: "Filmografías & Producciones",
  it: "Filmografie & Produzioni",
  cs: "Filmografie & Produkce",
  hu: "Filmográfiák & Produkciók",
  nl: "Filmografieën en producties",
  "nl-BE": "Filmografieën en producties",
  sv: "Filmografier och produktioner",
};
const translate = (locale, namespace) => createTranslator({ locale, namespace, messages: dictionaries[locale], onError(error) { throw error; } });
const link = ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children);
const image = ({ alt, className }) => React.createElement("img", { alt, className });
function compile(file, mocks) {
  const source = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", source)(name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    assert.ok(["react/jsx-runtime", "lucide-react"].includes(name), `Unexpected page dependency ${name}`);
    return require(name);
  }, module, module.exports);
  return module.exports;
}
function visibleText(markup) {
  return markup.replace(/<!--[\s\S]*?-->|<[^>]+>/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_all, value) => String.fromCodePoint(parseInt(value, 16)))
    .replace(/&#([0-9]+);/g, (_all, value) => String.fromCodePoint(Number(value)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}
const headerModule = compile(new URL("../components/PageHeader.tsx", import.meta.url), { "next/link": link, "@/components/MediaImage": image });
const directoryModule = compile(new URL("../components/DirectoryPage.tsx", import.meta.url), {
  "@/components/PageHeader": headerModule,
  "@/components/AiDisclosureBadge": () => null,
});

for (const locale of SUPPORTED_LOCALES) test(`${locale}: actual Projects page and shared PageHeader render exactly the complete native title`, async () => {
  assert.ok(Object.hasOwn(nativeTitles, locale));
  const t = translate(locale, "projects");
  assert.equal(t("title"), nativeTitles[locale], "Complete catalog title remains independently available to metadata and other consumers");
  const page = compile(pageSource, {
    "next/link": link, "@/components/MediaImage": image, "@/components/PageHeader": headerModule,
    "@/components/DirectoryPage": directoryModule,
    "@/lib/projects-browse-server": { getBrowseProjects: async () => [] }, "@/app/projects/ProjectsContent": () => null,
    "next-intl/server": { getTranslations: async namespace => translate(locale, namespace) },
  });
  const html = renderToStaticMarkup(await page.default());
  const headings = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)];
  assert.equal(headings.length, 1);
  assert.equal(visibleText(headings[0][1]), nativeTitles[locale], "No repeated conjunction, missing tail or extra project word");
  assert.equal(visibleText(headings[0][1]), t("title"));
  assert.ok(headings[0][1].includes("<span"), "The existing highlighted title remains rendered by PageHeader");
  const metadata = await page.generateMetadata();
  assert.equal(metadata.title, translate(locale, "Metadata")("m_df87bfa7519b"), "Existing full metadata title remains unchanged");
});
