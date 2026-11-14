# Genie: Kontolimits und native Sprachqualität

Abstimmung mit WEB CODEX, 14. November 2026. Die neue Kontoregel ist beauftragt; die geprüfte Implementierungs-/Veröffentlichungsübergabe an APP steht noch aus. Diese Notiz ändert weder Serverkonfiguration noch native Berechtigungen. Die bestehende App-Sprachausgabe wurde im Quellcode geprüft; ein aktueller Hörtest auf dem iPhone liegt nicht vor.

## Gemeinsame Kontoregel

- Normale Konten: 30 KI-Aufrufe je UTC-Tag. Keine gemeinsame tägliche Obergrenze für die gesamte Website.
- Ausschließlich Markus' verifiziertes Konto erhält kein Tageslimit. Die serverseitige Konfiguration `GENIE_UNLIMITED_USER_ID` muss dessen bestätigte Konto-ID enthalten. Weder Anzeigename noch Admin-Rolle oder Client-Parameter begründen die Ausnahme.
- Der bestehende Schutz pro Minute bleibt auch für dieses Konto wirksam. Kein unbegrenzter Zugriff auf andere Konten, Inhalte oder geschützte Medien.
- Website und App verwenden dieselbe Serverentscheidung. Keine native Kopie von Zählern oder Sonderrechten; keine neue Account-ID im Sprachhandler und keine zusätzliche Speicherung von Sitzungsmaterial.
- Besseres Sprachverständnis und schnelle Verarbeitung für Markus werden serverseitig abgestimmt. WEB hat dafür „GPT-6 Astra“, „Ultrafast“ und begrenztes Reasoning angekündigt. Konkrete API-Modellkennung, unterstützte Parameter, Verfügbarkeit, Verhalten und tatsächlicher Rollout müssen mit dem geprüften Web-Commit belegt werden. Die App darf daraus keine Modellverfügbarkeit, garantierte Antwortzeit oder Inhaltsrechte ableiten. Normale Konten sollen beim bisherigen Modell bleiben.
- Browser-Transkription, native Spracherkennung, serverseitiges Textmodell und native Sprachausgabe bleiben getrennte Funktionen. Ein anderes Textmodell installiert keine Stimme auf dem iPhone.

Markus hat die Veröffentlichung der Kontolimits inzwischen in WEB CODEX ausdrücklich angefordert. Den tatsächlichen Live-Stand erst nach dessen geprüftem Veröffentlichungsbeleg übernehmen. Das ist kein Auftrag, ungeprüfte Mehrfachsuche oder zusätzliche native Änderungen zu veröffentlichen.

## Bereits vorhandene native Auswahl

Die aktuellen iOS-/Android-Sprachdateien sind bytegleich mit dem zuvor geprüften App-Stand `8c165419`. iOS wählt aus den verfügbaren Apple-Stimmen derselben Sprache zunächst die passende Region, dann die höchste gemeldete Qualität, danach die Systemvorgabe und einen stabilen Gleichstandsvergleich. Android verwendet installierte lokale Stimmen derselben Sprache mit entsprechender Priorisierung. Keine automatische Fremdsprache und kein zusätzlicher Netz-Sprachanbieter.

Das Tempo beträgt auf iOS `AVSpeechUtteranceDefaultSpeechRate * 0.94`, auf Android `0.94`; die Lautstärke je Äußerung beträgt `0.85`. Gerätesystemlautstärke und Tonhöhe werden nicht verändert. Das ist eine ruhige Voreinstellung, kein Nachweis subjektiver Klangqualität. Der native Sprachvertrag bleibt Version 1.

## iPhone-Stimmen und Downloads

Apple unterscheidet Standard-, erweiterte und Premium-Stimmen. Erweiterte und Premium-Stimmen benötigen einen Download; die App muss die tatsächlich verfügbaren Stimmen abfragen. [Apple: Sprachqualität](https://developer.apple.com/documentation/avfaudio/avspeechsynthesisvoicequality), [Apple: verfügbare Stimmen](https://developer.apple.com/documentation/avfaudio/avspeechsynthesisvoice/speechvoices()).

Die aktuelle iPhone-Anleitung nennt **Einstellungen → Bedienungshilfen → Lesen & Sprechen → Stimmen**; ältere iOS-Oberflächen nennen den Bereich „Gesprochene Inhalte“. Sprache und Dialekt auswählen und eine angebotene hochwertige Variante bei Bedarf herunterladen. Apple empfiehlt für die größeren Stimmdownloads WLAN. [Apple: aktuelle Einstellungen](https://support.apple.com/de-at/guide/iphone/iph96b214f0/ios), [Apple: hochwertige Stimmen herunterladen](https://support.apple.com/de-at/111798).

Eine in Siri oder den Bedienungshilfen sichtbare Stimme ist keine pauschale Verfügbarkeitszusage für CineGenius. Maßgeblich ist die Stimmenliste der App-API. Apple beschreibt ausdrücklich eine mögliche Ersatzstimme für Siri-Stimmen; deshalb keine konkrete Siri-Stimme versprechen. [Apple: Sprachausgabe in Apps](https://developer.apple.com/videos/play/wwdc2020/10022/).

## Noch erforderlicher Gerätebeleg

1. Auf dem iPhone 15 Pro die installierte App-Fassung und iOS-Version festhalten. Stimmenliste und tatsächlich gewählte Stimme einschließlich Sprache/Region/Qualität innerhalb der App prüfen, ohne Gesprächsinhalte oder Kontodaten zu protokollieren.
2. Eine kurze deutsche Beispielantwort mit aktuellem Tempo anhören; Beginn, Natürlichkeit, Verständlichkeit und Lautstärke prüfen. Die bisherige Voreinstellung nur anhand eines tatsächlichen Höreindrucks anpassen.
3. Falls eine hochwertige Stimme fehlt, verfügbaren Download in den iPhone-Einstellungen prüfen. Nach abgeschlossenem Download zur App zurückkehren und erneut prüfen; die Auswahl wird bei jeder Sprachausgabe neu ermittelt. Keine Stimme automatisch oder verdeckt herunterladen.
4. Stoppen, neue Antwort, Sprachwechsel, Hintergrund/Rückkehr, abgelaufene Unterhaltung und Navigation prüfen. Keine verspätete Antwort darf eine neuere Aufnahme oder Sprache überlagern. Gespeicherte Pläne und offene Entwürfe erhalten.
5. Die übrigen acht App-Sprachen auf Verfügbarkeit prüfen; fehlende Sprachen ehrlich melden. Simulator- oder JavaScript-Adaptertests ersetzen weder die installierte iPhone-Stimmenliste noch einen Hörtest.

Aktueller Zugriffsbefund: XcodeBuildMCP kann auf diesem Linux-Server keine Apple-Laufzeit finden (`spawn xcrun ENOENT`). Hier wurde daher keine iPhone-Stimme ausgelesen, heruntergeladen, angehört oder installiert. Die laufende native Mac-Arbeit wird erhalten; die Geräteprüfung benötigt deren tatsächlichen Xcode-/iPhone-Kontext.
