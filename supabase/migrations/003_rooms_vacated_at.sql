-- Track when a room became vacant so the vacancy cost ticker accrues from the
-- real date rather than inferring it from former lodgers' move-out dates.
-- Set by the move-out flow; cleared when a lodger is placed in the room.

alter table rooms add column vacated_at timestamptz;
