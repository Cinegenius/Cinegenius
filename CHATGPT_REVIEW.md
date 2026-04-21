# CineGenius — Code Review Request

Ich habe mit Claude Code eine Web-App gebaut und möchte eine ehrliche, kritische Bewertung: Was ist gut gemacht? Was ist schlecht, riskant oder fehlt? Bitte sei direkt und nenn konkrete Probleme.

---

## Was ist CineGenius?

Ein Marktplatz für Film, Foto und Content in der DACH-Region. Ähnlich wie Airbnb + LinkedIn + Casting-Plattform in einem:
- Locations mieten
- Crew buchen (Kamera, Regie, Schnitt, etc.)
- Equipment leihen / Requisiten kaufen
- Jobs ausschreiben und bewerben
- Projekte im Portfolio zeigen
- Firmenprofile für Produktionsfirmen

**Zielgruppe:** Filmschaffende, Content Creator, Fotografen, Produktionsfirmen in DE/AT/CH.

---

## Tech Stack

- **Framework:** Next.js 16, React 19, App Router
- **Styling:** Tailwind CSS v4
- **Auth:** Clerk (JWT, Sessions, OAuth)
- **Datenbank:** Supabase (PostgreSQL + Realtime + Storage)
- **E-Mail:** Resend
- **Hosting:** Vercel
- **Fehlertracking:** Sentry
- **Sprache:** TypeScript

---

## Größe & Umfang

- **58 Seiten** (Next.js App Router)
- **43 API-Routen** (REST, alle in `/app/api/`)
- **34 Client-Komponenten**
- **Keine Tests**

---

## Alle Seiten (Routen)

```
/                          — Homepage
/sign-in, /sign-up         — Auth (Clerk)
/profile-setup             — Onboarding nach Registrierung
/profile/[slug]            — Öffentliches Profil (Schauspieler / Model / Crew)
/profile                   — Eigenes Profil bearbeiten
/dashboard                 — User-Dashboard (14 Tabs: Übersicht, Inserate, Jobs, Buchungen, Nachrichten, Freunde, Einnahmen, Auszahlungen, Transaktionen, Analysen, Merkliste, Firma, Einstellungen, Profil)
/creators                  — Filmschaffende entdecken
/creators/[slug]           — Creator-Detailseite
/locations                 — Locations entdecken (mit Karte)
/locations/[slug]          — Location-Detailseite
/jobs                      — Stellenanzeigen
/jobs/[slug]               — Job-Detail mit Bewerbungsformular
/props                     — Requisiten & Equipment Marktplatz
/props/[slug]              — Artikel-Detailseite
/vehicles                  — Fahrzeuge (Filmfahrzeuge, Oldtimer)
/vehicles/[slug]           — Fahrzeug-Detailseite
/marketplace               — Alle Kategorien Übersicht
/projects                  — Filmprojekte (Kategorie-Übersicht)
/projects/[id]             — Projektdetailseite mit Crew-Credits
/projects/neu              — Neues Projekt erstellen
/projects/alle             — Alle Projekte durchsuchen
/projects/film, /werbung, /foto … — Kategorie-Unterseiten
/companies                 — Firmenverzeichnis
/companies/[slug]          — Firmenprofil
/company-setup             — Firma erstellen/bearbeiten
/company-dashboard         — Firmen-Admin-Dashboard
/booking                   — Buchungsformular
/booking/checkout          — Checkout
/booking/confirmation      — Buchungsbestätigung
/messages                  — Nachrichten (Supabase Realtime)
/notifications             — Benachrichtigungen
/search                    — Globale Suche mit Tabs
/admin                     — Admin-Dashboard (Benutzer, Inserate, Verifizierungen, Provision)
/inserat                   — Neues Inserat erstellen (alle Typen)
/invoices                  — Rechnungen
/favorites                 — Merkliste
/pricing                   — Preisübersicht
/bts                       — Behind the Scenes (Magazin-Bereich)
/photo, /social-media      — Kategorie-Landingpages
/about, /help, /trust      — Statische Seiten
/agb, /datenschutz, /impressum — Rechtliches
```

