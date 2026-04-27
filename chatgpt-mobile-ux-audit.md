# CineGenius — Vollständiges Mobile-UX-Audit für ChatGPT

## Was ist CineGenius?
Ein Filmbranchenmarktplatz (Next.js 16, Tailwind CSS v4, dark theme, PWA-ähnlich) für die DACH-Region.
Nutzer können: Drehorte finden, Crew & Talent buchen, Props/Fahrzeuge/Equipment mieten, Jobs finden und ausschreiben.
Zielgruppe: Film-Regisseure, DPs, Produzenten, Freelancer, Schauspieler, Models, Location-Owner — von Netflix-Produktionen bis solo Content Creators.

---

## Globale Mobile-Architektur

### Navbar (oben, fixed, ~64px hoch)
```
[Logo CineGenius]                [🔍][🔔][🌐][☰]
```
- Auf Desktop: Vollnavigation mit Links + Suchbutton (⌘K) + NotificationCenter + LanguageSwitcher
- Auf Mobilgeräten: Logo links, rechts: Suchicon (dispatcht cg:opensearch-Event) + Glocke (nur wenn eingeloggt) + Sprachschalter + Hamburger-Menü
- Hamburger öffnet ein Slide-In-Panel von rechts (w-80, full-height, over-Overlay)

### BottomNav (unten, fixed, 56px hoch)
```
[📍 Locations] [👥 Crew] [💼 Jobs] [🛍️ Markt] [🎬 Projekte] [🏢 Firmen]
```
- Nur auf Mobilgeräten sichtbar (lg:hidden)
- 6 gleichgroße Tabs mit Icon + 9px-Bezeichnung
- Aktiver Tab: gold, mit 2px-Indikatorlinie oben
- Wird auf /dashboard, /profile-setup, /sign-in, /sign-up ausgeblendet
- safe-area-pb für iPhone-Home-Bar

### Footer
```
[4 Link-Spalten]  [Copyright]  [Privacy · AGB · Impressum]
```
- pb-14 auf Mobile (Platz für BottomNav), pb-0 auf Desktop
- Normales Block-Layout, keine spezifische Mobiloptimierung

---

## Seite für Seite — Mobile Layout

---

### 1. Homepage (`/`)

**Mobile-Struktur:**
```
[Navbar 64px]
[Hero: Titel groß + HeroSearch-Suchleiste]
[ImageStrip: horizontaler Scroll der Fotos]
[Schnellkategorie-Kacheln 2×3 Grid]
[Statistik-Zähler: 4er Grid]
[Aktuelle Locations (horizontaler Scroll)]
[Aktuelle Crew-Profile (2-col Grid)]
[Aktuelle Jobs (vertikale Liste)]
[Aktuelle Projekte]
[CTA-Sektion]
[Footer]
[BottomNav 56px]
```

**Beobachtungen:**
- Der Hero hat einen großen Hintergrundtext und eine zentrierte HeroSearch-Suchleiste
- HeroSearch: ein einzelnes `<input>` mit Kategorie-Dropdown — separate Suche zur GlobalSearch
- Drei verschiedene Sucheinstiegspunkte auf dieser Seite: (a) Navbar-🔍-Icon, (b) HeroSearch im Hero, (c) Kategoriekacheln als Navigation — ist das verständlich für Erstbesucher?
- Die 4er-Statistik-Reihe (Locations+, Profile+, etc.) in einem grid-cols-4: auf 375px-Breite sind das ~90px pro Zelle — Texte können sehr eng werden
- Horizontaler Scroll für "Aktuelle Locations" hat keine sichtbaren Scroll-Indikatoren (nur Fading-Gradients)

---

### 2. GlobalSearch (`/`-Overlay)

**Mobile-Trigger:**
- Navbar-🔍-Icon (dispatcht `cg:opensearch`-Event auf `document`)
- ⌘K / Ctrl+K auf Desktop

