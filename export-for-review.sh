#!/bin/bash
# Exportiert alle wichtigen Dateien für ein KI-Review

OUTPUT="cinegenius-review.txt"

cat > "$OUTPUT" << 'HEADER'
# CineGenius — Codebase Review
## Bitte reviewe diese Next.js Web-App für die deutschsprachige Filmbranche.

Tech-Stack: Next.js 16 (App Router), Tailwind CSS v4, Supabase, Clerk Auth
Sprache: Deutsch (DE-AT-CH Markt)

Bitte beurteile:
1. Code-Qualität & Struktur
2. UX/UI Konzept anhand der Komponenten
3. Sicherheit (Auth, API-Routen, Datenzugriff)
4. Performance-Überlegungen
5. Was fehlt noch für eine Production-ready App?

---
HEADER

FILES=(
  "app/page.tsx"
  "app/globals.css"
  "components/Navbar.tsx"
  "lib/filmRoles.ts"
  "lib/companyCategories.ts"
  "app/api/companies/route.ts"
  "app/api/companies/[slug]/route.ts"
  "app/api/listings/route.ts"
  "app/api/profile/route.ts"
  "app/company-setup/page.tsx"
  "app/companies/page.tsx"
  "app/companies/CompaniesContent.tsx"
  "app/companies/[slug]/page.tsx"
  "app/companies/[slug]/CompanyDetail.tsx"
  "app/profile-setup/page.tsx"
  "app/creators/CreatorsContent.tsx"
  "app/jobs/JobsContent.tsx"
  "app/inserat/page.tsx"
  "app/dashboard/page.tsx"
  "supabase/migrations/companies.sql"
)

for FILE in "${FILES[@]}"; do
  if [ -f "$FILE" ]; then
    echo "" >> "$OUTPUT"
    echo "================================================================" >> "$OUTPUT"
    echo "FILE: $FILE" >> "$OUTPUT"
    echo "================================================================" >> "$OUTPUT"
    cat "$FILE" >> "$OUTPUT"
    echo "" >> "$OUTPUT"
  else
    echo "[MISSING: $FILE]" >> "$OUTPUT"
  fi
done

LINES=$(wc -l < "$OUTPUT")
SIZE=$(wc -c < "$OUTPUT" | awk '{printf "%.1f KB", $1/1024}')
echo ""
echo "✓ Export fertig: $OUTPUT ($LINES Zeilen, $SIZE)"
echo "  → Einfach den Inhalt kopieren und in eine andere KI einfügen."
