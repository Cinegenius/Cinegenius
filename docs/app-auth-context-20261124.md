# App-Start: Anmeldekontext getrennt von sichtbarer Bereitschaft

Stand: 24. November 2026. Ausgangspunkt ist `808b9e56f3a47eff94b53deec85833616c087b3c`, einschließlich des veröffentlichten Webpakets `13445c23`. Die lokale APP-Aufgabe hat beim echten iPad-Kaltstart mit2217 einen Bereitschaftswiderruf während des nativen Work-Einblendens nachgewiesen. Erfolgreiche Konto-GETs und ein fertiges Work-Modell reichten dadurch nicht zum Abschluss. Dieser Serverpatch ergänzt ausschließlich den kompatiblen Webvertrag; die native Korrektur und ihre Geräteprüfung bleiben separat.

**Veröffentlicht:** `2e5ce0702f0d3f94ed5e2a1bef215975a5ade833`, `dpl_94Eh94YmSfPn9B7BSs4jvRgaX5rA` READY; www.cinegenius.co verweist auf exakt diese Bereitstellung. Ein normaler guarded Produktionsbuild aus sauberem main gleich origin/main. Vollständiger Next-/TypeScript-Build bestanden,177 statische Seiten. Die gewöhnliche Website bleibt erhalten. Der native Verbraucher und die physische Abnahme sind getrennt offen.

## Vertrag

`document.documentElement[data-native-app-auth-context]` enthält einen flüchtigen Wert aus16 CSPRNG-Bytes, dargestellt als genau32 kleine Hexadezimalzeichen. Er enthält weder Konto-/Session-/Organisations-IDs noch Tokens, wird nicht gespeichert, aus Cookies abgeleitet, protokolliert oder an einen Dienst gesendet. Er ist **nur ein Gleichheits-/Widerrufssignal**, keine Anmeldung, Berechtigung oder Bereitschaft.

Ein eigener `useLayoutEffect` im vorhandenen `useNativeAppBootReadiness` verwaltet den Marker. Die bestehende Klassifikation `nativeBootSession` bleibt unverändert: nur beide geladenen SDK-Ressourcen mit bereits aufgelöstem `guest`, `pending` oder `member` erhalten einen Wert; `unresolved` erhält keinen. Auch ein Gastmarker gewährt keinen Kontozugriff. Die nativen privaten Session-/Kontoprüfungen bleiben erforderlich.

| Ereignis | Neuer Authkontext |
| --- | --- |
| Normale Website ohne native Appearance/Workspace-Bridge | Kein Marker |
| Aufgelöster Gast, erkannte ausstehende Session-Aufgabe, passende aktive Mitgliedersession | Jeweils eigener Zufallswert |
| Identitäts-/Session-/Status-/Aufgabenwechsel, Wechsel der Klassifikation | Alter Wert entfernt; nur für neuen aufgelösten Scope neuer Wert |
| SDK nicht geladen, widersprüchliche Ressourcen, unbekannte Session-Aufgabe | Sofort bei Layout-Effekt-Bereinigung entfernt |
| `auth.orgId` oder `session.lastActiveOrganizationId` verändert | Rotation; keine neue Organisationsklassifikation oder zusätzliche Zugriffsentscheidung |
| Abmeldung | Alten Mitgliedswert entfernen; aufgelöster Gast erhält eigenen neuen Wert |
| Route, Layout, Blur, verdeckte Webseite, natives Work-Cover | Unverändert |
| `pagehide` / `pageshow` im selben Dokument | Kein eigener Authmarker-Handler; native Dokument-/Navigationsgeneration bleibt zuständig |
| Unmount, StrictMode-Neumontage, Verlust beider nativen Merkmale | Bereinigung; Neumontage erzeugt neuen Wert |
| Crypto fehlt/fehlschlägt, eingebettetes Dokument oder kein HTTPS | Kein Marker, kein schwacher Ersatz |

Clerk maskiert ausstehende Sessions in `useAuth()` standardmäßig als abgemeldet. Ein dortiges `orgId:null` bei gleichzeitig vorhandener Organisation der ausstehenden `useSession` ist daher kein Widerspruch. Beide primitiven Organisationswerte lösen unabhängig eine Rotation aus; es gibt keine neue null/undefined-Zugangsschranke. Eine verspätete Bereinigung eines alten Effekts darf einen neueren Marker nicht entfernen.

