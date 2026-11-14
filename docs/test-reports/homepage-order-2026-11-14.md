# Homepage section order — 14 November 2026

## Confirmed scope

Markus requested a section reorder, balanced spacing and unchanged sizes/design.
The header, introduction, search and six discovery shortcuts remain unchanged.
The order is:

1. Introduction and search
2. Entdecken
3. Neue Crew Mitglieder
4. Aus der Branche
5. Organisationen
6. Marktplatz
7. Jobs
8. Neu entdecken (community photos)
9. Branchenpartner (Firmen & Studios)
10. Locations
11. Schwarzes Brett
12. Aktuelle Filmprojekte, followed by the existing footer

The existing news/organization component stays together: news precedes
organizations on small screens; their existing adjacent columns remain on
desktop. This is an ordering change, not a new organization-card layout.

## Implementation boundaries

`app/page.tsx` separates Crew and partners from the former recommendation block.
All groups reuse the same request-local data promise. Cards, headings, links,
media rendering, rail controls and card sizes are preserved; the existing
responsive container, gap and padding values provide the section spacing.
Empty groups remain omitted without blank reserved sections.

The discovery photo request remains independently bounded and permission-checked.
The community board still loads near the viewport. No database, API, privacy,
ranking, legal copy or language-catalog changes are involved.

## Verification and handoff

- Production build, nine-language catalog check, shared design check and targeted
  lint passed.
- All 35 existing homepage streaming, avatar and organization editorial tests
  passed after adapting their component references/order to the moved sections.
- Exact source comparison confirms unchanged data acquisition, location/photo
  handling and moved Crew, marketplace, jobs and partner card markup.
- Chromium checks passed at 320, 393, 768, 834, 1024, 1366 and 1440 CSS px.
  Before/after measurements match for the upper-page positions and existing
  card dimensions, typography and surfaces. Every section appears once in the
  agreed order, with no horizontal page overflow. Rail buttons retain 44px
  targets and work by click and keyboard. The final project action can scroll
  above the fixed bottom navigation.
- Eight additional 393px checks cover English, Spanish, Italian, Czech,
  Hungarian, Dutch, Belgian Dutch and Swedish. Together with German, all nine
  locales retain the complete order and usable layout.
- Three further Chromium checks at 393, 834 and 1440px passed navigation to Crew
  and Locations and actual browser Back. They recorded no image-response errors,
  browser exceptions or local server 5xx responses. These fresh checks also
  confirm that the unavailable images in one dense-run desktop capture were
  temporary; image rendering/permissions were not changed.
- WebKit could not start because this server lacks its system libraries. Actual
  Safari/iPad and native Xcode checks are explicitly part of the Mac handoff,
  not claimed as completed here.
- Browser evidence is stored outside the source tree in
  `/srv/cinegenius/audits/20261114-home-order/`.

Website changes must be handed to APP Entwicklung and the explicitly requested
“MacBook Air M1 für CineGenius-App einrichten” task with the reviewed commit,
browser results and publication status. Their native Workplace/Recce/RoomPlan
changes remain separate. Browser viewport checks are not physical iPad, iPhone,
Mac Safari or Xcode validation.

This homepage change is prepared for review; production publication requires
Markus's request. The preceding map-control release is separate.
