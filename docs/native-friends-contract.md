# Native Freunde, private Favoriten und Textnachrichten – v1

Status: Serververtrag und Migration seit 16. November 2026 veröffentlicht, Live-Commit `1d211944d9c5084cc5f59d61fb408f0db79fd995`. Nachweis: `/srv/cinegenius/handoffs/20261116-native-friends-contract/APP-LIVE.md` und `receipt.json`. Die neue Web-Oberfläche für Homies vom 17. November ist separat vorbereitet und noch nicht veröffentlicht. Native Ansichten und Geräteprüfungen gehören zu APP Entwicklung. Keine erneute Migration aus diesem Dokument ableiten.

Ausgangspunkt: `origin/main` bei `9009d66edf80eb42992da5308899606d604a64cf`. Separate Smart-, News- und E-Mail-Entwürfe sind nicht Bestandteil dieser Änderung.

## Gemeinsame Regeln

- Bestehende Clerk-Sitzung des aktuellen Accounts; keine fremde Benutzer-ID oder lokal gespeicherte Identität als Autorisierung. Der Native-Client verwirft verspätete Antworten nach Kontowechsel.
- GET-Erweiterungen sind ausdrücklich optional. Ohne `X-CineGenius-Native-Contract` bleibt das bisherige Antwortformat erhalten. Header mit unbekanntem Vertrag: 400; fehlender oder abweichender `X-Contact-Account`: 409, vor privaten Datenzugriffen.
- Alle Vertragsergebnisse und Fehler der Handler: `Cache-Control: private, no-store, max-age=0` sowie beide CDN-No-Store-Header. Keine neuen öffentlichen Bild- oder Profilrechte.
- Browser-/WKWebView-Schreibzugriffe behalten die vorhandene Origin-Prüfung. Native HTTP-Integration muss dieselbe verifizierte Sitzung und den erlaubten Website-Origin verwenden. Keine neue Authentifizierungs-Ausnahme.
- Keine automatischen Kontaktannahmen, Lesebestätigungen, Sendeaktionen oder künstlichen Browser-History-Einträge beim Öffnen eines Bereichs.
- Angezeigte Texte kommen aus den vorhandenen Sprachkatalogen. Die kanonischen Berufs- und Gewerk-IDs bleiben sprachunabhängig. APP lokalisiert ihre eigenen neuen Ansichten in allen 17 unterstützten Sprachen.

## 1. Freunde lesen

`GET /api/friendships`

Header:

```text
X-CineGenius-Native-Contract: cinegenius.friendships.v1
X-Contact-Account: <aktuelle Clerk-Account-ID>
```

Antwort zusätzlich zu `friends`, `incoming`, `outgoing`:

```json
{
  "contract": "cinegenius.friendships.v1",
  "accountId": "current-account",
  "capabilities": {
    "canonicalOccupations": true,
    "avatarReferences": true,
    "favoriteFriendsRead": true,
    "favoriteFriendsWrite": true,
    "messageOpenV1": true,
    "explicitIdempotentMessageSend": true
  }
}
```

Jede Personenzeile behält die bestehenden Felder `friendship_id`, `user_id`, `display_name`, `avatar_url`, `role`, `created_at`, `collab_label`, `collab_public`. Zusätzlich:

- `profile_visible`: aktueller Zugriff auf das verknüpfte Personenprofil.
- `department_ids`, `occupation_ids`: aufgelöste gespeicherte Auswahl aus dem gemeinsamen Berufskatalog. Keine Zuordnung anhand freier Biografie oder vermuteter Rollen.
- `primary_occupation`: `{departmentId, roleId}` oder `null`; niemals aus der Reihenfolge einer unklaren Mehrfachauswahl erfunden.
- `is_favorite`: eigener privater Wahrheitswert, nur bei bestätigten Freunden und verfügbarer Lesefunktion.

