# Casae Living Ops — Handoff (Sessions 2–8 + A–H)

Built June 2026. All sessions from both build briefs are complete; `npm run build` and `npm run lint` are clean. Live at casae-ops.netlify.app.

## What was built

- **Seed data** (`supabase/seed.sql`, applied to remote): 5 properties, 18 rooms, 19 lodgers, 6 contacts. Rooms whose lodger-room assignment was marked `[verify]` in the spec (all of Scarborough and TH8) are seeded with a lodger named **TBC** — the likely name is kept in the lodger's notes for Erin to confirm. Bond amounts (2× weekly rent) and bond received dates (1 Mar 2026) are **placeholders**. Re-running the seed wipes and reloads all operational data. Run with: `supabase db query --linked --file supabase/seed.sql` (note: the CLI has no `db execute`; `db query` is the equivalent).
- **Property dashboard** (`/properties`): card grid with weekly head lease / room income / margin, 18-square occupancy grid (sage = occupied, amber = move-out within 30 days, red outline = vacant), head-lease expiry countdown (amber warning under 90 days), open job count. Detail page with Rooms | Maintenance | Cleans | Fitout tabs.
- **Lodger directory** (`/lodgers`): filterable table, couple names shown together, days-until-move-out (red under 14 days), bond + agreement indicators. Profile page with append-only timestamped notes, emergency contact, document placeholder. Add/edit forms. Move-out flow sets lodger → former, room → vacant, schedules an end-of-tenancy clean, and keeps the bond on the books for return tracking. Brooke is seeded as pending at Barnes St Room 1 (move-in 20 Jun 2026). Bond Float panel: held / pending receipt / due in 30 days / net 90-day outlook.
- **Maintenance** (`/maintenance` + property tab): priority badges (urgent red, high amber, medium blue, low grey), Open → In Progress → Completed flow with actual cost + completion date capture, append-only notes with user + timestamp, mobile-first create form. Contractor is free text, stored as the job's first note.
- **Cleaning** (`/cleaning` + property tab): week/property filters, add clean, recurring generator (weekly/fortnightly, 8 weeks forward), mark complete with timestamp.
- **Home dashboard** (`/`): 4 metric cards (margin is the 72px signature number), vacancy cost ticker counting up live per second, bond float card, 5-of-20 progress bar (target Feb 2027), next-14-days events (move-outs, urgent/high jobs, cleans today/tomorrow), weekly margin snapshot with monthly/annual run rates.
- **Expenses & Fitout** (`/financials`): expense form with the 8 fixed categories and receipt upload (JPEG/PNG/PDF ≤ 10MB) to the private `receipts` bucket at `{property_id}/{YYYY-MM}/{timestamp}-{filename}`; per-property running totals and portfolio summary; HubDoc toggle visible but disabled ("Configure in Settings to enable"). Fitout items are logged per property (property detail → Fitout tab); the portfolio table ranks all 5 properties by payback period (fitout ÷ weekly margin, 1 dp).
- **Pipeline** (`/pipeline`): 7-stage kanban (stage changed via dropdown on each card), projected margin auto-calculated from estimated head lease and room income, priority-suburb filter, stage counts + average margin for negotiating+, portfolio progress bar.
- **Contacts** (`/contacts`): type filter, append-only notes log (adding a note also bumps last-contact date), add/edit forms. 6 contacts pre-seeded; Joe Nardizzi (landlord) and Choice Estates (agent) are linked to TH1, TH8 and TH5.
- **Navigation**: desktop sidebar shows all sections; the mobile bottom bar shows Dashboard, Properties, Maintenance and a More page per the brand spec (new sections — Inspections, Settings — appear under More automatically).

## Sessions A–F (second brief)