**Modal-Layout (fixed, inset-0, pt-[15vh]):**
```
[Backdrop blur]
[Max-w-2xl weißes Panel]
  [🔍 Suchfeld   [×] [Esc]]
  ──────────────────────────
  Wenn leer:
    "Letzte Suchen" ODER 4 Vorschlag-Chips
  Bei Eingabe (≥2 Zeichen):
    [Gruppen: Locations / Crew / Props / Fahrzeuge / Jobs / Firmen]
    Jede Gruppe: Icon + Farbiges Label + Ergebnisliste
    Footer: "X Ergebnisse  Alle anzeigen →"
```

**Beobachtungen:**
- Das Panel öffnet bei `pt-[15vh]` — auf einem iPhone 14 (844px) sind das ~127px von oben. Das fühlt sich gut an, lässt aber keinen Bildschirmtastatur-Viewport-Kollaps erwarten
- Wenn die Tastatur aufgeht (iOS), schrumpft der Viewport auf ~400px. Das Panel plus max-h-[440px] Ergebnisliste könnte komplett außerhalb des sichtbaren Bereichs enden
- `max-h-[440px]` für Ergebnisse: auf iPhone SE (568px total, ~400px nach Tastatur) möglicherweise zu hoch
- Keyboard-Navigation (ArrowUp/Down/Enter) auf Mobile sinnlos — kann man ignorieren oder weglassen
- Vorschlag-Chips haben deutsche Filmfachbegriffe — international erkennbar?

---

### 3. Crew-Suche (`/creators`) — **komplett neu gestaltet**

**Neue Mobile-Struktur (implementiert):**
```
[Row 1] [🔍 Name, Skill oder Keyword…  ×]  [⊞][≡]
[Row 2] [DP/Kamera] [Regisseur] [Schauspieler] [Fotograf] ... ← horizontaler Scroll
[Row 3] [✓ Verfügbar]  [Stadt ▾]  [Alle Filter (3)]
[Row 4] [🎬 Regie ×] [📷 DoP ×]  Alle löschen   ← nur wenn aktiv
[Row 5] 12 Profile   [Empfohlen ▾]
[Ergebniskarten 2-spaltig]
```

**Bottom Sheet ("Alle Filter"):**
```
[Handle-Balken]
[Alle Filter                         ×]
──────────────────────────────────────
VERFÜGBARKEIT
[Toggle: Verfügbar]

GEWERK & ROLLEN
[Film] [Foto] [Social] [Talent] ... ← horizontale Dept-Tabs
[Rollenraster 2-spaltig, scrollbar, max-h-52]

STADT
[Alle] [Berlin] [München] [Hamburg] ...

SPRACHE
[Alle] [Deutsch] [Englisch] ...

PROFILTYP
[Alle] [Schauspieler] [Model] [DoP] ...

HAARFARBE  AUGENFARBE
[Select]   [Select]

SPIELALTER
[von 18] – [bis 35]

REISEBEREITSCHAFT
[Alle] [Regional] [Deutschlandweit] [Europaweit] [Weltweit]
──────────────────────────────────────
[Zurücksetzen]   [12 Profile anzeigen]
```

**Beobachtungen:**
- Row 2 (Chips) erscheint nur wenn mindestens eine Rolle aus der Shortlist auch Treffer hat — macht die Reihe dynamisch, kann beim ersten Besuch ohne Daten fehlen
- Row 5 zeigt Anzahl UND Sortierung — auf Mobile sinnvoller als der bisherige Header
- Bottom Sheet max-h-[85vh] — auf iPhone SE (568px) wären das 483px für viele Filter-Abschnitte
- Die "Dept-Tabs" im Sheet und die "Promoted Role Chips" in Row 2 überschneiden sich konzeptuell: beide erlauben Rollenwahl. Ist das verständlich?

---

### 4. Locations-Suche (`/locations`)

**Mobile-Struktur:**
```
[CategoryHero: Bild-Banner mit Titel + Kurzbeschreibung]
[Suchleiste + Filterkarte horizontal scrollbar]
  [🔍 Suchen…]  [Typ ▾]  [Stadt ▾]  [Preis ▾]  [Löschen]
[Karten-Grid 1-spaltig (full-width) auf Mobile]
[Mehr laden Button]
[Footer + BottomNav]
```

