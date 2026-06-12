# Casae Living — Internal Operations App
## Planning Spec v1.0 — June 2026

---

## 1. Overview and Principles

An internal co-living management platform for the Casae team. Replaces spreadsheets and disconnected tools with a single source of truth designed specifically for the head-lease / room-subletting model.

Every feature and metric should reflect co-living unit economics: head lease cost, room income, margin per property, bond float, vacancy cost. Generic property management software doesn't model this. This app will.

**Users at launch:** Luke, Erin, Brenna, Kaylin — 4 logins, single permission level. Schema designed for role expansion (admin / staff / read-only) without a migration.

---

## 2. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React + Vite + TypeScript | Fast builds, modern DX |
| Styling | Tailwind CSS + shadcn/ui | Casae brand tokens applied globally |
| Charts | Recharts | Revenue, margin, occupancy |
| Backend / DB | Supabase | Auth, PostgreSQL, Storage, Edge Functions, real-time |
| Hosting | Netlify | CI/CD from GitHub, Netlify Functions for serverless ops |
| Server state | TanStack Query (React Query) | All Supabase queries |
| UI state | Zustand | Modals, sidebar state, filters |
| Xero | Xero OAuth 2.0 API | Tokens stored encrypted in Supabase |
| Email | Resend (via Supabase Edge Function) | HubDoc forwarding, lodger comms |
| PWA | Vite PWA plugin | Installable on mobile; offline-tolerant reads |

**Mobile:** Responsive layout from day one. Erin is on-site during fitouts. Kaylin is in Johannesburg. PWA with manifest and service worker installed at project setup — not bolted on later.

---

## 3. Database Schema

### `properties`
```
id uuid PK
display_name text           -- "TH8 Oak Lane", "Barnes St"
address text
suburb text
weekly_head_lease numeric
landlord_contact_id uuid FK contacts
agent_contact_id uuid FK contacts
head_lease_start date
head_lease_end date
is_fixed_rent boolean
smart_lock_installed boolean
fitout_cost_total numeric
status text                 -- active / prospect / archived
notes text
created_at timestamptz
```

### `rooms`
```
id uuid PK
property_id uuid FK properties
room_name text              -- "Room 1", "Ensuite", "Small Room"
weekly_rent numeric
is_ensuite boolean
is_couple_room boolean
size_category text          -- standard / large / small
status text                 -- occupied / vacant / maintenance
notes text
```

### `lodgers`
```
id uuid PK
first_name text
last_name text
email text
phone text
room_id uuid FK rooms
move_in_date date
expected_move_out date
bond_amount numeric
bond_received_date date
bond_returned_date date     -- null = bond still held
lodging_agreement_signed boolean
lodging_agreement_date date
is_couple boolean           -- shared agreement
partner_name text           -- second person on couple agreement
emergency_contact_name text
emergency_contact_phone text
status text                 -- current / former / pending
notes text
```

### `maintenance_jobs`
```
id uuid PK
property_id uuid FK properties
room_id uuid FK rooms       -- nullable
title text
description text
contractor_contact_id uuid FK contacts  -- nullable
status text                 -- open / in-progress / completed / cancelled
priority text               -- low / medium / high / urgent
estimated_cost numeric
actual_cost numeric
reported_by_user_id uuid FK auth.users
created_at timestamptz
completed_at timestamptz
notes text
```

### `cleans`
```
id uuid PK
property_id uuid FK properties
scheduled_date date
clean_type text             -- routine / end-of-tenancy / pre-move-in
assigned_to text
status text                 -- scheduled / completed / skipped
completed_at timestamptz
notes text
recurrence text             -- none / weekly / fortnightly
```

### `contacts`
```
id uuid PK
type text                   -- landlord / agent / contractor / other
first_name text
last_name text
company_name text
email text
phone text
address text
trade_type text             -- for contractors: plumber / electrician / etc.
last_contact_date date
notes text
```

### `expenses`
```
id uuid PK
property_id uuid FK properties
amount numeric
expense_date date
category text               -- mirrors Xero tracking category names
description text
receipt_url text            -- Supabase Storage path
submitted_to_xero boolean
xero_expense_id text
hubdoc_forwarded boolean
hubdoc_forwarded_at timestamptz
created_by uuid FK auth.users
created_at timestamptz
```

