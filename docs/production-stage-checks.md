# Produktionsprüfung ohne Domainwechsel

Diese Befehle gehören zum aktualisierten, eingecheckten und gepushten Guard dieses Changes. Der alte Guard wertet `--stage` nicht aus und darf für diese vorgelagerte Prüfung nicht verwendet werden.

Beide Befehle verlangen einen sauberen `main`-Stand, dessen HEAD genau `origin/main` entspricht, und die etablierte CineGenius-Projektverknüpfung. Der Guard prüft Projekt und Organisation über einen festen SHA-256-Fingerabdruck. Die tatsächlichen Kontokennungen bleiben in der ignorierten `.vercel/project.json`. Abweichende Vercel-Projekt-/Organisationsvariablen führen zum Abbruch. Der Guard verknüpft kein Projekt automatisch.

Für die vorgelagerte Prüfung:

```sh
npm run deploy:production -- --stage
```

Nach denselben Design- und Sprachprüfungen wie bisher startet der Guard einen Remote-Build mit der Production-Konfiguration. Er ergänzt ausschließlich `--skip-domain --env LISTING_FRESHNESS_ENABLED=false` zum bestehenden Production-Deploy. Die Produktionsdomains werden diesem Build nicht zugewiesen. Der Freshness-Worker dieser einzelnen Bereitstellung bleibt ausgeschaltet; gespeicherte Projekteinstellungen und Umgebungsbereiche werden nicht geändert. Es werden keine Produktionsschlüssel lokal exportiert oder in Preview übernommen.

Die Bereitstellung nutzt produktive Datenverbindungen. Die vorgelagerten Prüfungen bleiben ausschließlich lesend; Profile, Inserate und Versandaktionen werden dabei nicht verändert.

Die erzeugte eindeutige Deployment-URL dient gezielten öffentlichen GET/API-Prüfungen, Zugriffssperren privater APIs und serverseitigen Sprachprüfungen mit der tatsächlichen Production-Konfiguration. Sie ersetzt mit den produktiven Clerk-Schlüsseln keinen vollständigen Browser-Anmeldetest auf der regulären Produktionsdomain.

Nach erfolgreicher Prüfung den normalen Guard erneut ausführen:

```sh
npm run deploy:production
```

Dieser Befehl durchläuft die Prüfungen erneut und startet einen neuen normalen Production-Source-Deploy mit den regulären Projekteinstellungen. Er übernimmt weder den Worker-Override noch `--skip-domain`. Den vorgeprüften Build niemals mit `vercel promote` oder `vercel alias` veröffentlichen: Dabei würde sein abgeschalteter Worker mit übernommen. Es wird kein vorgebautes lokales Artefakt veröffentlicht. Der normale Befehl aktiviert den Worker nicht eigenständig; dessen reguläre Production-Einstellung bleibt maßgeblich.

`npm run deploy:production -- --help` erklärt beide Modi ohne Dateiprüfung, Git- oder Cloudaufruf. Nur kein Argument, genau `--stage` oder genau `--help`/`-h` sind gültig. Andere, doppelte oder kombinierte Argumente brechen vor jedem Unterprozess ab.

Die Optionen wurden gegen die lokal vorhandene offizielle Vercel CLI **65.14.0** und die [offizielle Deploy-Dokumentation](https://vercel.com/docs/cli/deploy#skip-domain) geprüft. `--prod` wählt Production; `--skip-domain` unterbindet die automatische Domainzuweisung, und `--env` setzt eine Variable für diese Bereitstellung zur Laufzeit. Die Vorbereitung und die Guard-Tests führen selbst keine Bereitstellung aus.
