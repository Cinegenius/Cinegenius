# Strukturierte Benachrichtigungen, Version 1

`public.notifications.localization` ist eine optionale `jsonb`-Spalte mit SQL-`NULL` als Standardwert. Die bisherigen Spalten `title`, `body`, `href`, IDs und Lesestände bleiben erhalten. Neue Metadaten dienen nur zur sprachabhängigen Darstellung der von CineGenius erzeugten Textteile.

```json
{
  "version": 1,
  "title": { "key": "companyInvitationTitle" },
  "body": {
    "key": "companyInvitationBody",
    "values": { "company": "Originaler Firmenname", "roles": "Originalfunktion · Zweite Funktion" }
  }
}
```

`title` und `body` sind unabhängig optional. Jeder vorhandene Abschnitt enthält einen `key` und optional ein Objekt `values`. Die Schlüssel beziehen sich ohne Namespace-Präfix auf den gemeinsamen `NotificationCopy`-Katalog und müssen im aktuellen `lib/i18n/notification-index.json` für Feld und Benachrichtigungstyp zulässig sein. Die API muss Metadaten aus vertrauenswürdigen serverseitigen Schlüsseln erzeugen; der Reader muss Version, Struktur und Schlüssel prüfen und bei fehlenden/ungültigen Metadaten das jeweilige gespeicherte Originalfeld unverändert darstellen. Ein unbekannter Titel darf die Anzeige eines gültigen Originaltexts nicht verhindern.

Bestehende Datensätze werden nicht umgeschrieben. Der Reader erkennt ausschließlich dokumentierte CineGenius-Schablonen aus dem unveränderlichen Versionskatalog. Nur eindeutig zuordenbare Altmeldungen werden bei der Anzeige lokalisiert; unbekannte oder mehrdeutige Texte bleiben erhalten. Namen, Firmentitel, Berufsfunktionen und andere Mitgliedertexte bleiben unveränderte Argumentwerte. Bei späterem Sprachwechsel werden nur die Katalogschablonen neu formatiert. Für diesen DB-Schritt entsteht kein zusätzlicher Aufbewahrungsmechanismus und keine neue öffentliche Freigabe.

Die drei SQL-Schreibpfade:

| RPC | Metadaten | Bisheriger Text |
| --- | --- | --- |
| `invite_company_member(text,uuid,text,text[])` | `title.key=companyInvitationTitle`, `body.key=companyInvitationBody`; `values.company=co.name`, `values.roles=array_to_string(p_titles,' · ')` | Titel, Einladungsbody und Link unverändert |
| `respond_company_invitation(text,uuid,text)` | Nur `title.key`, je nach Entscheidung `companyInvitationAccepted`, `companyInvitationDeclined` oder `companyInvitationRevoked` | Body enthält ausschließlich den bisherigen Firmennamen und die bisherigen Funktionen; er bleibt roh und erhält keinen Übersetzungsschlüssel |
| `offer_review_transition(text,uuid,jsonb,jsonb,jsonb,text,text,text,jsonb)` | Übernimmt ausschließlich `p_notification->'localization'` zusätzlich | Die vorhandenen `title`, `body`, `href` bleiben gleich; ohne Metadaten liefert der Ausdruck SQL-`NULL` |

Die Migration ergänzt keine Datenvalidierung im Review-RPC, weil dies dessen bestehenden Vertrag verändern würde. Die gemeinsame API- und Reader-Validierung prüft die Metadaten vor der Anzeige. Ein ausdrücklich als JSON-`null` übergebenes Metadatenfeld wird durch den unveränderten JSON-Operator als JSON-`null` gespeichert und muss ebenfalls zum Originaltext zurückfallen.

Ein Rückgang auf älteren Anwendungscode bleibt möglich: Er kann weiterhin `title` und `body` lesen und Benachrichtigungen ohne die neue Spalte schreiben. Die additive Spalte und neu entstandene Metadaten bleiben dabei erhalten; keine Rücknahmeanweisung löscht sie.