### `fitout_items`
```
id uuid PK
property_id uuid FK properties
description text
cost numeric
purchase_date date
category text               -- furniture / appliances / bedding / smart-lock / misc
receipt_url text
notes text
```

### `property_prospects`
```
id uuid PK
address text
suburb text
est_rooms int
est_weekly_head_lease numeric
est_weekly_room_income numeric
projected_weekly_margin numeric
source text                 -- kaylin-outreach / agent / private / referral
agent_contact_id uuid FK contacts
stage text                  -- prospect / viewing-booked / viewed / proposal-sent / negotiating / secured / dead
first_contact_date date
viewing_date date
assigned_to_user_id uuid FK auth.users
notes text
created_at timestamptz
```

### `inspections` (V2)
```
id uuid PK
property_id uuid FK properties
scheduled_date date
conducted_date date
conducted_by text
overall_condition text      -- good / fair / poor
notes text
photo_urls text[]
follow_up_required boolean
follow_up_notes text
```

### `lodger_enquiries` (V2)
```
id uuid PK
room_id uuid FK rooms
enquirer_name text
email text
phone text
source text                 -- flatmates / facebook / referral / direct
enquiry_date date
stage text                  -- enquired / viewing-booked / viewed / approved / rejected / withdrew
viewing_date date
notes text
```

---

## 4. Feature Spec — MVP

### 4.1 Home Dashboard

First screen on login. Five key blocks:

**Portfolio Pulse** (top row, 4 large numbers):
- Weekly room income vs weekly head lease vs weekly margin — shown as live figures based on occupied rooms
- Portfolio occupancy: X / Y rooms occupied

**Vacancy Cost Ticker** — any vacant room shows a running daily cost (room rent ÷ 7 = $/day in foregone income). Currently all rooms occupied so this reads zero, but it's built and ready. Intended to create urgency for Kaylin's placement work.

**Bond Float** — total bonds currently held across all lodgers. Single number with a subtext showing how many bonds are pending receipt and how many are due for return in the next 30 days.

**Upcoming events** — next 14 days: expected move-outs, scheduled cleans, open maintenance jobs by priority.

**Quick add** — floating button: log maintenance job, add expense, add clean. No navigating away for common actions.

---

### 4.2 Property and Room Dashboard

Card grid, one card per property. Each card shows:
- Display name + address
- Head lease / room income / margin (weekly)
- Room occupancy grid: coloured squares (sage green = occupied, amber = move-out within 30 days, red = vacant)
- Days until head lease renewal or expiry
- Smart lock: installed / not installed
- Open maintenance jobs count
- Next scheduled clean

Clicking a card opens the property detail view:
- Full room list with lodger name, rent, move-in / expected move-out, bond status
- Tabs: Rooms | Maintenance | Cleans | Documents | Finances

---

### 4.3 Lodger Directory

Table view. Filterable by property and status (current / former / pending).

Columns: name, property, room, rent/wk, move-in, expected move-out, bond received, agreement signed, phone.

Couple rooms show both names. Click-through to lodger profile: full detail, notes, emergency contact, agreement history, communication log (V2).

Forms: add lodger, edit lodger, record bond received, record move-out (triggers former status + bond return tracking).

---

### 4.4 Bond Float Tracker

Summary panel — can live on the Dashboard or in the Financial tab:

- **Total bonds held:** AUD sum of all current lodger bonds where bond_returned_date is null
- **Bonds pending receipt:** lodgers with no bond_received_date
- **Bonds due for return:** lodgers with expected_move_out within 30 days
- **Net float (90-day outlook):** bonds held minus bonds due for return within 90 days

This is the key working capital metric. At scale it becomes a material number.

---

### 4.5 Maintenance Tracker

List view filterable by property and status. Create job from any screen (quick add or property detail).

Job form: property, room (optional), title, description, priority (low / medium / high / urgent), contractor (contact picker).

Status flow: Open → In Progress → Completed. Completion records actual cost and completion date.

Notes field per job for updates (append-style, not replace). Each note shows timestamp and user.

Mobile-optimised: Erin can photograph and log a job on-site from her phone. Receipt / photo upload on each job.