---

## Alle API-Routen

```
GET/POST   /api/profile              — Profil lesen/erstellen (Supabase upsert + Clerk metadata sync)
PATCH      /api/profile              — Profil-Felder aktualisieren (Allowlist, column-stripping retry)
GET        /api/profile/by-id        — Profil nach Clerk user_id
PATCH      /api/profile/modules      — Profil-Module (Reihenfolge, aktiviert)
PATCH      /api/profile/physical     — Körpermaße (Schauspieler/Model)
GET/POST   /api/listings             — Inserate lesen/erstellen
PATCH/DEL  /api/listings/[id]        — Inserat bearbeiten/löschen
GET/POST   /api/bookings             — Buchungen
PATCH      /api/bookings/[id]        — Buchung annehmen/ablehnen
GET/POST   /api/applications         — Job-Bewerbungen
PATCH      /api/applications/[id]    — Bewerbung annehmen/ablehnen
GET/POST   /api/conversations        — Nachrichten-Konversationen
GET/POST   /api/conversations/[id]   — Nachrichten in Konversation
GET        /api/unread-count         — Ungelesene Nachrichten für Badge
GET/POST   /api/reviews              — Bewertungen lesen/schreiben
GET        /api/reviews/eligible     — Darf ich diese Person/dieses Inserat bewerten?
GET/POST   /api/projects             — Projekte
PATCH/DEL  /api/projects/[id]        — Projekt bearbeiten
GET/POST   /api/project-credits      — Crew-Credits zu Projekten
GET/POST   /api/project-festivals    — Festival-Einträge zu Projekten
DELETE     /api/project-festivals/[id]
GET/POST   /api/companies            — Firmenprofile
PATCH      /api/companies/[slug]     — Firma bearbeiten
GET/POST   /api/company-members      — Firmenmitglieder verwalten
GET/POST   /api/company-services     — Firmen-Leistungen
GET/POST   /api/company-equipment    — Firmen-Equipment
GET/POST   /api/friendships          — Freundschaftsanfragen
PATCH      /api/friendships/[id]     — Anfrage annehmen
GET/POST   /api/favorites            — Merkliste
GET/POST   /api/notifications        — Benachrichtigungen
GET        /api/recommendations      — Personalisierte Empfehlungen
GET        /api/search               — Globale Suche (profiles, listings, companies)
GET        /api/creators             — Creator-Liste mit Filtern
POST       /api/upload               — Bild-Upload zu Supabase Storage
POST       /api/upload/avatar        — Avatar-Upload
GET/POST   /api/external-profiles    — Externe Profile (IMDb, Instagram, etc.)
PATCH/DEL  /api/external-profiles/[id]
POST       /api/verification-requests — Verifizierungsantrag stellen
GET        /api/profile-views        — Profilaufrufe tracken/lesen
GET        /api/presence             — Online-Status
GET        /api/user-settings        — User-Einstellungen
GET        /api/admin/users          — Admin: Alle User
GET        /api/admin/listings       — Admin: Alle Inserate
```

---

## Datenbank (Supabase PostgreSQL)

