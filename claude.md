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
- Session A ✓ Fixes: `profiles` table (migration 004) synced from auth.users via
  trigger + backfill; pipeline "assigned to" is now a team-member dropdown
  (src/hooks/use-profiles.ts). Recurring cleans generator now replaces future
  unstarted cleans for the same property/cadence instead of duplicating.
- Session B ✓ Settings (/settings): Account (display name → profiles, change
  password with current-password re-auth), Integrations (Xero placeholder
  disabled w/ tooltip; HubDoc intake email saved to `app_settings` key/value
  table — migration 004; test button stubbed), Notifications placeholder
  toggles (UI only).
- Session C ✓ Documents: private `documents` bucket (migration 005, 20MB,
  JPEG/PNG/PDF) + `documents` table; files at {property_id}/{type}/{ts}-{file}.
  DocumentsPanel reused on property detail Documents tab and lodger profile
  (filtered to lodger). 7 doc types incl. Head Lease / Lodging Agreement / BAS.
- Session D ✓ Inspections (/inspections, nav under Maintenance, migration 006):
  property + date-range filters, create form with multi-photo upload (documents
  bucket, inspections/{id}/ path), detail page with photo grid, follow-up flag,
  and "Create maintenance job from follow-up" pre-filled dialog.
- Session E ✓ UX polish: shadcn Skeleton loaders (ListSkeleton helper), shared
  EmptyState with CTA, ErrorBoundary around the routed page (remounts per
  route), success toasts everywhere, ConfirmDialog before deletes, lodger name
  search (spans all properties), days-open indicator on maintenance jobs
  (amber >7d, red >14d).
- Session F ✓ PWA via vite-plugin-pwa (autoUpdate): manifest "Casae Ops" /
  "Casae", navy theme, icons from public/pwa-icon.svg (pwa-192/512,
  apple-touch-icon), InstallPrompt banner on mobile (beforeinstallprompt,
  dismissal in localStorage).
- Shared layers: src/lib/types.ts (DB row types), src/lib/format.ts (AUD/date/notes
  helpers), src/lib/metrics.ts (margin, occupancy, bond float, payback),
  src/hooks/use-*.ts (one TanStack Query hook file per domain).
- Append-only notes convention: single text column, entries
  `[date — user.email] text` via appendNote()/parseNotes() in src/lib/format.ts.
- See HANDOFF.md for verification results, manual steps and known gaps.
- TODO (manual): create remaining team logins (Erin, Brenna, Kaylin) in Supabase
  Auth dashboard — Luke's exists (a profiles row auto-creates on signup; display
  names are set in Settings). Confirm TBC lodger names + placeholder bond data
  in seed (flagged in lodger notes).