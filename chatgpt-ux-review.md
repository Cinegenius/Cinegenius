# CineGenius — UX Review Request for ChatGPT

## What is CineGenius?
A film industry marketplace (Next.js, dark theme, mobile-first) for the DACH region.
Users can: find filming locations, hire crew & talent, rent props/vehicles/equipment, post or apply for jobs.
Target audience: film directors, DPs, producers, freelancers, actors, models, location owners — ranging from Netflix productions to solo content creators.

---

## Pages to evaluate

### 1. Global search (Navbar — every page)
A `⌘K` / Ctrl+K search modal that searches across all categories simultaneously.

**Trigger button (desktop):**
```
[🔍 Suchen…  ⌘K]
```
Small button in the top navbar, right side. Shows a full-screen modal on click.

**Modal layout:**
- Search input at top
- If no query: shows "Recent searches" (if any) OR 4 suggestion chips (e.g. "Camarógrafo", "Warehouse Berlin", "Classic car", "Director wanted")
- As user types: groups results by type (Locations / Vehicles / Props / Filmmakers / Jobs / Companies) with icon + color-coded category label per group
- Footer: result count (ICU plural) + "All results →" button → goes to `/search?q=…`
- Keyboard: ArrowUp/Down to navigate, Enter to open, Escape to close

**On mobile:** The `⌘K` button is hidden — no alternative entry point visible in the navbar. Users must scroll/navigate to find category-specific search bars.

---

### 2. Crew search page (`/creators`) — **main problem area on iPhone**

This is the most complex filter page. Here is the exact mobile UI structure:

#### Filter bar (sticky, above results):

**Row 1:**
- Full-width text input: `[🔍 Name, Skill suchen…  ×]`
- Grid/List toggle: `[⊞][≡]`

**Row 2 (horizontally scrollable on mobile — all items in one line):**
- Toggle switch: `[○] Verfügbar`
- Separator `|`
- Sort dropdown: `[Empfohlen ▾]`
- Separator `|`
- Filter button: `[⊟ Anbieter & Vermieter]`
- Separator `|`
- Filter button: `[⊞ Gewerk & Rollen ▾]` — opens the role panel below
- Dropdown: `[📍 Stadt ▾]`
- Dropdown: `[🌐 Sprache ▾]`
- Filter button: `[⊟ Mehr Filter ▾]` — expands a 3rd row
- Clear button: `[Löschen]` (appears only when filters active)

**Row 3 (expanded "Mehr Filter"):**
- Dropdown: `[🌐 Land ▾]`
- Dropdown: `[👥 Profiltyp ▾]` (actor, model, DP, director, etc.)
- Dropdown: `[⊟ Haarfarbe ▾]`
- Dropdown: `[⊟ Augenfarbe ▾]`
- Input pair: `Spielalter [ von ] – [ bis ]`
- Dropdown: `[🌐 Reisen ▾]`

**Role panel (expanded "Gewerk & Rollen"):**
```
Mobile:
  [🎬 Film] [📷 Foto] [📱 Social] [🎭 Talent] [⚙️ Technik]  ← horizontal scroll
  ─────────────────────────────────────────────────────────
  [🔍 Suchen…]
  [ ] Regie    [ ] Kamera    [ ] Ton
  [ ] Gaffer   [ ] Script    [ ] Continuity
  ... (up to 20+ roles in 2-col grid)
  
Desktop: two-panel sidebar left (departments) + roles right
```

**Active filter chips (below role panel):**
```
[🎬 Regie ×] [📷 Foodfotograf ×]    Alle löschen
```

**Results:**
```
3 Profile gefunden
[Card] [Card]
[Card] [Card]
...
```

---

### 3. Locations search (`/locations`)
Single search bar + dropdown filters (type, city, price range). Simpler. Relatively clean.

### 4. Props/Marketplace search (`/props`)
Category panel (dept/group tree) + secondary filter panel (condition, delivery, price range, rental type). More complex than locations but less than crew.

---

## Specific questions for ChatGPT

1. **Global search usability:** Is the `⌘K` pattern discoverable on mobile? What would be a better mobile entry point?

2. **Crew search — mobile overwhelm:** On iPhone, the filter bar has 2+ scrollable rows + an expandable role panel + a "Mehr Filter" expansion + active chips. That's up to 4 stacked rows of controls before the user sees any results. How should this be restructured for mobile?

3. **Crew search — "Gewerk & Rollen" panel:** On mobile this opens inline (pushes results far down). Is a bottom sheet / full-screen modal a better pattern? What's the UX cost of the current inline approach?

4. **Filter discoverability:** Users land on the crew page with zero filters active. The most important filter — role/department (e.g. "I need a DP") — is buried behind a button labeled "Gewerk & Rollen". Would promoting this filter (e.g. as large pill chips for top departments) convert better?

5. **Search bar count:** A user on the crew page sees: (a) the global `⌘K` button in the navbar, (b) the "Name, Skill" input at the top of the page, (c) a role-search input inside the "Gewerk & Rollen" panel. Three different search inputs for one page. Is this confusing?

6. **Grid vs. List toggle:** Is this needed at all on mobile, where grid = 2 columns and list = full-width? Does this UI element earn its space?

7. **"Verfügbar" toggle:** It's a toggle switch in row 2 of a horizontally-scrolling strip. Easy to miss or accidentally scroll past. Better placement?

8. **Sort placement:** Currently buried in row 2. When would a user want to sort? Probably after applying filters — is the current position logical?

9. **Empty state vs. filter state:** After applying a filter with 0 results, the user sees "Keine Profile gefunden" with a "Filter zurücksetzen" CTA. Is this enough or should the filter state be more visible at this point?

10. **Overall information architecture:** The app has 6 categories (Locations, Crew, Marketplace, Jobs, Companies, Projects). Are these the right top-level categories for a mobile user? What would a user type "film production app" expect to find first?

---

## Design constraints
- Dark theme (#0A0A0A background, lime/gold accent #C2F135 / #E8C96D)
- Next.js App Router, Tailwind CSS v4
- Mobile bottom nav bar occupies ~56px at the bottom
- No native app — this is a PWA-style mobile web experience
- Cards use 4:5 aspect ratio for creator portraits, 4:3 for props/locations

---

## What we want from ChatGPT
- Honest UX assessment of the crew search on mobile
- Concrete restructuring suggestions (e.g. "collapse all filters into a single bottom sheet", "promote 3 top role chips above results", etc.)
- Assessment of the global search discoverability on mobile
- Priority ranking: which of the above issues hurts conversion most?
