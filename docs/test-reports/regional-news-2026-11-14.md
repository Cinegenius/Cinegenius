# Regional industry news — 14 November 2026

Status: implementation on the website feature branch; not published. No production database writes or migrations. Existing Work menu and movable Genie/app notice commits remain unpublished on this branch as well.

## Behaviour

- Homepage “Aus der Branche” and `/news` share an explicit country preference. Choices are Automatic, All countries, and countries represented by eligible public entries (plus unassigned entries). A requested country without content stays selected with an honest empty state, rather than showing another country's entries.
- Automatic resolves the current account's saved profile country first, then the coarse `x-vercel-ip-country` request header, otherwise all countries. No browser GPS prompt, IP lookup provider, exact coordinates or inferred-country persistence.
- Explicit preferences are functional `cg_news_country_<scope>` cookies, one year, SameSite=Lax, Secure on HTTPS. The scope is `guest` or a shortened SHA-256 of the current account ID; no raw account ID or profile location is stored. Guest/account/other-account preferences cannot overwrite each other's defaults. Blocked cookies retain the prior choice and show a localized error. URL country parameters win on the News page, so real Back navigation restores the prior results; manual changes on either page persist for future visits.
- UI language remains explicit `cg_locale` first, then supported weighted browser preferences. Only when both are unavailable does coarse country supply a supported language fallback. Multilingual countries have no guessed language override. Member/source article copy is never automatically translated.
- Public source cards retain their existing layout and media. The added country selector is limited to news; the neighboring organization directory links remain general discovery.

## Country/data boundaries

An entry's own country wins. Without a specific entry city, an explicit source country (canonical, or unambiguous country label in its legacy service-region text) can supply editorial country relevance. This does not verify a venue or modify saved places. City names alone never imply a country; a specific unqualified venue remains unassigned. Multiple country names in a legacy region remain ambiguous.

The existing paginated facet scan supplies only public metadata for country matching. It exhausts every page, rather than truncating at 1,000 records, and is deduplicated within a React server render. Full content loads only for the three homepage cards or the 24 selected News-page IDs. Both entry and source approvals are checked again before those content reads; no cross-request permission caching or new public API access. A failed metadata page is an error, never a falsely complete country list. Home excludes expired/ended events; the main News directory retains its existing ended-event archive.

Initial read-only production check found 13 public entries. A repeat during the browser run found a newly published Swiss entry: now 9 DE, 4 CH, 1 unassigned, 0 IT. Country result counts and returned rows agreed. No production member content was edited or translated.

## Verification

- Regression coverage: public approval withdrawal, entry-vs-source precedence, unassigned and missing countries, search/type combinations, 24-item pagination, more than 1,000 metadata rows, interrupted reads, cookie rejection, account/guest isolation, manual/browser/geo language priority, existing media privacy, and all nine editorial locales.
- Final regression suite: **57 passed**. Production build passed, including TypeScript and `check:i18n` (nine catalogs, 7,821 keys). ESLint has zero errors; the untouched `Metadata` import in the existing privacy page produces one pre-existing warning.
- **17 browser checks passed**: initial Italy/Italian, only populated country options, persisted DE/CH selection across homepage/News/reload/real Back, automatic/all reset, twelve viewport/locale cases (320, 393, 834, 1440 CSS px; all nine locales), blocked-cookie recovery, and no page runtime errors. Dropdowns have 44px height and no horizontal page overflow.
- Four additional real HTTP render checks passed: browser Italian in DE, browser German in IT, unsupported French plus IT fallback, and an explicit English cookie overriding Italian/browser geography.
- Final isolated desktop image check: all nine news thumbnails/source logos loaded successfully. The rapid multi-locale run temporarily showed missing preview images; no media permissions, image URLs or image-loader code were changed. The final screenshot is `news-desktop-final.png`.
- Evidence: `/srv/cinegenius/audits/20261114-regional-news/` (aggregate public-data results, test/build logs, browser script, screenshots).

## App coordination and limits

APP Entwicklung must implement the same preference precedence in native screens, preserve native language overrides, and retain the distinction between original article language and UI language. This website implementation changes no public API or database schema. Country/source logic and the metadata projection are reusable; exact device geolocation is not requested.

Browser checks use a local production build through the production browser origin, a simulated coarse IT header, and read-only public source data. They do not constitute real iPhone/iPad, Safari or Xcode testing. Private account selection is verified by account-scoped handler tests; no real user login or private profile data was used in browser checks. The functional cookie/geo use is documented in the privacy notice as an additional German original paragraph; approved legal translations and the separate operator/legal draft remain separate work.