**Beobachtungen:**
- Sauberste Suchseite — eine Suchleiste, eine Filterreihe
- CategoryHero auf Mobile: nimmt der Bild-Banner wertvollen "above-the-fold"-Platz in Anspruch (User muss erst nach unten scrollen um Ergebnisse zu sehen)
- 1-spaltige Karten auf Mobile: sinnvoll, aber Karten zeigen: Bild (4:3) + Name + Kategorie + Ort + Preis → prüfe ob Preis/Ort sauber umbrechen
- Gibt es einen Leer-Zustand mit hilfreicher Nachricht wenn keine Locations in der gewählten Stadt vorhanden?
- Kein Karten-/Listenansichtstoggle: auf Mobile wahrscheinlich richtig so

---

### 5. Props / Marketplace (`/props`)

**Mobile-Struktur:**
```
[CategoryHero]
[Kategorie-Akkordeon: Abteilung → Untergruppe → Items]
  (vertikal expandierend, nicht im Sheet)
[Sekundärfilter-Leiste horizontal scrollbar]
  [Zustand ▾] [Lieferung ▾] [Preis ▾] [Miet-Typ ▾] [Löschen]
[Karten-Grid 2-spaltig]
```

**Beobachtungen:**
- Das Kategorie-Akkordeon expandiert inline und verdrängt Ergebnisse nach unten — ähnliches Problem wie der alte Crew-"Gewerk & Rollen"-Panel
- Auf Mobile könnten 3 gestapelte UI-Zonen (Hero + Kategorie-Tree + Filterleiste) den Screen überfüllen
- 2-spaltige Cards: Karten haben title + Kategorie + Preis/Tag — prüfe Textabschneidung bei langen Titeln
- `PropCard` nutzt tc("onRequest") / tc("perDay") für lokalisierte Preistexte

---

### 6. Fahrzeuge (`/vehicles`)

**Mobile-Struktur:**
```
[CategoryHero]
[Suchleiste + Filterreihe (scrollbar)]
  [🔍 Suchen…] [Kategorie ▾] [Stadt ▾] [Preis ▾]
[Karten-Grid 2-spaltig]
```

**Beobachtungen:**
- Ähnlich sauber wie Locations
- Fahrzeugkarten: 4:3-Bild + Name + Kategorie + Preis/Tag. Prüfe langen Fahrzeugnamen (z.B. "1967 Ford Mustang Fastback")
- Kein separater "Alle löschen"-Button sichtbar wenn Standardfilter aktiv — gibt es einen?

---

### 7. Jobs-Suche (`/jobs`)

**Mobile-Struktur:**
```
[CategoryHero]
[Suchleiste + Filterreihe]
  [🔍 Suchen…] [Jobart ▾] [Stadt ▾] [Löschen]
[Jobliste vertikal]
  [Jobtitel  Firma  Ort  Tagessatz  [Bewerbung]]
```

**Beobachtungen:**
- Joblisten-Items: auf Mobile braucht ein Job-Item mit Titel + Firma + Ort + Tagessatz + Button viel Platz
- Prüfe ob alle Informationen auf 375px Breite sauber lesen ohne zu überlaufen
- "Urgent"-Badge: sieht auf kleinen Karten auffällig aus — prüfe ob es Elemente verdrängt
- Jobart-Filter: "Freelance / Festanstellung / Praktikum" — erscheinen diese als Tabs oder Dropdown?

---

### 8. Projekte (`/projects`)

**Mobile-Struktur:**
```
[Seiten-Titel + Beschreibung]
[Kategorie-Grid 2-spaltig]
  [🎬 Film & Serie]  [📺 Werbung]
  [📷 Fotografie]    [📱 Social Media]
  [🎵 Musikvideo]    [🎭 Dokumentation]
  [🏢 Corporate]     [📡 Event]
  [➕ Neues Projekt]
```

**Beobachtungen:**
- Sauber und übersichtlich auf Mobile — wahrscheinlich die am besten funktionierende Seite
- Jede Kachel hat Hintergrundfoto + dunkles Overlay + Titel + Beschreibung
- Prüfe ob Bildtexte bei kleinen Schriften und dunklem Hintergrund gut lesbar sind
- ➕ "Neues Projekt"-Kachel: für eingeloggte Nutzer sichtbar?

---

### 9. Einzelnes Projekt (`/projects/[id]`)

