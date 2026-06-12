-- Casae Living — Seed data (Session 2)
-- Source: Planning Spec v1.0 §6.
--
-- Conventions / assumptions (flagged where data was not in the spec):
--   * Rooms whose lodger-room assignment is marked [verify] in the spec are
--     seeded with a lodger named "TBC" so the room shows occupied; the likely
--     name from SharePoint agreements is kept in the lodger notes for Erin
--     to confirm.
--   * bond_amount is seeded at 2x weekly rent (standard practice) and
--     bond_received_date at 2026-03-01 as a PLACEHOLDER — confirm actual
--     amounts and dates before relying on the bond float figure.
--   * move_in_date / expected_move_out are left null where the spec gave none.
--   * Head lease start/end dates were not in the spec — left null.
--
-- Re-runnable: wipes all operational data first.

begin;

truncate table
  lodgers, maintenance_jobs, cleans, expenses, fitout_items,
  property_prospects, rooms, properties, contacts
restart identity cascade;

-- ---------------------------------------------------------------------------
-- Contacts (pre-seed, Spec §6 + Session 8)
-- ---------------------------------------------------------------------------
insert into contacts (id, type, first_name, last_name, company_name, trade_type, notes) values
  ('dddddddd-0000-0000-0000-000000000001', 'landlord',  'Joe',       'Nardizzi', null,                                null, 'Oak Lane properties held in super, managed via Choice Estates'),
  ('dddddddd-0000-0000-0000-000000000002', 'agent',     null,        null,       'Choice Estates',                    null, 'Manages Oak Lane head leases; clause 2.33(b) note on record'),
  ('dddddddd-0000-0000-0000-000000000003', 'agent',     'Stephanie', 'Gadenne',  'Jones & Co',                        null, 'Senior PM, warm contact'),
  ('dddddddd-0000-0000-0000-000000000004', 'other',     'Lucas',     null,       'Lockton / Honan Insurance',         null, 'Insurance broker'),
  ('dddddddd-0000-0000-0000-000000000005', 'other',     'Cassandra', null,       'Koala Self Storage, Osborne Park',  null, 'Free trailer/truck hire on request'),
  ('dddddddd-0000-0000-0000-000000000006', 'other',     'Burnsy',    null,       'CBA',                               null, 'Growth facility contact');

-- ---------------------------------------------------------------------------
-- Properties (Oak Lane linked to Joe Nardizzi / Choice Estates)
-- ---------------------------------------------------------------------------
insert into properties (id, display_name, address, suburb, weekly_head_lease, landlord_contact_id, agent_contact_id, status) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Scarborough',  '332D Scarborough Beach Rd, Scarborough WA', 'Scarborough', 950,  null, null, 'active'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'TH8 Oak Lane', '8/6 Oak Lane, West Perth WA',               'West Perth',  1260, 'dddddddd-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000002', 'active'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'TH1 Oak Lane', '1/6 Oak Lane, West Perth WA',               'West Perth',  1365, 'dddddddd-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000002', 'active'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'Barnes St',    '45 Barnes Street, Innaloo WA',              'Innaloo',     850,  null, null, 'active'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'TH5 Oak Lane', '5/6 Oak Lane, West Perth WA',               'West Perth',  1265, 'dddddddd-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000002', 'active');