- **Profiles** (migration 004): `profiles` (id → auth.users, display_name, email, role default 'staff') with a security-definer trigger that inserts a row on auth user creation; existing user backfilled. RLS: everyone authenticated can read, users update only their own row. The pipeline "assigned to" is now a dropdown of team members and cards show the assignee's display name.
- **Recurring cleans fix**: generating a recurring series first deletes future (`scheduled_date >= today`) cleans with status `scheduled` for the same property + cadence, so re-running replaces instead of duplicating. Completed/past cleans are never touched.
- **Settings** (`/settings`): change display name (writes to profiles); change password — re-authenticates with the current password via `signInWithPassword` before `auth.updateUser` (Supabase doesn't verify the old password itself); email shown read-only. Integrations: Xero "Not connected" with a disabled Connect button (tooltip: "Coming soon — set up your Xero OAuth credentials first"); HubDoc intake email persisted to `app_settings` (key `hubdoc_email`), Test button toasts "Configure Resend API key first". Notification toggles are UI-only placeholders.
- **Documents** (migration 005): private `documents` bucket (20MB, JPEG/PNG/PDF) + `documents` metadata table (property_id, optional lodger_id, type, filename, storage_path, notes, uploaded_by/at). Paths: `{property_id}/{type-slug}/{timestamp}-{filename}`. Property detail has a Documents tab; the lodger profile shows only that lodger's documents (upload there auto-links lodger + property). Download uses a 60s signed URL; delete removes the row then the file, with a confirm dialog. If the metadata insert fails after upload, the orphaned file is removed.
- **Inspections** (`/inspections`, migration 006): property + date-range filters; create form captures scheduled/conducted dates, conducted by (free text), condition (good/fair/poor), notes, multiple photos (stored in the documents bucket under `inspections/{inspection_id}/`, paths kept in a `photo_paths` text[] column), follow-up flag + notes. Detail page shows everything, a photo grid (signed URLs, click to open), delete (also removes photos), and "Create maintenance job from follow-up" which opens a pre-filled job dialog (title, description from follow-up + inspection notes, property fixed) and navigates to /maintenance on save.
- **UX polish**: Skeleton loaders everywhere data fetches (shared `ListSkeleton` for list panels); `EmptyState` (icon, message, CTA) on every list; `ErrorBoundary` wraps the routed page in AppShell (keyed by pathname so it resets on navigation) with Try again / Go to dashboard; success toasts on all mutations including pipeline stage moves and job starts; `ConfirmDialog` before all deletes; lodger directory search bar filters by name (first/last/partner) across all properties, bypassing the property/status filters while typing; maintenance jobs show a days-open indicator (grey, amber > 7d, red > 14d).
- **PWA** (vite-plugin-pwa, `autoUpdate`): manifest name "Casae Ops" / short name "Casae", navy theme + cream background, standalone display. Icons generated from `public/pwa-icon.svg` (navy square, serif C, sage underline) → pwa-192/512 + apple-touch-icon. Service worker precaches the app shell only — Supabase data is never cached, so figures stay live. `InstallPrompt` banner (mobile only, above the tab bar) appears on `beforeinstallprompt`, hides when already installed (standalone check) or previously dismissed (localStorage `casae-install-dismissed`).

## Session G — Xero integration

- **Netlify Functions** (`netlify/functions/`, config in `netlify.toml`, type-checked by `tsc -b` via `tsconfig.functions.json`; shared code in `_lib/xero.ts`, which Netlify ignores as a function because the directory has no matching entry file):
  - `xero-auth` — `GET ?state=<uuid>` 302-redirects to `login.xero.com/identity/connect/authorize` with client_id / redirect_uri / scopes / state (so the client id never ships in the JS bundle); `POST { code }` exchanges the code, resolves the tenant via `GET /connections` (first ORGANISATION), stores tokens and returns `{ orgName, tenantId }`.
  - `xero-refresh` — `POST`, refreshes + persists tokens, returns `{ expiry }`. `xero-api` also refreshes automatically, so this is mostly for tooling.
  - `xero-api` — `GET ?path=api.xro/2.0/...` read-only proxy: refreshes the access token when within 60s of expiry, calls Xero with the `xero-tenant-id` header, retries once on a 401. Only GETs under `api.xro/2.0/` are allowed.
- **Token storage**: `app_settings` keys `xero_access_token` + `xero_refresh_token` (AES-256-GCM, key = sha256(`XERO_CLIENT_SECRET`), value format `iv.tag.ciphertext` base64), `xero_tenant_id`, `xero_token_expiry` (ISO), `xero_org_name`. Functions authenticate as the calling user (Supabase anon key + the caller's JWT), so RLS applies and no service-role key is needed.
- **Scopes**: `openid profile email offline_access accounting.settings accounting.contacts.read accounting.invoices.read accounting.banktransactions.read accounting.payments.read accounting.reports.profitandloss.read accounting.reports.aged.read accounting.reports.balancesheet.read` — Xero only issues refresh tokens with `offline_access`, so it is included in the requested scope list. Xero rotates refresh tokens on every refresh; the previous one stays valid ~30 min, which covers concurrent refreshes.
- **Settings → Integrations**: Connect Xero (generates a state UUID into sessionStorage, navigates via the function redirect), connected state shows "Connected — <org name>" with a confirm-guarded Disconnect (deletes the token keys; the tracking map is kept for reconnects). Once connected, a **tracking category mapping** panel lists the active options of the chosen Xero tracking category with a property dropdown each; saved as JSON to `app_settings` key `xero_tracking_map`.
- **/settings/xero/callback** (`XeroCallbackPage`): verifies the state nonce, exchanges the code exactly once (ref-guarded against StrictMode double-effects — codes are single-use), then shows Connected + org name or the error.
- **Financials → Xero P&L tab** (now the default tab): range presets (this / last month, last 3 / 6 months) + custom from/to; one `Reports/ProfitAndLoss` call per mapped property (`trackingCategoryID` + `trackingOptionID`); table of income / expenses / net per property (click a row to expand the top-5 income and expense accounts), portfolio totals row, "Last synced" from the query cache and a "Sync now" refetch. Footer note: "Showing top accounts per category — view full detail in Xero."
- **P&L parser fix (a8298b6)**: `parsePnLReport` classified sections by testing the income pattern (`/income|revenue|sales/`) before the expense pattern, so "Cost of Sales" matched via "sales" — head lease rent (coded as Cost of Sales in Xero) landed in Income and Expenses showed $0. The expense pattern (now `/expense|cost of (sales|goods)/`) is tested first and income excludes its matches, so Expenses = Cost of Sales + Operating Expenses and net margin is Income − both.
- **Overheads row**: untracked operating expenses (bank fees, Stripe fees, bookkeeping — anything with no tracking option) were invisible because every P&L call was filtered by `trackingOptionID`. `useXeroPnL` now makes one extra `Reports/ProfitAndLoss` call with no tracking filter (same inter-call gap) and returns `{ rows, overall }`. `overheadPnLSummary` in src/lib/xero.ts diffs the whole-org report against the tracked summaries account-by-account (`PnLSummary` now carries full `incomeLines`/`expenseLines` for this); the panel shows the residual as an expandable "Overheads — not tagged to a property" row, and the **Portfolio total row is the org-wide P&L directly**, so its Net is true bottom-line profit and matches Xero's Net Profit. Tracked property nets + overheads net reconcile to the portfolio net.
- **PWA fix**: `navigateFallbackDenylist` now also excludes `/.netlify/*` — without this the installed app's service worker would answer the Connect-button navigation with index.html instead of letting the OAuth redirect through.

## Session H — deploy caching + Xero P&L performance

- **Cache-control headers** (`netlify.toml`): users needed a hard refresh
  (cmd+shift+R) after deploys because the HTML entry point was being cached.
  `/` and `/index.html` now send `max-age=0, must-revalidate`; hashed build
  output (`/assets/*`, `/workbox-*`) is `max-age=31536000, immutable`; unhashed
  PWA files (`/sw.js`, `/registerSW.js`, `/manifest.webmanifest`) are never
  cached so the service-worker update cycle keeps working. Rules are
  deliberately non-overlapping — Netlify applies every matching header rule and
  concatenates duplicates, so a blanket `/*` no-cache rule would poison the
  asset caching. Deep SPA routes get Netlify's identical default header via the
  `/* → /index.html` fallback. Note: with `autoUpdate` PWA, one normal refresh
  after a deploy may still show the old version while the new service worker
  installs; the update lands on the next load.
- **Xero P&L sync speed**: the first sync after a hard refresh could take up to
  ~60s (function cold start + token refresh + sequential calls). Fixes:
  - Inter-call gap in `useXeroPnL` reduced 500ms → 200ms (6 calls is still well
    inside Xero's 60/min limit; the `xero-api` proxy retries 429s with backoff
    as the safety net).
  - `useXeroPnL` now also returns `progress` (`{ done, total }`, reset to null
    when the fetch settles). The panel shows a segmented progress bar + status
    line during the initial load ("Contacting Xero…" until the first report
    lands — that's the cold-start/token-refresh window — then "x of y done…")
    and a compact "x/y reports" counter next to Sync now during background
    refetches.
  - **`xero-warm` scheduled function** (every 10 min, production deploy only):
    pings `xero-api?warm=1` over HTTP to keep that lambda warm — each function
    is its own lambda, so a scheduled function can't warm another just by
    existing. `xero-api` answers `warm=1` with a 200 before auth; no
    credentials involved, nothing to configure (uses Netlify's runtime `URL`
    env var).
  - **Duplicate tracking options deduped**: the saved `xero_tracking_map` JSON
    carried several entries for the same tracking option ID (BR1–BR4 rows per
    property), so the sync made one P&L call per entry — 24 calls instead
    of 6. `useXeroPnL` now dedupes by `trackingOptionId` before fetching
    (first entry's propertyId wins); the fetch loop, progress total and query
    key all derive from the deduped list, and the panel already groups/sums by
    propertyId. Caveat: the duplicates are still in the stored map — the
    Settings mapping panel hasn't been audited for writing them back on save.

## Verified

End-to-end against the live Supabase project (via a temporary test login, since removed): password login returns a session; RLS lets an authenticated user read all 5 properties → 18 rooms → lodgers (17/18 occupied, income $6,900, head lease $5,690, margin $1,210/wk — matches the dashboard); maintenance job and clean inserts succeed; receipts bucket accepts and serves an upload. Test rows/files were deleted afterwards.

Sessions A–F verification (12 Jun 2026): migrations 004–006 applied to the remote and confirmed by query — profiles backfilled with the existing user (display_name defaults to the email's local part), `on_auth_user_created` trigger present, `documents` bucket exists with a 20MB limit, `inspections` and `app_settings` tables live with RLS. `npm run build` (including PWA service-worker generation, 15 precached entries) and `npm run lint` both clean.

## Manual steps needed

1. **Team logins** — only `luke.hanner@crosspondcapital.com` exists in Supabase Auth. Create Erin, Brenna and Kaylin in the dashboard (Auth → Users → Add user, with "auto confirm"). A profiles row is created automatically; each person can set their display name in Settings → Account.
2. **Confirm placeholder seed data** — TBC lodger names/rooms (Scarborough, TH8), bond amounts and received dates, move-in dates, head-lease start/end dates (all currently null, so cards show "Lease end not set").
3. **Future integrations env vars**: `RESEND_API_KEY` (HubDoc test email) is still unwired. Xero's `XERO_CLIENT_ID` / `XERO_CLIENT_SECRET` are already in the Netlify site env and are now used by the functions.
4. **Netlify** — `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` must be in the site env (they already are for the build; the Xero functions read the same two vars at runtime, and Netlify exposes site env vars to functions by default). SPA redirect (`/* → /index.html 200`) needed when deploying.
5. **Xero** — the redirect URI registered on the Xero app must be exactly `https://casae-ops.netlify.app/settings/xero/callback` (override locally with a `XERO_REDIRECT_URI` env var under `netlify dev`). In Xero itself, create a tracking category (e.g. "Property") with one option per property and code transactions to it — then connect in Settings → Integrations and map the options to properties. First sync after connecting: open Financials → Xero P&L.
6. **PWA icon** — `public/pwa-icon.svg` is a simple navy/serif-C placeholder rendered with a system serif (not actual Cormorant Garamond). Swap in a designed icon when there is one and re-export pwa-192.png / pwa-512.png / apple-touch-icon.png.

## Known gaps / next steps

1. **Notifications** (Settings) are UI-only — wiring them needs an Edge Function + Resend.
2. **Xero** is now fully wired (Session G). Remaining caveats: the OAuth flow and P&L can't run under `npm run dev` (functions need `netlify dev` or the deployed site); the P&L parser has now run against the live Cross Pond Capital org — the first real sync surfaced the Cost of Sales misclassification fixed in a8298b6 (see Session G); spot-check income/expenses/net against Xero after the next sync; any authenticated team member can connect/disconnect (app_settings RLS is open to all authenticated users, tokens are encrypted at rest).
3. **Inspection photos** can only be added at creation; the detail page doesn't yet support appending photos (the `useUpdateInspection` hook already handles it if a UI is added).
4. Both fixes from the previous handoff (pipeline "assigned to", recurring-cleans duplication) are done — see Sessions A–F above.
