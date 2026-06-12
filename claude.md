# Casae Living — Internal Ops App

## Stack
React + Vite + TypeScript. Tailwind CSS + shadcn/ui only.
Supabase for auth, DB, storage. TanStack Query for all data fetching.
Netlify deployment.

## Rules
- Mobile-first layout on every component
- Supabase client via singleton import only
- All DB queries through TanStack Query hooks
- No inline styles, no hardcoded colours

## Brand
Navy #2C3E4A, Stone #C8C4B0, Sage #5C7A52, Cream #F5F3EE
Cormorant Garamond for headings. Jost for body.

## What's been built
- Session 1 ✓ Foundation: Tailwind v4 + shadcn/ui (new-york, stone base), brand tokens
  in src/index.css, Google Fonts (Cormorant Garamond / Jost) in index.html.
  Supabase singleton at src/lib/supabase.ts; TanStack Query + Router + AuthProvider
  wired in main.tsx. Schema migration 001 (9 tables + RLS) applied to remote.
  Branded login (email/password) + protected app shell with navy sidebar / mobile
  bottom tab bar and placeholder pages for all sections.
- Path alias: `@/*` -> `src/*`. Auth via `useAuth()` from src/auth/AuthProvider.
- Session 2 ✓ Seed data (supabase/seed.sql — 5 properties, 18 rooms, 19 lodgers,
  6 contacts; re-runnable, wipes operational tables; apply with
  `supabase db query --linked --file supabase/seed.sql`). Property card grid
  (/properties) with occupancy squares + lease countdown; detail page with
  Rooms | Maintenance | Cleans | Fitout tabs.
- Session 3 ✓ Lodger directory (/lodgers) with property/status filters, bond float
  panel, add/edit forms, profile page (/lodgers/:id) with append-only notes,
  move-out flow (former + room vacant + auto end-of-tenancy clean + bond tracking).
- Session 4 ✓ Maintenance (/maintenance) priority badges, Open→In Progress→Completed
  with cost capture, append-only notes. Cleaning (/cleaning) week filter, recurring
  generator (8 wks forward), mark complete. Both reuse panels in src/components/.
- Session 5 ✓ Live home dashboard: 4 metric cards, per-second vacancy cost ticker,
  bond float, 5-of-20 progress bar, next-14-days events, margin snapshot.
- Session 6 ✓ Expenses + fitout (/financials): receipt upload to private `receipts`
  bucket (migration 002, path {property_id}/{YYYY-MM}/{ts}-{file}), per-property
  totals, disabled HubDoc toggle, payback ranking table.
- Session 7 ✓ Acquisition pipeline (/pipeline): 7-stage kanban, dropdown stage moves,
  auto projected margin, priority-suburb filter, summary + progress bar.
- Session 8 ✓ Contacts CRM (/contacts): type filter, append-only notes (bumps
  last-contact date), property links (Joe Nardizzi / Choice Estates → Oak Lane).
- Shared layers: src/lib/types.ts (DB row types), src/lib/format.ts (AUD/date/notes
  helpers), src/lib/metrics.ts (margin, occupancy, bond float, payback),
  src/hooks/use-*.ts (one TanStack Query hook file per domain).
- Append-only notes convention: single text column, entries
  `[date — user.email] text` via appendNote()/parseNotes() in src/lib/format.ts.
- See HANDOFF.md for verification results, manual steps and known gaps.
- TODO (manual): create remaining team logins (Erin, Brenna, Kaylin) in Supabase
  Auth dashboard — Luke's exists. Confirm TBC lodger names + placeholder bond data
  in seed (flagged in lodger notes).