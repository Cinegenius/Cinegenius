# CineGenius E-Mail-Darstellung

Prüfstand: 16. November 2026. Das Änderungspaket ist vorbereitet, noch nicht veröffentlicht.

## Website-Vorlagen

`lib/email-layout.ts` stellt den gemeinsamen Rahmen bereit: vollständiger CineGenius-
Schriftzug, Dunkel-/Lime-Palette der Website, begrenzte Breite, mobile Abstände,
lesbare Texte und große Aktionslinks. Tabellenlayout und Inline-Stile funktionieren
auch ohne externe Schriften, Bilder, Skripte oder zusätzliche Tracking-Pixel.

Verwendet für Kontaktanfragen/-bestätigungen, Chat-Hinweise, Bewerbungen, Willkommen,
Buchungsanfragen/-annahmen/-bestätigungen, Meldungen und Empfangsbestätigungen,
Newsletter/-bestätigung sowie Erinnerungen an Inserate. Der Clerk-Webhook verwendet
denselben Rahmen für seine bekannten Bestätigungs-/Passwortcodes und Willkommen.
Unbekannte Sicherheitsmails werden weiterhin unverändert weitergeleitet.

Inhalt, Empfängersprache, Abmeldelinks, Authentifizierungslinks, Prüfungen,
Fehlerbehandlung, Einwilligungen und Versandaufträge bleiben bestehen. Eingaben von
Mitgliedern bleiben maskierter Originaltext. Keine tatsächlichen Testmails versandt.

## Separat beim Anmeldedienst hinterlegte Vorlagen

Die read-only Bestandsaufnahme fand 25 aktivierte Clerk-E-Mail-Vorlagen. 24 werden
direkt durch Clerk ausgeliefert, bei `invitation` ist dessen eigener Versand aus.
Ein Website-Deployment verändert diese Einstellungen nicht.

21 Vorlagen erlauben eine Anpassung. `scripts/prepare-clerk-email-brand.mjs` erzeugt
**offline** aus dem gesicherten Export ausschließlich Änderungen an `body`/`markup`.
Der Prozess ändert keinen Betreff, Versandweg, Absender, Aktivierungsstatus oder
Sicherheitsinhalt. Alle Variablen, Bedingungen und URLs werden gegen das Original
geprüft; nur der dekorative `app_logo`-Platzhalter wird durch den Schriftzug ersetzt.
Die 21 Vorschauen wurden vom dokumentierten Clerk-Vorschauendpunkt angenommen.
Dieser Vorgang speichert keine Vorlagen und verschickt keine E-Mails.

Nicht bearbeitbar sind:

- `commerce_gateway_account_deauthorized`
- `billing_free_trial_renewal_failed`
- `billing_failed_payment`
- `billing_receipt`

Diese vier Anbieter-Vorlagen bleiben offen. Keine Umstellung der Zustellung und
keine kostenpflichtige Erweiterung wurde vorgenommen. Ihre bisherige Sprache bleibt
ebenfalls Anbieterinhalt; die neun geprüften Website-Sprachen sind kein Nachweis
für neun Sprachversionen sämtlicher Clerk-Systemvorlagen.

Originale, vorbereitete Änderungen, Prüfsummen, API-Vorschauen und Prüfergebnisse
liegen zugriffsbeschränkt unter
`/srv/cinegenius/research/20261116-crew-credit-audit/clerk-brand-drafts/`; der unveränderte
Originalexport liegt daneben als `clerk-template-audit-private.json`.
Keine Schlüssel oder unmaskierte Live-Mails gehören ins Repository.

## Veröffentlichung und Nachprüfung

1. Nach ausdrücklicher Freigabe den geprüften Website-Commit über den geschützten
   Veröffentlichungsweg ausliefern.
2. Clerk-Instanz/Domain erneut prüfen. Vor jeder einzelnen Vorlagenänderung den
   aktuellen Inhalt, Betreff und Versandstatus mit `beforeSha256` im Manifest
   vergleichen. Bei Abweichungen stoppen und neu prüfen.
3. Nur den gesicherten `body`/`markup`-Patch anwenden; Versand und Aktivierung nicht
   ändern. Antwort erneut lesen, Variablen/Links und Versandstatus vergleichen.
   Bereits geänderte Vorlagen mit Ergebnis protokollieren; kein blindes Wiederholen.
4. Bei Rücknahme die tatsächlich gesicherten Originale verwenden, nicht pauschal
   „Standard wiederherstellen“, das ältere individuelle Einstellungen verlieren kann.

Geprüft: vorhandene lokalisierte E-Mail-Funktionstests einschließlich Fehlern und
Sicherheitsinhalten; 108 Website- und 21 Anbieter-Varianten, zusammen 137
Browserdarstellungen ab 320px ohne horizontalen Überlauf. Das ist eine
Browserprüfung, kein Nachweis für reale Gmail-, Outlook- oder Apple-Mail-Clients.

Offizielle Referenzen: [Clerk E-Mail-Vorlagen](https://clerk.com/docs/guides/customizing-clerk/email-sms-templates)
und [Clerk OpenAPI 2026-08-20](https://github.com/clerk/openapi-specs/blob/main/bapi/2026-08-20.yml).
Die vorhandenen Template-Endpunkte sind dort als veraltet gekennzeichnet, aber noch
dokumentiert; bei zukünftigen Änderungen deren Verfügbarkeit erneut prüfen.