---

### 4.6 Cleaning Schedule

List view or simple calendar, filterable by property.

Create clean: property, date, type (routine / end-of-tenancy / pre-move-in), assigned to, notes.

Recurring cleans: set frequency (weekly / fortnightly) per property — generates future entries automatically up to 8 weeks ahead.

Mark complete button. Status: scheduled / completed / skipped.

Triggered automatically on end-of-tenancy clean when a lodger move-out is recorded.

---

### 4.7 Xero Financial Panel

Xero OAuth 2.0 connection managed in Settings (one-time setup; tokens stored encrypted in Supabase).

**Read (MVP):**
- P&L by tracking category (per property) for a selected date range
- Revenue and expense lines per property
- Summary table: income vs expenses vs net per property
- Portfolio totals

**Write (MVP):**
- Create draft expense / bill in Xero from within the app (from the expense log)

Note: the Xero API returns only the top 5 accounts per category — add a UI footnote pointing to Xero for the full breakdown. Tracking category IDs need to be mapped to property IDs in Settings on first use — this is a one-time config step Brenna can do.

Chart: monthly revenue and margin trend per property and portfolio (Recharts, 12-month rolling).

---

### 4.8 Expense and Receipt Manager

Log an expense: amount, date, property, category (dropdown matching Xero chart of accounts), description, receipt upload (JPEG / PNG / PDF, max 10MB).

File stored in Supabase Storage (`receipts/` bucket, path: `{property_id}/{YYYY-MM}/{filename}`).

**HubDoc forwarding:** On save, a Supabase Edge Function emails the receipt to the Casae HubDoc intake address. Subject line format: `[Property] | [Category] | $[Amount] | [Date]`. Body includes description. Attachment is the receipt file. Toggle visible per expense (on by default, can be disabled). `hubdoc_forwarded` and timestamp recorded in the `expenses` table.

**Xero push:** "Send to Xero" button on each expense — creates a draft receipt/bill in Xero with the property tracking category pre-filled and the file attached.

**Fitout items** are a separate but related form under each property — log item, cost, category, receipt. Shows cumulative fitout spend and payback period against current weekly margin.

---

## 5. Feature Spec — V2 and Creative Additions

### 5.1 Property Acquisition Pipeline

Kanban board or table view. Stages: Prospect → Viewing Booked → Viewed → Proposal Sent → Negotiating → Secured → Dead.

Each card / row shows: address, suburb, estimated rooms, projected weekly margin, source, assigned to.

Suburb filter is important: Innaloo, Woodlands, Doubleview, Scarborough, Stirling, Osborne Park are the target clusters. Show a suburb heatmap if portfolio grows.

Progress bar toward the 20-property goal visible at portfolio level (currently 5 of 20).

Kaylin updates stage from her phone after calls and viewings. Luke can add notes after viewings.

Projected margin auto-calculates from estimated head lease and room income inputs — shows the key underwriting metric before any deeper analysis.

---

### 5.2 Fitout ROI Tracker

Per property tab showing all fitout items with cost and purchase date.

Summary: total fitout cost, weekly margin, **payback period in weeks** (fitout total ÷ weekly margin). This is the primary investment metric for the head-lease model.

Alert when payback extends: if a room goes vacant, the tracker recalculates payback at current margin and shows the extension.

Portfolio view: all 5 properties ranked by payback period. Barnes St will always win.

---

### 5.3 Lodger Placement Funnel

Connects to Room vacancy. When a lodger is moved to "former" status, a placement record is auto-created for that room.

Track: enquirer name, source (Flatmates / Facebook / referral / direct), enquiry date, stage, viewing date, outcome.

Kaylin's primary workflow screen. Shows her open enquiries and the age of each one.

Conversion metrics by source: which channel closes fastest? Builds over time as data accumulates.

Daily cost banner on each vacancy: "TH5 Room 2 — 4 days vacant — $274 foregone income." Connects back to the vacancy cost ticker on the dashboard.

---

### 5.4 Agent and Landlord CRM

Contact directory with type filter: landlord / agent / contractor / other.

For landlords and agents: last contact date, properties linked, notes history (append-style log).