-- ---------------------------------------------------------------------------
-- Rooms (18 total; all occupied except Barnes St Room 1)
-- ---------------------------------------------------------------------------
insert into rooms (id, property_id, room_name, weekly_rent, is_couple_room, is_ensuite, size_category, status) values
  -- Scarborough (332D Scarborough Beach Rd)
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Room 1', 450, false, false, 'standard', 'occupied'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Room 2', 400, false, false, 'standard', 'occupied'),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'Room 3', 400, false, false, 'standard', 'occupied'),
  -- TH8 Oak Lane (8/6 Oak Lane)
  ('bbbbbbbb-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000002', 'Room 1', 525, true,  false, 'standard', 'occupied'),
  ('bbbbbbbb-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000002', 'Room 2', 470, true,  false, 'standard', 'occupied'),
  ('bbbbbbbb-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000002', 'Room 3', 360, false, false, 'standard', 'occupied'),
  ('bbbbbbbb-0000-0000-0000-000000000007', 'aaaaaaaa-0000-0000-0000-000000000002', 'Room 4', 180, false, false, 'small',    'occupied'),
  -- TH1 Oak Lane (1/6 Oak Lane)
  ('bbbbbbbb-0000-0000-0000-000000000008', 'aaaaaaaa-0000-0000-0000-000000000003', 'Room 1', 500, false, false, 'standard', 'occupied'),
  ('bbbbbbbb-0000-0000-0000-000000000009', 'aaaaaaaa-0000-0000-0000-000000000003', 'Room 2', 380, false, false, 'standard', 'occupied'),
  ('bbbbbbbb-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000003', 'Room 3', 350, false, false, 'standard', 'occupied'),
  ('bbbbbbbb-0000-0000-0000-000000000011', 'aaaaaaaa-0000-0000-0000-000000000003', 'Room 4', 500, false, false, 'standard', 'occupied'),
  -- Barnes St (45 Barnes Street)
  ('bbbbbbbb-0000-0000-0000-000000000012', 'aaaaaaaa-0000-0000-0000-000000000004', 'Room 1', 550, false, false, 'standard', 'vacant'),
  ('bbbbbbbb-0000-0000-0000-000000000013', 'aaaaaaaa-0000-0000-0000-000000000004', 'Room 2', 500, false, false, 'standard', 'occupied'),
  ('bbbbbbbb-0000-0000-0000-000000000014', 'aaaaaaaa-0000-0000-0000-000000000004', 'Room 3', 300, false, false, 'standard', 'occupied'),
  -- TH5 Oak Lane (5/6 Oak Lane)
  ('bbbbbbbb-0000-0000-0000-000000000015', 'aaaaaaaa-0000-0000-0000-000000000005', 'Room 1', 525, true,  true,  'standard', 'occupied'),
  ('bbbbbbbb-0000-0000-0000-000000000016', 'aaaaaaaa-0000-0000-0000-000000000005', 'Room 2', 480, false, false, 'standard', 'occupied'),
  ('bbbbbbbb-0000-0000-0000-000000000017', 'aaaaaaaa-0000-0000-0000-000000000005', 'Room 3', 380, false, false, 'standard', 'occupied'),
  ('bbbbbbbb-0000-0000-0000-000000000018', 'aaaaaaaa-0000-0000-0000-000000000005', 'Room 4', 200, false, false, 'small',    'occupied');

