# Hintergrunddienste der App: Vorbereitung und getrennte Aktivierung

Diese Quelldateien bereiten geplante Aufrufe vor. Sie belegen weder ein Deployment noch einen laufenden Scheduler, eine Löschung beim Storage-Anbieter oder eine zugestellte Push-Mitteilung. Für die lokalen Prüfungen wurden keine Schlüssel, echte Konten, Datenbanken, Provider oder Geräte verwendet.

## Geplante Vercel-Aufrufe

`vercel.json` enthält jeweils genau einen GET-Cron mit `*/5 * * * *`:

| Pfad | Zusätzlich erforderliches Server-Flag |
| --- | --- |
| `/api/cron/shots-cleanup` | `SHOTS_CLEANUP_CRON_ENABLED=true` |
| `/api/cron/native-push` | `NATIVE_PUSH_CRON_ENABLED=true` |

Die Konfiguration plant beide Aufrufe alle fünf Minuten. Sie garantiert weder einen sekundengenauen Start noch eine bestimmte Verarbeitungsdauer. Beide Routen verwenden die Node-Laufzeit, `force-dynamic` und ein angefragtes `maxDuration` von 150 Sekunden. Das ist eine Ausführungsgrenze, kein Erfolgsnachweis. Die vorhandenen Listing- und Profile-Art-Crons bleiben eigenständig.

Der gemeinsame Wrapper in `lib/app-service-cron.ts` verlangt nacheinander:

1. Tatsächlich die HTTP-Methode GET. Der ausdrücklich exportierte HEAD-Handler antwortet mit 405 und `Allow: GET`, ohne Arbeit zu starten.
2. Den exakten `Authorization: Bearer <CRON_SECRET>`-Wert. Der bestehende Helper prüft gleiche Byte-Länge und verwendet `timingSafeEqual`. Fehlender oder falscher Secret liefert 401, bevor der Aktivierungszustand sichtbar wird. Ein Query-Parameter oder Cron-User-Agent ersetzt ihn nicht.
3. Serverseitig `VERCEL_ENV=production` und das eigene Flag mit exakt dem Wert `true`. Alle Flags sind ohne ausdrückliche Konfiguration aus. `NODE_ENV=production`, Preview-Deployments, Development oder ein entsprechend benannter Request-Header reichen nicht. Das andere Worker-Flag aktiviert die Route ebenfalls nicht.

Bei korrekt authentifiziertem, aber nicht aktiviertem Aufruf lautet die Antwort `{status:"disabled"}`. Diese Vercel-Produktionssperre gilt für die beiden GET-Wrapper. Sie ist keine globale Sperre für alle Worker-Einstiege: Die vorhandenen authentifizierten POST-Routen unter `/api/internal/` und der Push-Aufruf nach einem Commit haben ihre jeweils eigenen Schutzbedingungen. Ein anderes Hosting benötigt einen separat geprüften Scheduler; `NODE_ENV=production` allein aktiviert diesen Vercel-Weg nicht.

## Shots: Ablauf und tatsächliche Löschung

Die bestätigte Veröffentlichung setzt die serverseitige Lebensdauer auf 30 Stunden. Neue Feed-, Detail- und Medien-Leseentscheidungen verweigern den Zugriff ab dieser Frist für alle, auch für den Eigentümer. Dafür muss kein Cron erst anlaufen. Medien werden nach Storage-I/O erneut geprüft; bereits heruntergeladene Kopien lassen sich nicht zurückrufen.

Die physische Entfernung der privaten Vollbild- und Thumbnail-Dateien ist ein eigener, dauerhafter Löschablauf. Der Worker prüft den privaten Bucket, übernimmt begrenzte Jobs, entfernt ausschließlich validierte Objektpfade und bestätigt für beide Dateien die Abwesenheit. Erst danach darf der zugehörige Datensatz bereinigt werden. Unklare Provider-Antworten, ausgefallene Läufe, Leases, Backoff und größere Rückstände können die physische Löschung verzögern. Weder „nach exakt 30 Stunden gelöscht“ noch „spätestens fünf Minuten später gelöscht“ ist durch diese Konfiguration belegt. Backups, Versionierung und Aufbewahrung beim Anbieter bleiben gesondert zu prüfen.

Die SQL-Aktivierung und Cleanup-Gesundheitsprüfung bleiben zusätzlich erforderlich; der GET-Cron umgeht keine davon. Neue Veröffentlichungen dürfen bei fehlender Cleanup-Bereitschaft nicht als verfügbar erscheinen. Der vorhandene POST-Einstieg bleibt für einen separat geschützten Scheduler erhalten. Details: [Shots-Lebenszyklus](./shots-ephemeral.md).

## Push: dauerhafte Queue, zeitnaher Aufruf und Wiederholung