For contractors: trade type, preferred (boolean), job count, average completion time.

Pre-seeded contacts (see seed data section below).

Outreach log for acquisition contacts: every call or email Kaylin makes to a prospective landlord is logged against the contact. Links to property prospect record.

---

### 5.5 Routine Inspection Tracker

Schedule inspections per property. Checklist per room (walls, carpet, appliances, fixtures, cleanliness).

Condition rating: good / fair / poor per item and overall.

Photo upload per item — stored in Supabase Storage.

Flag-to-job: flagging a checklist item auto-creates a maintenance job with pre-filled property and description.

Inspection history per property viewable in the property detail tab.

---

### 5.6 Document Storage

Per-property document library organised to mirror the existing SharePoint structure:

- Head Lease Agreement (PDF, with expiry date tracked)
- Lodging Agreements (per lodger)
- Condition Reports (linked to inspections)
- Bond Lodgements
- Insurance
- BAS Lodgements
- Other

Documents uploaded to Supabase Storage. Documents with expiry dates (leases, insurance) show a warning at 90 days and 30 days.

All files currently in SharePoint (`Accounts/Head Lease Agreements/`, `Accounts/Lodging Agreements/`) can be migrated to the app's document store as a one-off import task.

---

### 5.7 Smart Lock Management Panel

Per-property lock status (installed / not installed).

Access code management: assign codes to lodgers (permanent), contractors (temporary with expiry), cleaners (recurring schedule window).

Scheduled access: time-bounded codes for contractor visits. Sends code by SMS/email (via Resend).

Access log if lock brand API supports it — depends on which brand is standardised.

This panel becomes materially more useful when smart locks are retrofitted to existing properties and Kaylin is managing remote check-ins from Johannesburg.

---

### 5.8 Tenant Communications

Templates: rent reminder, move-in instructions, maintenance update, move-out checklist, vacancy follow-up.

Send to individual lodger or all lodgers at a property.

Communication log: every send recorded against the lodger record with timestamp and message body.

Channel: email via Resend. SMS via Twilio (add later if needed).

---

### 5.9 Weekly Margin Snapshot (creative addition)

Auto-generated every Monday (Supabase cron or on-demand). Based on app data, not Xero — shows the model vs actuals gap.

- Expected weekly income: sum of occupied room rents
- Head lease costs: sum of all head leases
- Expected margin: the difference
- Full occupancy potential: what the margin would be if every room were occupied
- Vacancy cost this week: delta between full occupancy and current

Distinct from the Xero panel (which shows accounting actuals). This shows operational performance in real time.

---

### 5.10 Lease Event Calendar

Unified calendar view across the portfolio:

- Head lease renewal / expiry dates (by property)
- Lodger expected move-outs
- Scheduled inspections
- Cleans
- Maintenance job due dates
- Bond return deadlines

Single view for planning. Filter by property or event type. Exportable to iCal for personal calendar sync.

---

### 5.11 Automated Reminders (Supabase cron)

- Rent due reminders — configurable per lodger (weekly, day before due date)
- Head lease renewal — 90 days and 30 days before expiry
- Bond return due — when lodger move-out recorded, reminder at 7 days
- Cleaning scheduled today — morning alert to assigned cleaner
- Maintenance job stale — open jobs with no update after 7 days flag to Luke/Erin
- Upcoming vacancy — 30-day warning on expected move-outs

---

## 6. Seed Data

The following data should be pre-loaded at database initialisation via a seed script.

### Properties

| id (ref) | Display Name | Address | Head Lease/wk | Status |
|---|---|---|---|---|
| `scarborough` | Scarborough | 332D Scarborough Beach Rd, Scarborough WA | $950 | active |
| `th8` | TH8 Oak Lane | 8/6 Oak Lane, West Perth WA | $1,260 | active |
| `th1` | TH1 Oak Lane | 1/6 Oak Lane, West Perth WA | $1,365 | active |
| `barnes` | Barnes St | 45 Barnes Street, Innaloo WA | $850 | active |
| `th5` | TH5 Oak Lane | 5/6 Oak Lane, West Perth WA | $1,265 | active |

### Rooms

**332D Scarborough Beach Rd**