**Mobile-Struktur:**
```
[Hero-Bild (4:3)]
[Projektinfos: Titel, Typ, Datum, Team]
[Beschreibung]
[Team-Members als Avatar-Reihe]
[Konversations-Bereich (Kommentare/Chat)]
[CTA-Buttons: Bewerben / Anfragen]
```

**Beobachtungen:**
- Noch nicht vollständig analysiert — bitte auf AI-generierte/leere Zustände prüfen

---

### 10. Firmenprofil-Liste (`/companies`)

**Mobile-Struktur:**
```
[CategoryHero]
[Suchleiste + Typ-Filter]
[Firmen-Grid 1 oder 2-spaltig]
  [Logo + Name + Kategorie + Ort + [Anfragen]]
```

**Beobachtungen:**
- Firmen-Logos: oft quadratisch — prüfe ob verschiedene Aspect-Ratios das Layout brechen
- Kategorie-Bezeichnung kann lang sein ("Kamera- und Lichtverleih, Postproduktion")

---

### 11. Creator / Talent-Profil (`/profile/[slug]`)

**Mobile-Struktur:**
```
[Navbar]
[Cover-Bild (4:3 oder full-width) + Avatar überlagert]
[Name + Hauptrolle + Ort + Verfügbarkeits-Badge]
[Buchungs-/Nachricht-Tabs: [Buchungsanfrage] [Nachricht senden]]
[Portfolio-Bilder Grid 2-spaltig]
[Bio + Fähigkeiten Tags]
[Externe Links]
[Bewertungen]
[Footer + BottomNav]
```

**Beobachtungen:**
- Das Avatar-Overlay über dem Cover-Bild: prüfe ob auf sehr kleinen Screens (320px) das Avatar nicht den Titeltext überlappt
- Buchungs-Tab auf Mobile: Formular mit Datumsfeldern, Budgetfeld, Nachrichtenfeld — native Datepicker auf iOS sehen anders aus als auf Android
- Verfügbarkeits-Badge: "Sofort verfügbar" / "Verfügbar ab [Datum]" / "Aktuell gebucht" — Farben grün/orange/grau — prüfe Kontrast im Dark-Theme
- tcr("availableFrom") + Datum: Datumsformat wird mit `undefined` als Locale übergeben → Browser-Locale

---

### 12. Creator-Listing-Profil (`/creators/[slug]`)

Ähnliche Struktur wie `/profile/[slug]`, aber für Crew-Listings (nicht Nutzerprofile).

---

### 13. Profil-Einstellungen (`/profile`)

**Mobile-Struktur:**
```
[pt-16 min-h-screen]
[Zurück-Link + Seitentitel + "Profil ansehen"-Button]
[Seitenmenü-Tabs (auf Mobile: vertikal gestapelt über Inhalt)]
  Allgemein | Portfolio | Fähigkeiten | Casting | Verfügbarkeit | ...
[Inhalt je nach Tab: Formular-Felder]
```

**Beobachtungen:**
- Das Seitenmenü (`lg:w-56 shrink-0`) wird auf Mobile über den Inhalt gestapelt (flex-col auf Mobile, flex-row auf lg)
- Das heißt auf dem iPhone sieht der Nutzer zuerst eine Liste von Tab-Buttons, dann scrollt er runter zum Formular — sehr viel Scroll für einfache Änderungen
- Kein `pb-14` am Bottom-Container sichtbar → auf Mobile könnte der Save-Button hinter der BottomNav verschwinden
- Bild-Upload: Das Portfolio-Grid zeigt `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4` — auf Mobile 2 Spalten mit 3:4-Aspect-Ratio-Kacheln, das fühlt sich passend an
- Focal-Point-Picker (zum Ausrichten des Hauptfoto-Fokus): öffnet ein Modal über dem Bild mit Touch-Drag — funktioniert das gut auf iOS?
- "Spielalter von/bis"-Inputs: auf Mobile sieht `type="number"` oft unhandlich aus

---

### 14. Dashboard (`/dashboard`)

