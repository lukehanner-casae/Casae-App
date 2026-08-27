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
- Session 7 ✓ Acquisition pipeline (/pipeline) — RETIRED in Session K (page + hook
  deleted; `property_prospects` table left in place, unused).
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
- Session G ✓ Xero integration. Netlify Functions (netlify/functions/, shared
  helpers in _lib/xero.ts, netlify.toml + tsconfig.functions.json so tsc -b
  type-checks them): xero-auth (GET ?state= → 302 to Xero authorize so the
  client id stays server-side; POST {code} exchanges + resolves tenant via
  /connections), xero-refresh, xero-api (read-only GET proxy for
  api.xro/2.0/*, auto-refreshes, retries once on 401). Tokens AES-256-GCM
  encrypted (key = sha256(XERO_CLIENT_SECRET)) in app_settings keys
  xero_access_token / xero_refresh_token / xero_tenant_id / xero_token_expiry
  (+ xero_org_name plain); functions act as the calling user via their
  Supabase JWT (anon key + bearer), so RLS still applies. Frontend:
  src/lib/xero.ts (P&L report parser, date ranges, tracking-map types),
  src/hooks/use-xero.ts, /settings/xero/callback route (state-nonce check,
  StrictMode-safe single exchange). Settings → Integrations: live
  Connect/Disconnect + tracking-category → property mapping saved as JSON in
  app_settings key xero_tracking_map (kept on disconnect). Financials →
  default "Xero P&L" tab: range presets + custom dates, per-property
  income/expenses/net rows (expand for top-5 accounts), portfolio totals,
  last-synced + Sync now. PWA navigateFallbackDenylist now also skips
  /.netlify/* so the OAuth redirect isn't swallowed by the service worker.
  Note: offline_access scope is requested in addition to the read scopes —
  Xero won't issue refresh tokens without it.
- Session I ✓ AI insights (/insights, nav between Financials and Pipeline,
  Brain icon; also a fifth mobile tab). Netlify function
  netlify/functions/ai-insights.ts: POST {mode: 'summary'|'chat', messages},
  auth via the caller's Supabase JWT (reuses _lib/xero.ts requireUser).
  Gathers live context (active properties + rooms + lodgers with weekly
  rates/margins, vacant rooms, open/in-progress maintenance with days open,
  non-dead pipeline) plus a best-effort Xero P&L snapshot (this month vs last
  month — one Reports/ProfitAndLoss call per month with trackingCategoryID
  only, so one column per tracking option + org Total; 10-min in-instance
  cache, 12s budget, silently skipped when Xero is down/not connected) and
  streams claude-sonnet-4-6 (ANTHROPIC_API_KEY env var, @anthropic-ai/sdk)
  back as plain UTF-8 text chunks. System prompt encodes the business model
  (head-lease/lodger spread, 20 properties by Feb 2027, WA 6-lodger
  threshold, Barnes-type benchmark, 52/12 weekly→monthly, AUD, CFO tone) +
  the live data JSON; output is plain text (no markdown) for pre-wrap
  rendering. Frontend: src/hooks/use-insights.ts (fetch-reader streaming;
  useDailyBriefing auto-generates on visit, cached in localStorage
  `casae-insights-briefing`, refetched when >6h old; useInsightsChat),
  src/components/insights/InsightsPanel.tsx (Portfolio Briefing card with
  refresh + streaming caret + skeleton), src/pages/InsightsPage.tsx.
- Session J ✓ Casper floating chat: the analyst chat lives in
  src/components/insights/FloatingChat.tsx, mounted once in AppShell — sage
  Brain button fixed bottom-right (above the mobile tab bar; pulses until
  first opened), expanding to a 380×500 panel (navy header, minimise
  chevron, cream message area, sage send). History is in-memory for the
  session; the welcome bubble ("Hi, I'm Casper the Casae analyst! …") is
  client-side only and never sent as API history. The ai-insights system
  prompt names the persona Casper. /insights keeps the briefing card plus a
  pointer to the widget.
- Session K ✓ Occupancy & tenant pipeline pivot (Casae_Ops_Redesign_Spec_v2.md,
  migration 007). Nav: Cleaning + Maintenance hidden (routes/pages/tables kept —
  re-add to src/components/nav-items.ts to restore); old acquisition Pipeline
  deleted from router; new Vacancies (/vacancies) + Pipeline (/pipeline, tenant
  pipeline) tabs, both on the mobile bar. Tables: `pipeline_tenants` (lead →
  viewing_booked → viewed → active → notice_given → vacated; linked_lodger_id /
  linked_vacancy_id / converted_at), `vacate_notices` (replacement_status
  unassigned / lead_assigned / confirmed, status active / completed / cancelled),
  `occupancy_history` (every rooms.status transition via trigger, source
  auto / manual / backfill). `rooms.vacated_at` renamed `vacant_since`;
  `rooms.next_vacate_date` is trigger-maintained from active notices; rooms and
  lodgers gain status `notice_given` (still counts as occupied — see
  isOccupied / isResident in src/lib/metrics.ts). All multi-table writes are
  Postgres functions called via rpc: log_vacate_notice, cancel_vacate_notice,
  match_lead_to_vacancy, unmatch_lead, convert_pipeline_tenant (move-in),
  complete_vacate_notice, apply_passed_vacate_notices (auto-vacancy: flips
  passed notices to vacant with vacant_since = vacate date; scheduled by
  pg_cron `casae-auto-vacancy` daily 00:05 Perth AND called by
  useVacateNotices() on load — idempotent). casae_today() = Perth date.
  Frontend: src/lib/occupancy.ts (stages, buckets, dashboard metrics),
  src/hooks/use-vacate-notices.ts + use-pipeline-tenants.ts (embeds name the
  FK: `pipeline_tenants!vacate_notices_replacement_pipeline_tenant_id_fkey`),
  src/components/vacancies/{LogVacateNoticeDialog,VacatePipelineTable,
  MatchLeadDialog}.tsx, src/components/pipeline/{LeadFormDialog,
  ConvertLeadDialog}.tsx, src/pages/{VacanciesPage,TenantPipelinePage}.tsx.
  Dashboard leads with occupancy by revenue + rooms, vacating 14/30/60,
  pipeline health, 90-day conversion, vacate-pipeline preview, Log Vacate
  Notice button (also on Lodgers + lodger profile). ai-insights context now
  sends vacatePipeline + tenantPipeline instead of prospects.
- Session L ✓ Dashboard trimmed to Occupancy by rooms / Properties vacating /
  Weekly margin. Real lodger data imported via scripts/import-lodgers.py from a
  spreadsheet in ~/Downloads (never in the repo); 3 properties in the sheet
  (18 Windsor St, 105A Beatty Ave, 3/6 Oak Lane) don't exist in Supabase yet —
  see HANDOFF.md Session L.
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