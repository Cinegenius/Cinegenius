# Navigation bei An-/Abmeldung – 30.10.2026

## Anlass und Abgrenzung

Ein weiterer Screenshot um 23:40:19 Europe/Berlin zeigt neben Next.js-RSC-Anfragen auch abgebrochene Clerk-`environment`-/`client`- und Blob-Aufrufe. Der vorherige Manifest-/Favicon-Fix kann diese separate Klasse von Meldungen nicht beheben. Ein sichtbares Dashboard allein beweist keinen vollständig fehlerfreien Sitzungswechsel.

Direkter lesender Abgleich ohne Cookies/Sitzungstokens: Sowohl `https://www.cinegenius.co` als auch `https://cinegenius.co` erhalten für die öffentlichen Clerk-Endpunkte `/v1/environment` und `/v1/client` HTTP 200, eine passende konkrete `Access-Control-Allow-Origin`-Antwort, `Access-Control-Allow-Credentials: true` und `Vary: Origin`. Die App-CSP erlaubt den Clerk-Host bereits. Daraus folgt keine fehlende pauschale CORS-Freigabe; solche Freigaben wurden nicht ergänzt.

## Gefundene Konkurrenz im eigenen Code

`finalizeThenNavigate` sammelte das von Clerk dekorierte Ziel in dessen Navigationscallback zunächst nur ein. Erst nach Auflösung des gesamten `finalize`-Aufrufs wurde navigiert. In der dazwischenliegenden Phase veröffentlicht Clerk den neuen Sitzungszustand und der Next.js-SDK stößt eine Aktualisierung der alten Route an. Anschließend ersetzte der eigene Code das Dokument mit `window.location.replace`, selbst für normale interne Ziele. Dadurch können gerade neu gestartete Aufrufe erneut abgebrochen werden.

Diese Reihenfolge wurde gegen die aktuelle offizielle Core-3-Anleitung, den installierten Next.js-SDK 7.9.21 sowie das tatsächlich öffentlich geladene Clerk-JS 6.41.0 abgeglichen. In Clerk erfolgt die Token-/Sitzungsvorbereitung vor dem vorgesehenen Navigationscallback. Die Anleitung sieht Navigation innerhalb dieses Callbacks vor, bevor der neue Authentifizierungszustand an Beobachter weitergereicht wird.

## Korrektur

- `lib/sign-in-flow.ts`: Navigation direkt im autorisierten Clerk-Callback, je Abschluss höchstens einmal. Keine zusätzliche Navigation nach Auflösung von `finalize`, keine künstliche Pause und kein Abschalten der SDK-Sitzungsprüfung.
- `components/AuthForm.tsx`: normale interne Ziele über den vorhandenen Next.js-Router mit `replace`. Kein Dokumentneustart für diesen Fall. Von Clerk dekorierte externe HTTPS-Ziele, insbesondere der Safari-ITP-Cookie-Touch, behalten die erforderliche Dokumentnavigation. Anmeldung und Registrierung verwenden denselben Ablauf. Bestehende Passwort-, E-Mail-Code-, MFA-, Rücksprung- und Profilsetup-Regeln bleiben erhalten.
- `lib/sign-in-flow.test.mjs`: Reihenfolge am autorisierten Callback und Schutz gegen doppelte Navigationsaufrufe nachgewiesen; fehlgeschlagene Aktivierung ohne Navigationsfreigabe startet keine Weiterleitung.
- `lib/auth-navigation.test.mjs`: echte Navigationsfunktion aus der Komponente für interne Dashboard-/Setup-/Inserat-Ziele, absolute gleichnamige Ziele, externe Clerk-ITP-Ziele und unsichere URLs geprüft.

Die Abmeldung verwendet weiterhin die unterstützte Clerk-`signOut`-Funktion. Kein Austausch gegen unbestätigtes lokales Abmelden; insbesondere werden keine Sitzungen, Cookies oder Tokens durch selbst gebaute Logik ersetzt. Bereits gespeicherte Konten und Inhalte bleiben unverändert.

## Tests und Grenzen

385 gezielte automatisierte Tests bestanden: Authentifizierungsstatus und MFA-Zuordnung, Abschluss-/Navigationsreihenfolge, Sitzungsabhängigkeit und Abbruch der Inbox, Lesestatus, Rollen-/API-Schutz und sichere Rücksprünge. TypeScript, ESLint der betroffenen Dateien, die sechs Sprachkataloge und der Produktionsbuild bestanden. Keine neuen Oberflächentexte oder Abhängigkeiten.

Ein vollständiger echter Safari-Ab-/Anmeldevorgang wird mit dem Nutzer nach Veröffentlichung abgeglichen; dafür werden keine Passwörter oder Codes im Chat benötigt. Bis dahin ist das kein bestandener Produktions-End-to-End-Test.

Auch nach der Korrektur kann eine tatsächlich erforderliche externe Safari-Cookie-Weiterleitung alte Anfragen beenden. Eine erfolgreiche Anmeldung, passende Serverantworten und die Phase nach der Navigation müssen deshalb getrennt von einzelnen browserseitigen Abbruchmeldungen geprüft werden. Es wird keine generelle Beseitigung sämtlicher WebKit-Konsoleneinträge versprochen. Diagnosemeldungen werden nicht unterdrückt.

## Primärquellen

- [Clerk Core 3: finalize und Navigationscallback](https://clerk.com/articles/from-setactive-to-finalize-migrating-custom-auth-flows-to-clerk-core-3).
- [Clerk: eigener Anmeldeablauf](https://clerk.com/docs/guides/development/custom-flows/authentication/sign-in-or-up).
- Lokaler SDK: `node_modules/@clerk/nextjs/dist/esm/app-router/client/ClerkProvider.js`.
- Öffentlich ausgeliefertes SDK: `https://clerk.cinegenius.co/npm/@clerk/clerk-js@6/dist/clerk.browser.js`; ausschließlich lesend untersucht, keine Zugangsdaten enthalten oder ausgelesen.
- [WebKit-Abbruchmeldung bei Dokumentwechsel, upstream gemeldeter reproduzierbarer Fall](https://github.com/microsoft/playwright/issues/43120). Der Bericht stützt die Unterscheidung von Browserabbruch und CORS-Sperre; er beweist nicht allein die Ursache auf CineGenius.