**Mobile-Struktur:**
```
[pt-16 min-h-screen]
[Sticky Tab-Leiste oben (top-16)]
  [📊 Übersicht] [📋 Inserate] [📅 Buchungen] [💬 Nachrichten] [❤️ Gemerkte] [⚙️ Einstellungen]
[Hauptinhalt je nach Tab]
[Seitenleiste (aside): hidden lg:flex]
```

**Beobachtungen:**
- Auf Desktop: Sidebar-Navigation links (w-60, fixed), Inhalt rechts
- Auf Mobile: Sidebar wird ausgeblendet, stattdessen **horizontale Tab-Leiste** oben — scrollt sie horizontal wenn Tabs nicht reinpassen?
- Tab-Leiste direkt unter der Navbar: `sticky top-16` — der Nutzer hat jetzt 64px Navbar + variable Tab-Leiste + BottomNav. Das ist viel Chrome für wenig Inhalt
- Nachrichten-Tab im Dashboard vs. dedizierte `/messages`-Seite: sind das zwei verschiedene Views?
- Buchungen: Tabelle mit Ref, Datum, Betrag, Status — Tabellen sind auf Mobile oft problematisch (horizontales Scrollen oder abgeschnittene Spalten)

---

### 15. Nachrichten (`/messages`)

**Mobile-Struktur:**
```
[fixed inset-0 top-16 bottom-14]  ← Füllt den Bereich zwischen Navbar und BottomNav
[Linke Spalte — Konversationsliste]
  [Supabase Realtime Live-Updates]
  [Freundschaftsanfragen-Banner (wenn vorhanden)]
  [Konversationsliste mit Avatar + Name + letzter Nachricht]
[Rechte Spalte — Chat-Fenster]
  [Chatpartner-Header + Zurück-Button]
  [Nachrichtenverlauf (scrollbar)]
  [Eingabefeld + Senden-Button]
```

**Mobile-Verhalten:**
- Auf Mobile zeigt `w-full` die Konversationsliste fullscreen
- Wenn eine Konversation geöffnet wird, wechselt die View auf das Chat-Fenster (kein Side-by-Side)
- `fixed inset-0 top-16 bottom-14` — füllt exakt den verfügbaren Bereich. Das ist gut.

**Beobachtungen:**
- Wenn die iOS-Tastatur aufgeht, komprimiert sie den Viewport. Das Eingabefeld könnte hinter der Tastatur verschwinden wenn `bottom-14` nicht dynamisch angepasst wird
- Namensanzeige des Chatpartners: wird per API aus der Datenbank geladen — gibt es einen Leer-Zustand / Ladezustand?
- Realtime-Subscription per Supabase: funktioniert korrekt im Hintergrund-Tab auf iOS? (iOS Safari terminiert Hintergrundprozesse aggressiv)
- Freundschaftsanfragen-Banner: erscheint als sticky Header über der Liste — prüfe ob er die Liste auf sehr kleinen Screens zu stark verkleinert

---

### 16. Notifications (`/notifications`)

**Mobile-Struktur:**
```
[pt-16]
[Seiten-Header: "Benachrichtigungen" + "Alle lesen"]
[Notifications-Liste mit Typ-Icon + Text + Zeitstempel]
[Ungelesene = highlighted]
```

**Beobachtungen:**
- Einfache vertikale Liste, sollte gut auf Mobile funktionieren
- Benachrichtigungs-Text: kann lang sein ("Max Müller hat dein Profil als Gaffer für Projekt XYZ bewertet") — prüfe Zeilenumbruch

---

### 17. Inserat erstellen (`/inserat`)

**Mobile-Struktur:**
```
[Step 1: Typ auswählen]
[Grid 1×2 auf Mobile: 6 Kacheln (Location, Fahrzeug, Requisit, Job, ...)]
  [Icon + Titel + Kurzbeschreibung]

[Step 2+: Formular für den gewählten Typ]
[max-w-2xl mx-auto px-4]
  [Abschnitte: Grunddaten, Details, Medien, Preis, Veröffentlichen]
  [Speichern-Button]
```