Tabellen:
- `profiles` — Userprofile (display_name, bio, skills, positions, filmography, social links, day_rate, avatar_url, cover_image_url, profile_type, account_type, physical, crew, creative, vendor, modules, verified, available, languages, etc.)
- `listings` — Alle Inserate (type: location/job/prop/vehicle/creator, title, description, price, city, lat/lng, images, published)
- `bookings` — Buchungen (user_id, listing_id, start_date, end_date, status: pending/confirmed/rejected, total)
- `applications` — Job-Bewerbungen (applicant_id, job_id, cover_letter, status: pending/accepted/rejected)
- `conversations` + `messages` — Messaging (Supabase Realtime)
- `reviews` — Bewertungen (target_id, target_type, reviewer_id, rating 1–5, text, aspect_ratings)
- `favorites` — Merkliste
- `friendships` — Vernetzungen (sender_id, receiver_id, status: pending/accepted)
- `notifications` — Benachrichtigungen
- `projects` — Filmprojekte (title, year, type, director, description, poster_url, metadata)
- `project_credits` — Crew-Credits zu Projekten
- `project_festivals` — Festivalteilnahmen zu Projekten
- `companies` — Firmenprofile
- `company_members` — Firmenmitglieder
- `company_services`, `company_equipment` — Firmen-Daten
- `external_profiles` — Externe Plattformlinks (IMDb, Casting Networks, etc.)
- `profile_views` — Profilaufruf-Tracking
- `verification_requests` — Verifizierungsanträge
- `user_settings` — User-Einstellungen

Auth: Clerk (JWTs), Supabase mit `supabaseAdmin` (Service Role Key) für alle DB-Operationen.

---

## Wichtige Architektur-Entscheidungen

1. **Kein Supabase RLS** — Alle DB-Zugriffe laufen über `supabaseAdmin` (Service Role) in Next.js API Routes. Row Level Security in Supabase ist deaktiviert. Die Sicherheitslogik liegt in den API Routes.

2. **Clerk für Auth, Supabase nur für Daten** — Clerk verwaltet Sessions/JWTs, Supabase speichert alle App-Daten. Clerk `userId` ist der Fremdschlüssel in allen Tabellen.

3. **Alle API Routes sind Server-only** — Kein direkter Supabase-Zugriff vom Client. Client → Next.js API Route → Supabase Admin.

4. **Bewertungssystem** — Nur nach echten Transaktionen (confirmed booking oder accepted application) kann bewertet werden. Eligibility-Check in `/api/reviews/eligible`.

5. **Profil-Typen** — Ein User kann verschiedene Profil-Typen haben (Schauspieler, Model, Kameramann, Regisseur, etc.), jeder Typ hat ein eigenes UI-Layout.

6. **Kein Zahlungssystem** — Buchungen und Einnahmen existieren als Konzept im UI, aber Stripe/Payments sind nicht implementiert. Zahlung ist als "demnächst" markiert.

7. **Supabase Realtime** — Nur für Nachrichten und Benachrichtigungs-Badges genutzt.

8. **Bild-Upload** — Supabase Storage, komprimiert clientseitig vor Upload.

9. **E-Mails** — Resend für Willkommens-Mail, Buchungsbenachrichtigung, Nachrichten-Notification, Freundschaftsanfragen.

10. **Admin-Bereich** — Kein Middleware-Schutz, nur clientseitige Rolle-Prüfung. (`/admin` ist theoretisch für jeden erreichbar.)

---

## Bekannte Schwächen (die ich schon sehe)

- Kein Zahlungssystem (Buchungen sind nur "Mock")
- Admin ohne echten Middleware-Schutz
- Keine Tests (unit, integration, e2e)
- Keine Rate Limiting auf den meisten API-Routen
- Kein RLS in Supabase (alles über Service Role)
- Bilder von Dritten (Unsplash URLs direkt eingebettet, kein CDN-Proxy)
- `supabaseAdmin` Service Role Key im Backend — korrekt, aber ein Leak wäre fatal
- Einige Seiten haben `force-dynamic` ohne Caching-Strategie

---

## Fragen an dich (ChatGPT)

Bitte beantworte:
1. **Sicherheit:** Was sind die größten Sicherheitslücken? Priorisiert nach Risiko.
2. **Architektur:** Was ist an der Entscheidung "kein RLS, alles über API Routes" riskant oder falsch?
3. **Performance:** Was wird beim Skalieren Probleme machen?
4. **Fehlende Features:** Was fehlt für einen echten Launch?
5. **Was ist gut gemacht?** Wo sind echte Stärken?
6. **Was würdest du anders bauen?** Konkrete Alternativen nennen.
