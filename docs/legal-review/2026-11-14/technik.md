# Abgleich mit der tatsächlichen Implementierung

Basis vor Änderung: `1dc2486f8a325c5649b5a6704b11c165c567fc1e`.

| Verarbeitung/Aussage | geprüfte Implementierung / Befund |
|---|---|
| Registrierung | `components/AuthForm.tsx`: Rechtslinks vor Kontoerstellung, zusätzliche Clerk-Annahme nur wenn dort angefordert. Kein eigener versionierter Zustimmungsnachweis für alle Nutzer. |
| Datenbankregion | Authentifizierte Supabase-Projektmetadaten: `eu-central-1`, ACTIVE_HEALTHY. Kein Schluss auf sämtliche Subprozessororte. |
| Newsletter | `lib/newsletter.ts`, `app/api/newsletter/*`: separate Anmeldung, Bestätigungslink und Widerruf. |
| Private Formulare | private Form-Draft-API/Migrationen und private Clerk-Einrichtungsmetadaten; nicht als öffentliche Veröffentlichung beschrieben. |
| Chats/Gruppen | `app/api/conversations/*`, `message_read_receipts.sql`, `20261113235706_private_message_attachments.sql`: Mitgliedschaft, Beitrittsgrenzen, Lesestände, private Dateiabrufe. Keine E2E-Verschlüsselung. |
| Genie | `lib/genie-server.ts`: OpenAI Responses, `store: false`, begrenzte Texte, keine allgemeinen Kontodaten-/Datenbankwerkzeuge; pseudonyme Ratenzähler. `lib/genie-conversation.ts`: begrenzter SessionStorage-Verlauf, beim Lesen max. 24 Stunden. |
| Freiwillige Analyse | `components/ProductAnalytics.tsx`, `lib/analytics-consent.ts`, `lib/analytics-policy.ts`: nach Zustimmung, öffentliche erlaubte Kategorien, EU-Host, keine automatischen Klicks, keine Replays; Einwilligung lokal gespeichert. |
| Parallele Analyse | `app/layout.tsx`: bisher unabhängig eingebundene Vercel Analytics/Speed Insights entfernt. PostHog-Zustimmung wurde nicht auf weitere Anbieter erweitert. |
| Sentry | Nur vorbereitete Konfigurationen, keine Instrumentation-Initialisierung gefunden. Replay deaktiviert. Keine Behauptung, dass ein installierter SDK bereits laufend übermittelt. |
| Karten | `lib/map-style.ts`: OpenFreeMap; `lib/location-map-geocoding.ts`: verbleibende serverseitige Nominatim-Abfrage für Location-Städte mit 24-Stunden-Revalidierung. |
| Suchhistorie/Sprache | Lokale Historie von tatsächlicher serverseitiger Suche unterschieden. `app/api/locale/route.ts`: gewünschte Sprache in Cookie, ein Jahr. |
| Profilstatistik | `lib/profile-views.ts`: Konto-/Tagesbezug, keine anonymen Profilbesucher. `app/api/presence/route.ts`: zuletzt gesehen, nicht automatisch bei Logout gelöscht. |
| Regionale Reihenfolge | `lib/browse-geography.ts`: Stadt, Region, Land, weitere Länder; keine laufende GPS-Ortung. |
| Bewertungen | `lib/rating-ranking.ts`: Vertrauensgewichtung nach Anzahl/Höhe; Anfragen/Bewerbungen kein Nachweis tatsächlich abgeschlossenen Kaufs. |
| Zahlungen | Stripe nur vorbereitete Bibliothek/Webhook; keine normale automatische Zahlung aus einer Anfrage. Bestehende gesonderte Support-Vermittlung bleibt ausdrücklich zu beauftragen. |
| Kontolöschung | `app/api/account/route.ts`: vorher ignorierte Datenbankfehler sichern jetzt den Clerk-Account gegen unbeabsichtigte finale Löschung bei Fehlern. Keine Behauptung vollständiger atomarer Löschung aller Tabellen/Dateien. |
| Deutsche Originale | Fünf Rechtstextseiten rendern mit `getTranslations({locale:'de'})` und `lang='de'`. Originalhinweis in allen neun Sprachen; API-/Formulartexte behalten aktive Sprache. |
| Ladeumfang | Neue Rechtstext-Namensräume in generiertem Client-Filter berücksichtigt; lange Absätze werden nicht an jede Seite mitgegeben. |

Es wurden keine realen Konten gelöscht, keine Originaldateien verändert, keine Veröffentlichungsrechte vergeben und keine Mitglieder automatisch neuen Bedingungen unterstellt.
