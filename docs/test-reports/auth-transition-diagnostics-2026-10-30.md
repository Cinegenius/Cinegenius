# Weitere Safari-Konsolenmeldungen – 30.10.2026

Ausgangspunkt: Screenshots um 23:09:29, 23:10:53 und 23:11:42 Europe/Berlin, nach dem Authentifizierungsrelease `171e8a3`.

## Abgegrenzte Befunde

1. Die frühere fehlende Clerk-Nonce und die fortlaufenden 401-Abfragen sind auf diesen Screenshots nicht erneut zu sehen. Beim letzten Screenshot wird das angemeldete Dashboard angezeigt.
2. Das Google-Favicon für einen öffentlichen Crew-United-Link wird zu `t0.gstatic.com` umgeleitet. Die bestehende CSP erlaubt diese Bildquelle nicht. Der Bildfehler ist damit erklärt; er betrifft ein kleines externes Plattformsymbol, nicht das Profilfoto oder die Sitzung.
3. `/manifest.webmanifest` ist in der App vorhanden und erzeugt ein gültiges statisches JSON-Manifest, fehlte aber in der Liste öffentlicher Seiten. Der direkte Gastaufruf lieferte tatsächlich HTTP 307 nach `/sign-in?redirect_url=%2Fmanifest.webmanifest`. Der Browser erhielt dadurch HTML statt Manifest-JSON.
4. Die roten `_rsc`-Aufrufe sind Next.js-Navigations- beziehungsweise Vorladeanfragen während An-/Abmeldung. Lesende Gastproben für `/props` und `/projects/alle` liefern HTTP 200 mit `text/x-component`, ohne externe Umleitung. `/inserat` bleibt als geschützter Vorgang korrekt auf die gleichnamige interne Anmeldung umgeleitet.

Zusätzlich wurden die Vercel-Anfrageprotokolle des konkreten Screenshot-Zeitraums 22:10:30–22:11:50 UTC abgeglichen: Die dort verzeichneten `/props`-, `/companies`- und nach Anmeldung `/inserat`-Anfragen liefern HTTP 200. Beim Abmelden steht für das Manifest eine 307; nach der Anmeldung wurde es als 304 aus dem Cache beantwortet. Keine privaten Nachrichten, Cookies oder Sitzungstokens wurden ausgegeben.

Die erfolgreichen Serverantworten und das Auftreten ausschließlich beim Dokumentwechsel sprechen für browserseitig abgebrochene Vorladeanfragen. Das ist eine begründete Einordnung, kein vollständiger Nachweis des Safari-internen Abbruchgrundes jeder einzelnen Anfrage. Die öffentliche Erreichbarkeit wurde geprüft; eine neue, pauschale CORS-Freigabe wäre hierfür keine belegte Lösung und wurde nicht hinzugefügt. Die tatsächlichen Anmelde-, Abmelde-, Rücksprung- und Berechtigungsabläufe bleiben unverändert.

## Kleine Korrekturen

- `proxy.ts`: ausschließlich die exakte öffentliche Adresse `/manifest.webmanifest` ergänzt. Private Pfade und ähnlich benannte Unterpfade bleiben geschützt.
- `app/profile/[slug]/ProfileView.tsx`: verwendet sofort die schon vorhandenen farbigen Plattformkürzel (z. B. CU) statt des bisher fehlschlagenden Google-Favicon-Aufrufs. Profilverlinkung, Bezeichnung, optionale Zusatzbeschriftung, Ausblendung privater Links und Gestaltung bleiben erhalten. Keine zusätzliche CSP-Freigabe und keine neue Bildabhängigkeit.
- `lib/private-api-auth.test.mjs`: Regression für das öffentliche Manifest und den weiterhin verweigerten Zugriff auf private Seiten.
- `lib/profile-platform-icons.test.mjs`: die echte gemeinsame Komponente wird für alle 15 konfigurierten Plattformen gerendert. Richtige Ziele, sichtbare Kürzel, sichere externe Links, keine Fremdbildaufrufe sowie private/leere Einträge geprüft.

Keine Nutzerdaten, Einstellungen, Profile, Rechte oder Freigaben verändert. Keine neuen Oberflächentexte; sechs Kataloge bleiben unverändert.

## Prüfung

25 gezielte Tests: Plattformdarstellung, privates/public Manifest-Routing, bestehende private API-Schutzregeln, CSP-Nonce, sitzungsabhängige Inbox, Fehlerzustände und Lesebestätigungen. TypeScript, betroffener ESLint, Übersetzungsprüfung und Produktionsbuild bestanden.

Die gelben Schrift-Vorladehinweise sind keine fehlgeschlagene Anmeldung. An den bestehenden Schriften und am Schriftbild wurde nichts geändert. Globale Navigation, Sicherheitsregeln und Hintergrundfehler werden nicht unterdrückt; eine vollständige Beseitigung jeder Safari-Abbruchmeldung wird nicht behauptet.