| Room Name | Rent/wk | Couple | Ensuite | Size |
|---|---|---|---|---|
| Room 1 | $450 | No | No | standard |
| Room 2 | $400 | No | No | standard |
| Room 3 | $400 | No | No | standard |

**8/6 Oak Lane (TH8)**

| Room Name | Rent/wk | Couple | Ensuite | Size |
|---|---|---|---|---|
| Room 1 | $525 | Yes | No | standard |
| Room 2 | $470 | Yes | No | standard |
| Room 3 | $360 | No | No | standard |
| Room 4 | $180 | No | No | small |

**1/6 Oak Lane (TH1)**

| Room Name | Rent/wk | Couple | Ensuite | Size |
|---|---|---|---|---|
| Room 1 | $500 | No | No | standard |
| Room 2 | $380 | No | No | standard |
| Room 3 | $350 | No | No | standard |
| Room 4 | $500 | No | No | standard |

**45 Barnes Street**

| Room Name | Rent/wk | Couple | Ensuite | Size |
|---|---|---|---|---|
| Room 1 | $550 | No | No | standard |
| Room 2 | $500 | No | No | standard |
| Room 3 | $300 | No | No | standard |

**5/6 Oak Lane (TH5)**

| Room Name | Rent/wk | Couple | Ensuite | Size |
|---|---|---|---|---|
| Room 1 | $525 | Yes | Yes | standard |
| Room 2 | $480 | No | No | standard |
| Room 3 | $380 | No | No | standard |
| Room 4 | $200 | No | No | small |

### Current Lodgers

Sourced from lodging agreements in SharePoint (`Accounts/Lodging Agreements/`). Room-level assignments below are confirmed where agreement filenames specified room numbers; marked `[verify]` where room number was inferred.

**332D Scarborough Beach Road**
- Joseph Rea — Room 1 [verify]
- Matthew Jackson — Room 2 [verify]
- Zach Doherty — Room 3 [verify]

**8/6 Oak Lane (TH8)**
- Claudia [surname on agreement] & Lewis [surname on agreement] — Room 1 (couple, $525) [verify]
- Bethan Din & Elliott Clawson — Room 2 (couple, $470) [verify]
- Aaron Warren — Room 3 ($360) [verify]
- Gavin O'Sullivan — Room 4 ($180 small) [verify]

**1/6 Oak Lane (TH1)**
- Monika Dabrowska & Ryan Keyte — Room 1 (couple, $500)
- Mia [surname unknown] — Room 2 ($380)
- Holly Taylor — Room 3 ($350)
- Loick Lesire & Adrien Di Rienzo — Room 4 ($500) [agreement file referenced U1 but confirmed in Room 4 by Luke]

**45 Barnes Street**
- VACANT / INCOMING — Room 1 ($550) — Brooke [surname unknown] moving in 20 June 2026 (seed as status: pending, move_in_date: 2026-06-20, weekly_rent: $550)
- Kathryn O'Meara & Padraigh Bergin — Room 2 (couple, $500) [current]
- Sean Bryce-Rogers — Room 3 ($300) [current; formerly Ben Gallacher]
- Former: Stephanie O'Driscoll & Ronan O'Connell — Room 2 (moved out, bond returned)

**5/6 Oak Lane (TH5)**
- Rowan James & Ava Flinn — Room 1 (couple, ensuite, $525)
- Mithila Nadeesha & Dinusha Madushanka — Room 2 ($480) [lodging agreement file mislabeled as Room 3; actual room is Room 2]
- William Cole — Room 3 ($380) [current lodger; earlier agreement file predates Mithila & Dinusha; confirm still current with Erin]
- Leander Ziegler — Room 4 ($200 small)

### Contacts (pre-seed)

| Name | Type | Company | Notes |
|---|---|---|---|
| Joe Nardizzi | Landlord | — | Oak Lane properties, held in super, managed via Choice Estates |
| Choice Estates | Agent | Choice Estates | Manages Oak Lane head leases; clause 2.33(b) note on record |
| Stephanie Gadenne | Agent | Jones & Co | Senior PM, warm contact |
| Lucas | Insurance Broker | Lockton / Honan Insurance | — |
| Cassandra | Other | Koala Self Storage, Osborne Park | Free trailer/truck hire on request |
| Burnsy | Other | CBA | Growth facility contact |

