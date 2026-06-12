# Casae Living Ops — Handoff (Sessions 2–8)

Built June 2026. All sessions from the build brief are complete; `npm run build` and `npm run lint` are clean.

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
- **Navigation**: desktop sidebar shows all sections; the mobile bottom bar shows Dashboard, Properties, Maintenance and a More page per the brand spec.

## Verified

End-to-end against the live Supabase project (via a temporary test login, since removed): password login returns a session; RLS lets an authenticated user read all 5 properties → 18 rooms → lodgers (17/18 occupied, income $6,900, head lease $5,690, margin $1,210/wk — matches the dashboard); maintenance job and clean inserts succeed; receipts bucket accepts and serves an upload. Test rows/files were deleted afterwards.

## Manual steps needed

1. **Team logins** — only `luke.hanner@crosspondcapital.com` exists in Supabase Auth. Create Erin, Brenna and Kaylin in the dashboard (Auth → Users → Add user, with "auto confirm").
2. **Confirm placeholder seed data** — TBC lodger names/rooms (Scarborough, TH8), bond amounts and received dates, move-in dates, head-lease start/end dates (all currently null, so cards show "Lease end not set").
3. **Future integrations env vars** (not yet wired, for the Edge Function/Netlify sessions): `HUBDOC_EMAIL` (confirm which of the two intake addresses is live), `RESEND_API_KEY`, Xero OAuth client ID/secret.
4. **Netlify** — add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to site env; SPA redirect (`/* → /index.html 200`) needed when deploying.

## Most likely to need fixing

1. **Pipeline "assigned to"** — the schema stores `assigned_to_user_id` (auth.users FK) but the client can't list other users, so the form only offers "assign to me" and cards show "assigned to you / assigned". A `profiles` table (id, display_name) synced from auth would fix this properly.
2. **Recurring cleans duplication** — the 8-week generator inserts blindly; running it twice for the same property/cadence creates duplicate scheduled cleans. Either dedupe on insert or add a "clear future routine cleans" action.