**Beobachtungen:**
- `max-w-2xl` mit `px-4` ergibt auf 375px-iPhone ~343px nutzbarer Formularbreite — das ist gut
- Grid für Typenauswahl: `grid-cols-1 sm:grid-cols-2` — auf Mobile eine Spalte, was bei 6 Typen lang scrollt
- Image-Upload-Bereich: nutzt Drag-and-Drop — auf Mobile sinnlos, Touch-Tap zum Hochladen vorhanden?
- Preis-Eingabe + Währungseinheit: in einem Input kombiniert oder getrennte Felder?
- Kein Fortschrittsanzeiger (Progress Bar) für die mehrstufige Erstellung — Nutzer weiß nicht wie weit er ist

---

### 18. Suche (`/search`)

**Mobile-Struktur:**
```
[Suchfeld (prefilled mit Query-Param)]
[Filter-Chips: Alle / Locations / Crew / Props / Fahrzeuge / Jobs / Firmen]
[Ergebnisliste: gemischt, nach Typ gruppiert]
```

**Beobachtungen:**
- Typenfilter als horizontale Chips → sinnvoll auf Mobile
- Ergebniskarten sind typenspezifisch: Creator zeigt Avatar + Name + Rolle, Location zeigt Bild + Name + Ort + Preis — prüfe ob verschiedene Karten-Höhen das Layout zerreißen
- Kein "Keine Ergebnisse" Leer-Zustand mit Suchvorschlägen

---

### 19. Pricing (`/pricing`)

**Mobile-Struktur:**
```
[Hero: "Kostenlos für alle"]
[Feature-Liste: grüne Checkmarks]
[3-Spalten-Vergleichstabelle (Gratis / Pro / Enterprise)]
[FAQ]
[CTA]
```

**Beobachtungen:**
- 3-Spalten-Tabelle auf Mobile: wird sie auf 375px in 3 gleichbreite Spalten gequetscht? Das wären ~117px pro Spalte — Texte könnten nicht mehr lesbar sein
- Prüfe ob die Tabelle auf Mobile in ein Stack-Layout umgewandelt wird oder horizontal scrollt

---

### 20. Auth (`/sign-in`, `/sign-up`)

- Clerk-Standard-UI mit minimalem Custom-Styling
- Keine BottomNav auf diesen Seiten (richtig so)
- Prüfe ob Clerk's eigene Formulare auf iOS korrekt dargestellt werden (Autofill, Passwortmanager)

---

### 21. Statische Seiten (AGB, Datenschutz, Impressum, About, Help)

```
[pt-16 min-h-screen]
[max-w-* mx-auto px-4]
[Langer Text-Content]
[Footer + BottomNav]
```

**Beobachtungen:**
- Lange Rechtstexte (AGB, Datenschutz) auf Mobile: prüfe Schriftgröße (min 16px für body), Zeilenlänge, Kontrast
- Kein "Zurück nach oben"-Button bei sehr langen Seiten
- Help/FAQ: Akkordeon-Pattern vorhanden?

---

## Systemweite Probleme — nach Priorität

### P0 — Kritisch (verhindert Nutzung)

1. **iOS-Tastatur versteckt Eingabefelder**
   Betroffen: `/messages` (Chat-Input), GlobalSearch-Modal, Inserat-Formular
   Wenn die iOS-Tastatur aufgeht, schrumpft der Viewport. `fixed bottom-14`-Positionen werden nicht automatisch verschoben.
   → Lösung: `dvh`-Einheiten oder `visualViewport` API berücksichtigen.

2. **Kein `pb-safe` / BottomNav-Padding auf mehreren Seiten**
   Der Footer hat `pb-14 lg:pb-0`, aber einzelne Seitencontainer (Profil-Einstellungen, Dashboard-Tabs) fehlt das Padding → Buttons/CTAs können hinter der 56px BottomNav verschwinden.

### P1 — Hoch (schlechte UX, verliert Nutzer)

3. **GlobalSearch-Modal + iOS-Tastatur**
   Das Modal öffnet bei `pt-[15vh]`. Wenn die Tastatur aufgeht, schiebt iOS den Viewport hoch. Die max-h-[440px]-Ergebnisliste überlappt möglicherweise mit der Tastatur.

4. **Dashboard-Tabellen ohne Mobile-Optimierung**
   Buchungslisten mit mehreren Spalten (Ref, Datum, Betrag, Status) sind auf 375px kaum lesbar.

