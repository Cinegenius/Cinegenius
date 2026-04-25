#!/bin/bash
# Generates ChatGPT code-audit prompts from the CineGenius codebase.
# Run: bash audit.sh
# Erzeugt: chatgpt_audit_1.md und chatgpt_audit_2.md

HEADER='Du bist ein erfahrener Next.js / TypeScript Code-Reviewer. Analysiere den folgenden Code einer Produktions-Web-App und suche nach:

1. **Bugs & Laufzeitfehler** — null/undefined-Zugriffe, fehlende await, falsche Typen
2. **Sicherheitslücken** — XSS, ungeschützte API-Routen, fehlende Auth-Checks
3. **Broken UI** — fehlende mobile Layouts, fehlende Zustände (loading/empty/error)
4. **Logikfehler** — Race Conditions, falsche Bedingungen, fehlende Edge Cases
5. **Tote Links / 404** — Links zu nicht existierenden Seiten oder API-Routen

Für jeden Fehler:
- **Datei + Zeile**
- **Was das Problem ist**
- **Wie man es behebt**

Priorisiere: 🔴 Kritisch > 🟠 Hoch > 🟡 Mittel > 🟢 Niedrig

---

## TECH STACK
- Next.js App Router, TypeScript, Tailwind CSS v4
- Clerk (Auth): useUser() client-side, auth() server-side
- Supabase (Postgres + Storage), Service Role via supabaseAdmin
- Vercel Deployment

---

## BEREITS BEHOBEN — bitte nicht nochmal melden

Die folgenden Punkte wurden bereits in vorherigen Audit-Runden gefixt:

- **Open Redirect in profile-setup**: `safeRedirect()` ist implementiert und wird an allen Stellen verwendet
- **`/api/conversations/[id]`**: Route existiert — GET lädt Nachrichten + markiert als gelesen, POST sendet Nachricht mit Block-Check, Notification und Rate Limit
- **`/api/notifications`**: Route existiert — GET, POST (einzeln lesen), PATCH (alle lesen), immer mit `.eq("user_id", userId)` gefiltert
- **`/api/unread-count`**: Route existiert — zählt nur Nachrichten aus eigenen Conversations
- **`/api/reviews/eligible`**: Route existiert — prüft bestätigte Bookings und akzeptierte Applications
- **`/api/project-festivals`** + **`/api/project-festivals/[id]`**: Beide Routes existieren mit Ownership-Check
- **`created_by` in public Project-GET**: Wurde entfernt
- **Conversation-Dedupe**: Bidirektionale OR-Suche ist implementiert
- **`genre` in PATCH**: Wird korrekt in `metadata.genre` gemergt, nicht als eigene Spalte
- **`account_type` self-elevation**: Aus `ALLOWED_PATCH_KEYS` entfernt, im Client nicht mehr gesendet
- **Avatar-Upload `res.ok`-Check**: Vorhanden, inkl. URL-Guard
- **`patchDistribution` / `removePhoto` Fehlerbehandlung**: State-Update nur bei `res.ok`
- **Profile-GET DB-Fehler**: Werden jetzt als 500 weitergegeben statt `exists: false`
- **Project-PATCH Allowlist**: Enthält jetzt alle Felder die ProjectDetail sendet (status, logline, production_company, runtime_minutes, trailer_url, timeline-Felder, release-Felder)
- **`app/api/messages/route.ts`**: Diese Route wird nicht gebraucht — die Messages-Seite nutzt `/api/conversations` und `/api/conversations/[id]`
- **`projects`-Tabelle hat keine `published`-Spalte**: Projekte sind by Design immer öffentlich (kein Draft-Konzept). Ein `.eq("published", true)` Filter würde alle Projektseiten brechen.

---
'

