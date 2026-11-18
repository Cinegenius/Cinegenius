# Smart: multilingual craft language and inventory recall

18 November 2026. Implementation for the website and the shared Smart/Genie API.
This changes interpretation and matching, not directory design, stored occupation
IDs, member descriptions, visibility or Smart's temporary admin-only access.

## Recognition

- The server's generated recognition index covers 962 canonical occupations and
  their existing standard/masculine/feminine/neutral labels in all 17 locales.
  A French or Japanese profession can be searched while the interface is German.
  It is a separate compact label index, not seventeen runtime message bundles.
- Curated aliases recognize DP/DoP, camop, 1AC/2AC, foquista, chef élec, spark/sparky
  and a few unambiguous misspellings. Gaffer, electrician, grip and camera operator
  retain their separate meanings. Ambiguous short forms such as bare Best Boy or
  swing go to conversational clarification instead of a guessed specialization.
- Exact catalogue keyword lists keep the existing local interpretation path;
  unknown qualifiers, negation and complex grammar remain with the AI planner.
  Independent wishes keep independent cities and quantities. No dropped words,
  fuzzy member-name replacement or inferred private location is introduced.
- Latin accents are folded for lookup, while Japanese voicing marks and Korean
  syllables remain meaningful. This is recognition only, not an identity edit.

## Inventory

Generic lamps use the actual light-source group, including models whose titles
do not say lamp. Costume searches also include accessories such as hats. Specific
models and objects do not expand to all siblings. DMX nodes/desks are not lamps.
Public word evidence is checked before pagination, nearest alternatives and maps:
Hut does not match Schutz and English hat does not match the German auxiliary verb
in a description. A mixed equipment offer can still match if it actually includes
lamps. Publication, Ghost, geographic and other explicit constraints still apply.

Read-only checks against current eligible Munich offers found Aputure Nova P600C,
ARRI M18 and Godox KNOWLED F800R for generic lamps, and the Lodenfrey Bavarian hat
for costume/hat requests. No listings were edited or reclassified.

## Evidence, not model training

Public sources reviewed on 18 November 2026:

- [BVB occupation descriptions](https://bvb-verband.de/mitglieder/berufsbilder/):
  authoritative separation of lighting leadership, electricians and camera grip.
- [ScreenSkills: Gaffer](https://www.screenskills.com/job-profiles/browse/film-and-tv-drama/technical/gaffer-film-and-tv-drama/):
  lighting department terminology and responsibility.
- [CPNEF: chef électricien](https://www.cpnef-av.fr/films/chef-electricien):
  French lighting occupation terminology.
- [Congo Films School: first assistant / foquista](https://school.congofilms.tv/taller/1ER_ASISTENTE_DE_CAMARA_O_FOQUISTA/901):
  Spanish camera-assistant terminology.
- [Public filmmaker discussion](https://www.reddit.com/r/Filmmakers/comments/1lpxr7t/gaffer_vs_key_grip/):
  first-person shorthand such as DP, G&E and distinctions that depend on crew size
  and region. Used as a language sample, not an authoritative role definition.

X and Instagram did not yield usable accessible posts in this review; no claim
of reading private/login-only material. No posts, social identities or member
queries were imported into a training corpus. This is curated search vocabulary,
planner guidance and regression testing, not fine-tuning or automatic learning.

## Keeping it current

After changing catalogue labels, regenerate with:

```sh
node --experimental-strip-types --import ./scripts/register-test-aliases.mjs scripts/generate-smart-language-index.mts
```

`npm run check:i18n` rejects a stale generated index. Existing language catalogs
remain authoritative. Ambiguous translated aliases are not assigned arbitrarily
by the cross-language index. Changes to ordinary user-facing text still require
all 17 locales; this change adds no UI copy.

Regression coverage: all 17 languages, mixed-language craft/place requests,
gendered catalogue labels, shorthand, exact models, unknown modifiers, word-boundary
false positives, real Postgres inventory filtering, pagination/map consistency,
privacy, admin access and existing Genie behavior.

The guarded `--stage --evaluate-smart` mode adds at most 22 synthetic AI requests
to a stage build using the existing protected key. No key export, user history,
public test route, provider storage or retries. It checks 17 language requests and
specialized cases against the configured default and personal-quality models.
It does not assign live domains, and both content-changing workers stay disabled.
A normal build makes no evaluation calls. Never promote this worker-disabled stage.

Passing catalog and fixed-sentence checks does not establish reliability for every
dialect, inflected phrase, recording or microphone. Native audio/device testing
remains APP Entwicklung's responsibility. The API request/response contract is
unchanged; native clients using it receive the same server-side matching after
publication. Release and evaluation outcomes belong in the handoff receipt.