5. **Profil-Einstellungen: Tab-Navigation auf Mobile**
   Nutzer sieht zuerst eine Liste von ~8 Tab-Buttons, muss scrollen um zum Formular zu kommen. Fehlender `pb-14` kann den Save-Button verstecken.

6. **CategoryHero auf Suchseiten (Locations, Props, Fahrzeuge, Jobs)**
   Das Bild-Banner kostet "above-the-fold"-Platz auf Mobile. Nutzer muss erst scrollen um Ergebnisse zu sehen.

### P2 — Mittel (messbare Conversion-Einbußen)

7. **3-Spalten-Preistabelle auf Mobile**
   Möglicher Layout-Bruch bei ~375px.

8. **Inserat-erstellen ohne Fortschrittsanzeiger**
   Nutzer weiß nicht, wie viele Schritte noch kommen.

9. **Dreifache Suche auf Homepage**
   Navbar-🔍 + HeroSearch + Kategoriepfade — welche führt wohin?

10. **Promoted-Role-Chips vs. Bottom-Sheet-Abteilungen auf `/creators`**
    Doppeltes Konzept: Row 2 (Chips) UND Sheet "Gewerk & Rollen" erlauben Rollenwahl — können Nutzer das unterscheiden?

### P3 — Niedrig / Kosmetisch

11. **Statistik-Grid auf Homepage mit grid-cols-4** — ggf. eng auf 320px-Screens
12. **ImageStrip** — scrollt ohne sichtbare Scrollen-Hinweise
13. **Keine "Zurück nach oben"-Schaltfläche** auf langen Seiten

---

## Designparameter (als Kontext)

- **Dark Theme**: #0A0A0A Hintergrund, #C2F135 Lime / #E8C96D Gold als Akzente
- **Next.js 16 App Router**, Tailwind CSS v4, next-intl (6 Sprachen)
- **Kein Native-App** — PWA-ähnliche Mobile-Web-Erfahrung
- **BottomNav**: 56px, `safe-area-pb` für iPhone
- **Navbar**: 64px, fixed top
- **Karten-Seitenverhältnisse**: Creator-Portraits 4:5, Locations/Props 4:3
- **Breakpoints**: `sm` = 640px, `lg` = 1024px (kein `md` im Design)

---

## Fragen an ChatGPT

1. **iOS-Tastatur-Problem in `/messages`**: Wie löst man "Chat-Input versteckt sich hinter iOS-Tastatur" in einer PWA ohne native APIs? `dvh`, `visualViewport`, oder `position: sticky` auf das Eingabefeld?

2. **Dashboard auf Mobile**: Sidebar wird durch Tab-Leiste ersetzt. Sind 6+ horizontale Tabs sinnvoll? Wäre eine Bottom-Sheet-Navigation oder ein Dropdown besser?

3. **Profil-Einstellungen Tab-Navigation**: Sidebar-Links werden auf Mobile vertikal gestapelt oberhalb des Formulars. Sollte das ein horizontales Tab-Strip werden? Oder ein einzelnes "Einstellungen"-Dropdown?

4. **CategoryHero auf Suchseiten**: Soll der Image-Banner auf Mobile entfernt oder deutlich verkleinert werden damit Nutzer sofort Ergebnisse sehen?

5. **Preistabelle**: Wie strukturiert man eine 3-Spalten-Vergleichstabelle für Mobile? Stack-Layout (vertikal, eine Spalte pro Plan) oder horizontales Scroll?

6. **Drei Sucheinstiegspunkte auf der Homepage** (GlobalSearch, HeroSearch, Kategoriekacheln): Sollen GlobalSearch und HeroSearch zusammengeführt werden? Was ist das mentale Modell dahinter?

7. **Bottom-Sheet-Filter auf `/creators`**: Die neuen promoted Chips in Row 2 UND der Sheet bieten Rollenwahl an. Ist das Redundanz oder sinnvolle Ergänzung?

8. **Gesamtbewertung Mobile-Priorisierung**: Welche der P0/P1-Probleme haben die stärkste Auswirkung auf die Erstbenutzer-Conversion auf dem iPhone? In welcher Reihenfolge sollten wir diese angehen?