### Users

| Name | Email | Role |
|---|---|---|
| Luke Hanner | luke.hanner@crosspondcapital.com | admin |
| Erin Viljoen | erintviljoen@gmail.com | admin |
| Brenna | info@cloudboundbookkeeping.com.au | staff |
| Kaylin | kaylinviljoen2@gmail.com | staff |

---

## 7. Xero Integration Spec

### OAuth Flow
1. "Connect Xero" in Settings triggers OAuth 2.0 authorisation redirect
2. Netlify callback function exchanges auth code for access + refresh tokens
3. Tokens stored encrypted in Supabase table `xero_credentials` (org-level, not per user)
4. Netlify Function handles token refresh automatically on 401

### Read Endpoints (MVP)
- `GET /api.xro/2.0/Reports/ProfitAndLoss` with TrackingOptionID per property
- `GET /api.xro/2.0/Accounts` for chart of accounts (populates expense category dropdown)
- `GET /api.xro/2.0/TrackingCategories` to get property tracking category IDs (one-time config)

### Write Endpoints (MVP)
- `POST /api.xro/2.0/Receipts` — create expense receipt from the app
- `POST /api.xro/2.0/Attachments/{receiptId}` — attach receipt file

### Config Step
On first Xero connection, Settings shows a mapping screen: match each Xero tracking category name to the corresponding property record in the app. Brenna does this once. IDs stored in a `xero_config` table.

### Known Limitation
Xero P&L endpoint returns only the top 5 accounts per category. The financial panel shows a note: "Showing top accounts. Full detail in Xero." with a direct link to the Xero report.

---

## 8. HubDoc Integration Spec

No HubDoc API needed. Email-based only.

**Flow:**
1. Expense saved with receipt file
2. Supabase Edge Function fires on `INSERT` to `expenses` table (or triggered by explicit button click if preferred)
3. Function reads file from Supabase Storage, composes email:
   - **To:** HubDoc intake address (env variable: `HUBDOC_EMAIL`) — two addresses on record: `casae.c3c4@app.hubdoc.com` and `casaeliving.d55c@app.hubdoc.com`; confirm which is the active intake address before first use
   - **Subject:** `[Property] | [Category] | $[Amount] | [Date]`
   - **Body:** description, property, category, logged by
   - **Attachment:** receipt file
4. Email sent via Resend API
5. `expenses.hubdoc_forwarded` set to `true` with timestamp

**Toggle:** per-expense toggle visible in the UI, on by default. Can be disabled for internal-only expense records (e.g. fitout items where receipt has already been sent separately).

---

## 9. UI and Brand

Apply the Casae brand system:

```css
/* Tailwind theme extension in tailwind.config.ts */
colors: {
  navy:  '#2C3E4A',   /* primary, sidebar, headings */
  stone: '#C8C4B0',   /* borders, muted backgrounds */
  sage:  '#5C7A52',   /* occupied / positive / success */
  cream: '#F5F3EE',   /* page background, card backgrounds */
}
```

Typography via Google Fonts:
- `Cormorant Garamond` — all headings (h1, h2, h3), large display numbers
- `Jost` — body text, labels, table cells, form inputs

**Layout:**
- Desktop: fixed Navy sidebar (200px), main content area on Cream
- Mobile: bottom tab bar (4 icons: Dashboard, Properties, Maintenance, More)
- Cards: white background, 1px Stone border, 4px radius
- Occupied status: Sage dot / fill
- Vacant / urgent: standard red (Tailwind `red-500`)
- Amber warning for upcoming events (Tailwind `amber-500`)

**Data tables:** clean, no zebra striping, Stone dividers between rows, compact padding on mobile.

**Signature element:** Large weekly margin number on the dashboard — Cormorant Garamond, 72px, Navy, with a Sage rule beneath. The product should feel like Casae: considered, residential, not SaaS.

---

## 10. Build Sequence for Claude Code

Each session has a single focus area. Start each session with: current Supabase schema, brand tokens, shadcn/ui component list, and the specific feature to build. Keep sessions to one domain to avoid context overflow.