Nach ausdrücklicher SQL-Aktivierung erzeugen neue zulässige Nachrichten und Mitteilungen ihre Push-Ereignisse in derselben Datenbanktransaktion. Ein Rollback entfernt beides. Die Queue verwendet eindeutige Ereignis-/Registrierungsschlüssel und erstellt keine künstlichen Chat-Mitteilungszeilen. Ein ausstehender Worker ist kein Grund, ein neu entstandenes Ereignis beim Enqueue zu verwerfen. Historische Ereignisse vor der Aktivierung werden nicht nachträglich aufgenommen.

Der primäre zeitnahe Einstieg für neu erstellte Nachrichten ist `scheduleNativePushAfterCommit()` über Next `after()`: Die beiden Nachrichten-POST-Routen rufen ihn erst nach einem validierten erfolgreichen Commit-ACK und nur bei `created=true` auf. Er verarbeitet vorhandene Queue-Einträge und legt keinen zweiten an. Scheduling- oder Pushfehler nehmen eine bereits bestätigte Nachricht nicht zurück und blockieren deren Antwort nicht.

Der geplante Fünf-Minuten-Cron ist der Rückfallweg für Wiederholungen, Prozessabbrüche und Mitteilungen ohne solchen direkten Aufruf. Sein Flag kontrolliert diesen GET-Rückfallweg; es aktiviert nicht den primären `after()`-Aufruf. Für APNs müssen außerdem `NATIVE_PUSH_ENABLED=true`, gültige Apple-Konfiguration, passende private SQL-Einstellungen und Worker-Bereitschaft vorliegen. Dazu kommen die bewusste native Freigabe, die aktuelle Kontobindung sowie die getrennten Nachrichten-/Mitteilungs-Opt-ins.

Vor einem Versand werden aktuelle Clerk-Sitzung, Empfängerrechte, Lesestatus, Mitgliedschaft und Beitrittsgrenze, Blockierungen sowie Registrierungsversion und Opt-ins erneut geprüft. Die Nutzlast enthält nur generische übersetzte Texte und geschlossene Ziele. APNs-Annahme bedeutet weder Zustellung an das Gerät noch Lesen. Wiederholungen sind begrenzt und die Queue hat eine eigene Ablaufzeit; ein Ausfall ist keine unbegrenzte Zustellgarantie. Details: [Push-Vertrag und Aktivierung](./native-push.md).

## Antworten und Betriebsnachweise

Die Wrapper setzen bei Erfolg, deaktiviertem Zustand, Authentifizierungsfehlern, HEAD-Abweisung und internen Fehlern private No-store-Header für Browser, CDN und Vercel. Geworfene Worker- oder JSON-Serialisierungsfehler werden als generisches 503 `{error:{code:"unavailable"}}` zurückgegeben. Der Wrapper schreibt dabei keine rohe Fehlermeldung in Logs.

Eine technisch erfolgreiche 200-Antwort reicht als Gesundheitsnachweis nicht: Der Worker-Rückgabewert wird unverändert weitergegeben. Bei Shots müssen insbesondere `healthy`, `retry` und `purged` bewertet werden; bei Push unter anderem `status`, `accepted`, `retry` und `failed`. Ein deaktivierter Push-Worker kann korrekt mit 200 und `status:"disabled"` antworten. Eine leere oder abgearbeitete Queue beweist keine Geräte-Zustellung.

Vor einer getrennt genehmigten Aktivierung sind nachzuweisen:

- Tatsächlich freigegebenes Produktionsdeployment und ein unterstützter Scheduler-Tarif; geschützte Aufrufe im vorgesehenen Intervall sowie Ausfall-/Rückstandsüberwachung.
- Sichere Konfiguration des Cron-Secrets und der getrennten Feature-Flags; Service-Rolle ausschließlich auf dem Server, private Schemas/RLS und geprüfte Migrationen.
- Für Shots: privater Bucket, reale Provider-Lösch- und Abwesenheitsbestätigung, begrenzte Upload-Dauer, Retry-/Crash-Recovery und Verhalten bei Cleanup-Ausfall.
- Für Push: Apple-Konto, Bundle/Environment, APNs-Schlüssel, Entitlements und Provisionierung sowie bewusste OS-Freigabe, Konto-/Sessionwechsel, Versand, Empfang und Tap auf einem echten iPhone. Ein normaler Debug-Build bleibt ohne aktivierte Push-Capability möglich.
- Schutz privater Header und Tokens auch in Reverse-Proxy-, Hosting- und Infrastruktur-Logs. Die Anwendung darf Installationsnachweis, APNs-Token und Anmeldedaten weder offenlegen noch als Fehlermeldung weiterreichen.

`lib/app-service-cron.test.mjs` lädt die tatsächlichen Wrapper- und Routenmodule in isolierten synthetischen Serverumgebungen und verwendet den echten Timing-safe-Authhelper. Die beiden Worker sind Testabhängigkeiten. Das prüft die Quellverträge, nicht die derzeitige Konfiguration oder Ausführung eines gehosteten Deployments. `.env`, echte Provider-Verbindungen, Datenbankzugriffe und Geräteaktionen gehören nicht zu diesem lokalen Test.
