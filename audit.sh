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