-- ---------------------------------------------------------------------------
-- Lodgers
-- bond_amount = 2x weekly rent, bond_received_date = 2026-03-01 (placeholders)
-- ---------------------------------------------------------------------------
insert into lodgers (id, first_name, last_name, room_id, is_couple, partner_name, move_in_date, bond_amount, bond_received_date, bond_returned_date, lodging_agreement_signed, status, notes) values
  -- Scarborough — room assignments [verify]
  ('cccccccc-0000-0000-0000-000000000001', 'TBC', null, 'bbbbbbbb-0000-0000-0000-000000000001', false, null, null,  900, '2026-03-01', null, true, 'current', 'Room assignment unverified — likely Joseph Rea. Confirm with Erin.'),
  ('cccccccc-0000-0000-0000-000000000002', 'TBC', null, 'bbbbbbbb-0000-0000-0000-000000000002', false, null, null,  800, '2026-03-01', null, true, 'current', 'Room assignment unverified — likely Matthew Jackson. Confirm with Erin.'),
  ('cccccccc-0000-0000-0000-000000000003', 'TBC', null, 'bbbbbbbb-0000-0000-0000-000000000003', false, null, null,  800, '2026-03-01', null, true, 'current', 'Room assignment unverified — likely Zach Doherty. Confirm with Erin.'),
  -- TH8 Oak Lane — room assignments [verify]
  ('cccccccc-0000-0000-0000-000000000004', 'TBC', null, 'bbbbbbbb-0000-0000-0000-000000000004', true,  'TBC', null, 1050, '2026-03-01', null, true, 'current', 'Room assignment unverified — likely Claudia & Lewis (couple; surnames truncated on agreement file). Confirm with Erin.'),
  ('cccccccc-0000-0000-0000-000000000005', 'TBC', null, 'bbbbbbbb-0000-0000-0000-000000000005', true,  'TBC', null,  940, '2026-03-01', null, true, 'current', 'Room assignment unverified — likely Bethan Din & Elliott Clawson (couple). Confirm with Erin.'),
  ('cccccccc-0000-0000-0000-000000000006', 'TBC', null, 'bbbbbbbb-0000-0000-0000-000000000006', false, null, null,  720, '2026-03-01', null, true, 'current', 'Room assignment unverified — likely Aaron Warren. Confirm with Erin.'),
  ('cccccccc-0000-0000-0000-000000000007', 'TBC', null, 'bbbbbbbb-0000-0000-0000-000000000007', false, null, null,  360, '2026-03-01', null, true, 'current', 'Room assignment unverified — likely Gavin O''Sullivan. Confirm with Erin.'),
  -- TH1 Oak Lane — confirmed
  ('cccccccc-0000-0000-0000-000000000008', 'Monika', 'Dabrowska',     'bbbbbbbb-0000-0000-0000-000000000008', true,  'Ryan Keyte',        null, 1000, '2026-03-01', null, true, 'current', null),
  ('cccccccc-0000-0000-0000-000000000009', 'Mia',    null,            'bbbbbbbb-0000-0000-0000-000000000009', false, null,                null,  760, '2026-03-01', null, true, 'current', 'Surname unknown — confirm.'),
  ('cccccccc-0000-0000-0000-000000000010', 'Holly',  'Taylor',        'bbbbbbbb-0000-0000-0000-000000000010', false, null,                null,  700, '2026-03-01', null, true, 'current', null),
  ('cccccccc-0000-0000-0000-000000000011', 'Loick',  'Lesire',        'bbbbbbbb-0000-0000-0000-000000000011', true,  'Adrien Di Rienzo',  null, 1000, '2026-03-01', null, true, 'current', 'Agreement file referenced U1 but confirmed in Room 4 by Luke.'),
  -- Barnes St
  ('cccccccc-0000-0000-0000-000000000012', 'Brooke',  null,           'bbbbbbbb-0000-0000-0000-000000000012', false, null,                '2026-06-20', 1100, null,         null, false, 'pending', 'Surname unknown — moving in 20 June 2026, Room 1.'),
  ('cccccccc-0000-0000-0000-000000000013', 'Kathryn', 'O''Meara',     'bbbbbbbb-0000-0000-0000-000000000013', true,  'Padraigh Bergin',   null, 1000, '2026-03-01', null, true, 'current', null),
  ('cccccccc-0000-0000-0000-000000000014', 'Sean',    'Bryce-Rogers', 'bbbbbbbb-0000-0000-0000-000000000014', false, null,                null,  600, '2026-03-01', null, true, 'current', 'Room formerly occupied by Ben Gallacher.'),
  ('cccccccc-0000-0000-0000-000000000015', 'Stephanie', 'O''Driscoll','bbbbbbbb-0000-0000-0000-000000000013', true,  'Ronan O''Connell',  null, 1000, '2025-09-01', '2026-03-10', true, 'former', 'Moved out of Room 2; bond returned.'),
  -- TH5 Oak Lane — confirmed
  ('cccccccc-0000-0000-0000-000000000016', 'Rowan',   'James',        'bbbbbbbb-0000-0000-0000-000000000015', true,  'Ava Flinn',         null, 1050, '2026-03-01', null, true, 'current', null),
  ('cccccccc-0000-0000-0000-000000000017', 'Mithila', 'Nadeesha',     'bbbbbbbb-0000-0000-0000-000000000016', true,  'Dinusha Madushanka', null, 960, '2026-03-01', null, true, 'current', 'Lodging agreement file mislabeled as Room 3; actual room is Room 2.'),
  ('cccccccc-0000-0000-0000-000000000018', 'William', 'Cole',         'bbbbbbbb-0000-0000-0000-000000000017', false, null,                null,  760, '2026-03-01', null, true, 'current', 'Earlier agreement file predates Mithila & Dinusha — confirm still current with Erin.'),
  ('cccccccc-0000-0000-0000-000000000019', 'Leander', 'Ziegler',      'bbbbbbbb-0000-0000-0000-000000000018', false, null,                null,  400, '2026-03-01', null, true, 'current', null);

commit;