| Session | Focus | Deliverable |
|---|---|---|
| 1 | Foundation | Supabase project, schema migrations, seed script, Netlify deploy, Supabase Auth (email/password, 4 users), RLS policies |
| 2 | Property + Room views | Property dashboard, room grid, property detail view — static reads from Supabase |
| 3 | Lodger directory | Lodger table, add/edit forms, couple rooms, bond status, move-out flow |
| 4 | Maintenance + Cleaning | Job create/update, status flow, contractor picker, clean schedule, recurring cleans |
| 5 | Dashboard + Metrics | Home dashboard, occupancy stats, vacancy cost ticker, bond float, upcoming events |
| 6 | Xero integration | OAuth flow, financial panel, P&L read, tracking category mapping, expense push |
| 7 | Expense + Receipt manager | File upload to Supabase Storage, expense log, HubDoc Edge Function |
| 8 | Property Acquisition Pipeline | Prospect kanban, stage transitions, projected margin calculator, 20-property progress bar |
| 9 | Fitout ROI tracker | Per-property fitout log, payback period calculator, portfolio ranking view |
| 10+ | V2 features | Placement funnel, CRM, inspections, document storage, smart locks, comms, reminders |

**Recommended Claude Code context pattern for each session:**
```
Context: [paste current schema], [paste brand tokens], [paste shadcn/ui component names]
Task: Build [feature name]
Rules: Tailwind + shadcn/ui only. No inline styles. All queries via TanStack Query. 
       Supabase client via singleton. Mobile-first layout.
```

---

## 11. Open Items Before Starting Build

1. **Full surnames for Claudia and Lewis (TH8)** — agreement file name truncated; confirm with Erin
2. **TH8 and Scarborough room number assignments** — agreement files didn't include room numbers; 4 lodgers at TH8 and 3 at Scarborough need room-level matching before seed deploy
3. **Confirm active HubDoc intake address** — two on record: `casae.c3c4@app.hubdoc.com` and `casaeliving.d55c@app.hubdoc.com`; send a test email to verify which one processes correctly before going live
4. **Confirm Xero tracking category names** — so the config mapping screen uses exact Xero labels (Brenna to confirm)
5. **Smart lock brand decision** — determines API available for V2 lock management panel
6. **Brooke's surname at Barnes St Room 1** — moving in 20 June 2026
7. **Mia's surname at TH1 Room 2**
8. **TH5 Room 2 agreement mislabeling** — Mithila & Dinusha's lodging agreement is filed as Room 3; note for Document Storage that the PDF filename does not match the actual room assignment
9. **Review `Casae Living - Rent & Utilities.xlsx`** (SharePoint: Accounts) and **`Casae Workbook.xlsx`** (SharePoint: Planning) — may contain updated room rents or additional operational data worth pulling into seed

---

## 12. SharePoint Document Import Plan (V2)

The following SharePoint folder structure should inform the Document Storage feature. When built, a one-off migration can pull existing files into Supabase Storage and tag them to the correct property and document type.

```
Accounts/
  Head Lease Agreements/     → document_type: head_lease
    Lease - 332D Scarborough Beach Road.pdf
    Lease - Unit 1, 6 Oak Lane.pdf
    Lease - 45 Barnes Street.pdf
    Bond Lodgement - Unit 1, 6 Oak Lane.pdf
    Bond Lodgement - Unit 8, 6 Oak Lane.pdf
    Bond Lodgement - 332D Scarborough Beach Road.pdf
  Lodging Agreements/        → document_type: lodging_agreement (per lodger)
    332D Scarborough Beach Road/
    8, 6 Oak Lane/
    1, 6 Oak Lane/
    45 Barnes Street/
    5, 6 Oak Lane/
  Management Reports/        → document_type: management_report (monthly)
  BAS Lodgements/            → document_type: bas_lodgement
  Insurance/                 → document_type: insurance
```

The monthly management reports (prepared by Cloudbound) are a rich historical record: March, April, and May 2026 reports are already in SharePoint. The financial panel in the app could eventually surface these alongside live Xero data.

---

*Spec prepared June 2026. Cross-reference against current Xero, SharePoint, and Supabase state before starting each build session. Seed data lodger records marked [verify] should be confirmed with Erin before the first production deploy.*