`friends` enthält ausschließlich akzeptierte Kontakte. Anfragen bleiben in den separaten Arrays und werden nicht als Freunde oder Favoriten angezeigt. Blockierte Personen bleiben ausgeschlossen. Ein nicht sichtbares/Ghost-Profil liefert den bestehenden generischen Namen, `avatar_url: null`, leere Berufslisten und `primary_occupation: null`. Ein bestehender eigener Favorit darf erhalten bleiben, ohne versteckte Identität offenzulegen.

Der `userId`-Einzelstatus-Parameter ist nur im bisherigen Web-Vertrag vorgesehen; v1 lehnt ihn mit 400 ab.

Fehlt die vorbereitete Favoritenmigration, sind `favoriteFriendsRead` und `favoriteFriendsWrite` **false** und `is_favorite` fehlt. Das darf die App nicht als gespeichertes `false` behandeln. Sonstige Lesefehler oder widersprüchliche Antworten ergeben 503; eine frühere bestätigte Auswahl bleibt lokal erhalten. Bestätigte Freunde werden vor der Anzeige weiterhin anhand der bisherigen kanonischen Kontaktkante dedupliziert.

## 2. Nachrichteneinstieg ohne Mutation

`GET /api/conversations?with_user=<Empfänger-ID>` mit Vertrag `cinegenius.message-open.v1` und `X-Contact-Account`.

```json
{
  "contract": "cinegenius.message-open.v1",
  "accountId": "current-account",
  "receiverId": "recipient-account",
  "conversationId": null,
  "canSend": true
}
```

`conversationId` ist eine UUID oder `null`. Die bestehende exakte Direktchat-Zuordnung und aktive eigene Mitgliedschaft bestimmen den Zugriff auf einen vorhandenen Verlauf. `canSend` wird separat durch `messaging_available_recipients` aktuell geprüft. Bei einem Fehler dieser Berechtigungsabfrage bleibt es `false`. Ein vorhandener Verlauf allein berechtigt nicht zu neuen Nachrichten.

Dieser GET erzeugt keine Unterhaltung, Nachricht, Benachrichtigung, E-Mail oder Lesebestätigung. Leerer Verlauf ist ein regulärer erfolgreicher Zustand.

## 3. Ausdrückliches, wiederholbares Senden

Neue Pfade vermeiden, dass ein alter Server den Vertragsmarker ignoriert und versehentlich sendet:

- `POST /api/native/v1/conversations` – erste Textnachricht, zusätzlich `receiver_id`.
- `POST /api/native/v1/conversations/<conversationId>` – weitere Textnachricht.

```json
{
  "contract": "cinegenius.messaging.v1",
  "accountId": "current-account",
  "receiver_id": "recipient-account",
  "content": "Eigener Nachrichtentext",
  "idempotencyKey": "stable-send-attempt-key"
}
```

`idempotencyKey`: 8–128 ASCII-Buchstaben, Ziffern, `_` oder `-`. Pro logischem Sendeversuch unverändert bis zur eindeutigen Bestätigung; neuer Inhalt/Empfänger ist ein neuer Versuch. Text muss nach Trimmen 1–5.000 Zeichen enthalten. v1 akzeptiert keine `attachmentIds`, auch kein leeres Array; Anhänge bleiben eine gesonderte Erweiterung.

Die Adapter verwenden unverändert die bestehenden Web-Sendehandler, Transaktionen, Empfängerprüfungen, durable Account-Limits und E-Mail-Regeln. Der gemeinsame IP-Schutz zählt beide Pfadfamilien im bisherigen Nachrichtenbudget. Eine bestätigte Wiederholung erzeugt keine zweite Nachricht oder E-Mail.