write_file() {
  local OUT="$1"
  shift
  local FILES=("$@")

  echo "$HEADER" > "$OUT"
  echo "## DATEIEN" >> "$OUT"
  echo "" >> "$OUT"

  local INCLUDED=0
  local SKIPPED=0

  for FILE in "${FILES[@]}"; do
    if [ ! -f "$FILE" ]; then
      echo "### ⚠️ FEHLT: $FILE" >> "$OUT"
      echo "" >> "$OUT"
      ((SKIPPED++))
      continue
    fi
    LINES=$(wc -l < "$FILE")
    echo "### $FILE ($LINES Zeilen)" >> "$OUT"
    echo '```tsx' >> "$OUT"
    cat "$FILE" >> "$OUT"
    echo "" >> "$OUT"
    echo '```' >> "$OUT"
    echo "" >> "$OUT"
    ((INCLUDED++))
  done

  echo "---" >> "$OUT"
  echo "Analysiere alle Dateien und liste **alle** gefundenen Fehler." >> "$OUT"

  local CHARS=$(wc -c < "$OUT")
  local KB=$((CHARS / 1024))
  echo "$INCLUDED Dateien · ${KB} KB → $OUT"
  if [ $CHARS -gt 400000 ]; then
    echo "  ⚠️  Zu groß für ChatGPT — bitte aufteilen"
  else
    echo "  ✅ Größe OK"
  fi
}

# ── Teil 1: API-Routen + Middleware + Auth ────────────────────────────────────
PART1=(
  "middleware.ts"
  "lib/auth/index.ts"
  "lib/db.ts"
  "lib/guards.ts"
  "app/api/profile/route.ts"
  "app/api/friendships/route.ts"
  "app/api/friendships/[id]/route.ts"
  "app/api/projects/route.ts"
  "app/api/projects/[id]/route.ts"
  "app/api/projects/[id]/verify/route.ts"
  "app/api/companies/route.ts"
  "app/api/listings/route.ts"
  "app/api/conversations/route.ts"
  "app/api/conversations/[id]/route.ts"
  "app/api/notifications/route.ts"
  "app/api/unread-count/route.ts"
  "app/api/blocks/route.ts"
  "app/api/reports/route.ts"
  "app/api/reviews/route.ts"
  "app/api/reviews/eligible/route.ts"
  "app/api/favorites/route.ts"
  "app/api/upload/route.ts"
  "app/api/project-credits/route.ts"
  "app/api/project-festivals/route.ts"
  "app/api/project-festivals/[id]/route.ts"
  "components/ProfileGuard.tsx"
)

# ── Teil 2: Pages + Components ───────────────────────────────────────────────
PART2=(
  "app/profile/[slug]/page.tsx"
  "app/profile/[slug]/ProfileView.tsx"
  "app/projects/[id]/page.tsx"
  "app/projects/neu/page.tsx"
  "app/companies/[slug]/page.tsx"
  "app/tiere/[slug]/page.tsx"
  "app/vehicles/[slug]/page.tsx"
  "app/notifications/page.tsx"
  "app/messages/page.tsx"
  "app/sign-up/[[...sign-up]]/page.tsx"
  "app/profile-setup/page.tsx"
  "components/ProjectDetail.tsx"
  "components/LocationDetail.tsx"
  "components/PropDetail.tsx"
  "components/InquiryForm.tsx"
  "components/ReviewsSection.tsx"
  "components/FavoriteButton.tsx"
  "components/Navbar.tsx"
  "components/AvailabilityCalendar.tsx"
)

echo ""
echo "Generiere Audit-Dateien..."
echo ""
write_file "chatgpt_audit_1.md" "${PART1[@]}"
write_file "chatgpt_audit_2.md" "${PART2[@]}"

echo ""
echo "Fertig! Nächste Schritte:"
echo "  1. Inhalt von 'chatgpt_audit_1.md' in ChatGPT einfügen"
echo "  2. Inhalt von 'chatgpt_audit_2.md' in ChatGPT einfügen"
echo "  3. Fragen: 'Welche Fehler hast du gefunden?'"