`data-native-app-boot-ready`, sein Installer, seine Sichtbarkeitsereignisse und bisherige Nachrichten bleiben unverändert. Die bisherigen Apps2213–2217 ignorieren das zusätzliche Attribut; ihr Startfehler ist dadurch allein noch nicht korrigiert.

## Native Übernahme und Grenzen

Der geplante native2218-Verbraucher muss den Wert strikt prüfen und an Dokumentnonce, aktuelle native Generation und frischen privaten Servernachweis binden. Nur während einer bereits verifizierten konkreten nativen Übergabe darf eine reine Darstellungsänderung überbrückt werden. Fehlender/anderer Authkontext, Dokument-/Navigationswechsel oder echter Kontowiderruf bleiben Sperrgründe; unmittelbar vor Abschluss ist ein aktueller DOM-Snapshot erforderlich. Gast-/Pending-Marker dürfen keinen Mitgliedsbereich öffnen. Ein DOM-Marker ersetzt weder Serverprüfung noch Herkunftsprüfung und kann Änderungen nur erkennen, sobald das SDK sie tatsächlich meldet.

Keine neuen APIs, Datenbankänderungen, Provideraufrufe, Mailaktivierungen, UI-Texte oder Änderungen an gewöhnlichen Websiteansichten. Alle17 Sprachkataloge bleiben unverändert. Keine native Quelle dieses Serverzweigs wird über die aktuelle Mac-App kopiert.

## Prüfung und Veröffentlichung

- Vorher:13 bestehende Boot-/Hookfälle erfolgreich; sie zeigten nur das alte Darstellungs-/Anmeldemischsignal.
- Nachher:22 fokussierte Fälle einschließlich unveränderter Bootklassifikation und Sicherheits-/Lebenszyklus-Gegenfälle erfolgreich. Der bisherige Boot-Installer bleibt bytegleich, SHA-256 `bbb1d444311bcdc64f7008365101d6c70856d89630f9573cda6f1a68921fe55a`.
- Kontrollierter React-/DOM-Browserlauf mit synthetischem Clerk-Zustand:34 Chromiumfälle bei320/393px für Gast/Member/Pending, Blur, Work-Cover, Hidden, Pagehide, Route, SDK-Widerspruch, Orgwechsel, Abmeldung, StrictMode und Unmount. Kein echter Login und keine native Geräteabnahme. Der WebKit-Lauf konnte wegen fehlender Systembibliotheken nicht starten; keine WebKit-Ergebnisse behaupten.
- Fokussiertes TypeScript und ESLint erfolgreich.20 bestehende Designfälle und globaler Sprachcheck:17 Kataloge,11726 Schlüssel, keine neuen ungeprüften Quelltexte.
- 87 zusätzliche bestehende Auth-/Session-/Dashboardfälle bestanden. WEB hat die beiden Produktdateien unabhängig geprüft und dieselben22 fokussierten Fälle wiederholt; keine zusätzlichen22 einzigartigen Fälle.
- Vollständiger Produktionsbuild, Veröffentlichung und www-Prüfung bestanden. Fünf Live-HTTP-Fälle: Anmeldung/Registrierung200, beide privaten nativen Session-/Kontorouten401 mit no-store, Dashboard307 zur Anmeldung auf demselben Host. Zwei öffentliche Chromium-Gastabläufe bei393px mit dem tatsächlichen geladenen Clerk-Gastzustand bestanden: normale Website ohne Marker; emulierte Appmerkmale mit gültigem Kontext, unverändertem Kontext beim nativen Verdecken und wiederkehrender Bootbereitschaft nach Resume.29 unterschiedliche JavaScript-Assets200, neues Markerbundle bestätigt, keine Seitenfehler. Kein echter Login oder Gerätetest.
- Nachweise außerhalb des Repositories: `/srv/cinegenius/handoffs/20261124-app-auth-context/`. Freigabebezug dort auf die direkt gelesene menschliche APP-Livefreigabe und den laufenden Rückkehr-/Kontofehlerauftrag begrenzt.

Die echte iPad-/iPhone-Abnahme des zusammengehörigen Web-/Nativefixes sowie die gesonderte frühere401-Hintergrunddiagnose sind weiterhin offen. Kein pauschaler Leistungs- oder TestFlight-Freigabenachweis.

Finaler Releasebeleg: `/srv/cinegenius/handoffs/20261124-app-auth-context/release-receipt.json`, SHA-256 `a6c854afa1dd6022aa561403d617876c1117b4525e8ed38d8fcd92eb49127d4f`. Die nachfolgende Dokumentationsaktualisierung ist keine zweite Veröffentlichung.