Erfolg enthält `contract`, `accountId`, `conversationId`, `message` und `replayed`. Nur diese bestätigte Antwort darf den ungesendeten Text leeren. Ungültiger Vertrag/Input: 400; abweichendes Sendekonto: bestehende 403-Semantik; keine Sitzung: 401; blockierter/privater/nicht erreichbarer Kontakt: bestehende 403/404; Konflikt/beschäftigt: 409; Limit: 429; unklare Speicherung/Backendfehler: 503. Bestehende Web-Fehlertexte bleiben erhalten; nicht jeder delegierte Fehler hat einen `code`.

**Kein automatischer Rückfall auf den alten Schreibpfad** bei 404/405, fehlendem Echo oder fehlender Fähigkeit. Dann bleibt die native Sendeaktion gesperrt, bis der Serververtrag bereitsteht.

## 4. „Meine besten Homies“ – private Freundesfavoriten

`PUT /api/native/v1/friendships/<friendship_id>/favorite`

```json
{
  "contract": "cinegenius.friendships.v1",
  "accountId": "current-account",
  "is_favorite": true
}
```

Antwort: `contract`, `accountId`, `success: true`, `friendship_id`, `is_favorite`, `changed`.

Nur eine eigene aktuell akzeptierte Kontaktverbindung ist zulässig. Die vorhandene Kontaktsperre und Prüfung beider Blockrichtungen gelten auch hier. Gespeichert wird nur die eigene Seite; weder die andere Person noch öffentliche Profilbesucher sehen diese Auswahl. Es entstehen keine Mitteilungen/E-Mails, neuen Kontakte, öffentlichen Kooperationen oder Profilrechte.

Wiederholung desselben Zielwerts ist idempotent. Bestätigte doppelte Altkanten erhalten denselben eigenen Wert. Kontaktentfernung löscht die Kanten; neue oder wiederverwendete Beziehungen starten ohne Favorit. Änderungen öffentlicher Kooperationslabels bleiben unabhängig.

Fehlercodes: `unsupported_contract`/`invalid` (400), `account_changed` (409), `contact_unavailable` (404 bei fremd/fehlend/nicht akzeptiert; 403 bei Blockierung), `busy` (409), `rate_limited` (429), `unavailable` (503). Authentifizierungsfehler: 401. Die fehlende Migration ergibt einen ehrlichen Fehler, niemals eine bestätigte Speicherung.

Der Client serialisiert Änderungen je Kontakt, sendet explizite Zielwerte statt Toggle-Befehle und liest bei unklarem Ergebnis neu. Es wird kein versionsbasierter Vergleichsvertrag versprochen. Parallele, gegensätzliche Aktionen mehrerer Geräte werden in Transaktionsreihenfolge verarbeitet.

## Datenbank und Freigabe

Bereits angewandt und geprüft: `supabase/migrations/20261116130826_native_friend_favorites_v1.sql` (16. November 2026; Nachweis siehe oben).

Additiv: zwei nicht öffentliche Boolean-Spalten in `friendships`, Rücksetztrigger sowie service-only Lese-/Schreibfunktionen. Kein Backfill von Kontakten, keine Veröffentlichung oder Löschung von Benutzerinhalten. Bestehende RLS und service-only Rechte bleiben erhalten. Der vorhandene gemeinsame Kontaktschlüssel wird für transaktionale Sperren wiederverwendet.

Signaturen, service-only Rechte und Accountgrenzen wurden für den veröffentlichten Serverstand geprüft. Neue Oberflächen aktivieren Favoriten weiterhin nur anhand der tatsächlichen Vertragsantwort und ihrer Fähigkeiten. Jede neue Veröffentlichung bleibt gesondert freizugeben; kein produktiver Schreibtest mit Mitgliedern ohne passenden Auftrag.

Tests verwenden synthetische Konten, isoliertes PostgreSQL/WASM und abgefangene Datenbank-/E-Mail-Aufrufe. Sie ersetzen keine echten parallelen PostgreSQL-Sitzungen und keinen iPhone-/Xcode-Test. Geräte-, Tastatur-, Offline- und Wiederanmeldungsabläufe bleiben APP-Prüfaufgaben vor der nativen Freigabe.
