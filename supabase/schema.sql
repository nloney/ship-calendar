-- Run this in Supabase dashboard > SQL Editor > New query > Run.

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_date date not null,
  ship_date date not null,
  notes text default '',
  color text default '#1a73e8',
  tracking_number text default '',
  carrier text default '',               -- ups | fedex | usps | dhl | '' (other)
  is_local boolean default false,        -- local = pack (not ship); no tracking needed
  ship_notified boolean default false,   -- so cron doesn't send twice
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- Everyone who is signed in shares ONE calendar.
alter table events enable row level security;

create policy "signed-in users can read" on events
  for select using (auth.role() = 'authenticated');

create policy "signed-in users can insert" on events
  for insert with check (auth.role() = 'authenticated');

create policy "signed-in users can update" on events
  for update using (auth.role() = 'authenticated');

create policy "signed-in users can delete" on events
  for delete using (auth.role() = 'authenticated');

-- ---- Public read-only board ----
-- The TV board has no login, so it reads through this view via the anon key.
-- A view keeps the door narrow: read-only, and you control exactly which
-- columns are exposed. (created_by is deliberately omitted.)
create or replace view public_board as
  select id, title, event_date, ship_date, notes, color,
         tracking_number, carrier, is_local
  from events;

-- allow the anonymous role to read the view
grant select on public_board to anon;

-- The TV board also subscribes to live changes. Realtime delivers row changes
-- only for rows the subscriber can SELECT, so give anon a read-only policy on
-- the base table too. This exposes the same columns the view already shows.
-- (removed: see the packing block below, the board reads the view only)

-- If you'd rather NOT expose the table to anon at all, delete the policy above
-- and the board will still work — it just won't update live; it re-fetches
-- every 5 minutes on its own timer instead.

-- ---- Packing list, ship address, status, audit log ----
-- Run this block once on an existing database. Safe to re-run.
alter table events add column if not exists packing jsonb default '{}'::jsonb;
alter table events add column if not exists ship_address text default '';
alter table events add column if not exists status text default 'pending';  -- pending | packed | shipped
alter table events add column if not exists status_at timestamptz;
alter table events add column if not exists status_by text default '';

-- Append-only audit log. Only the server (service role) writes to it; signed-in
-- users can read. No insert/update/delete policy exists, so nobody can alter history.
create table if not exists event_audit (
  id uuid primary key default gen_random_uuid(),
  event_id uuid,                 -- no foreign key: history survives deletes
  event_title text,
  action text not null,          -- created | updated | deleted | status
  changed_by text,
  changes jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
create index if not exists event_audit_event_idx on event_audit (event_id, created_at desc);
alter table event_audit enable row level security;
drop policy if exists "signed-in users can read audit" on event_audit;
create policy "signed-in users can read audit" on event_audit
  for select using (auth.role() = 'authenticated');

-- The board must NOT read the events table directly: it would expose ship_address.
-- Drop the anon policy; the board reads only the view below (view runs as owner).
-- Trade-off: no realtime on the board, it re-fetches every 60 seconds instead.
drop policy if exists "anon can read for the public board" on events;

-- Views can only gain columns at the end. ship_address is deliberately left out.
create or replace view public_board as
  select id, title, event_date, ship_date, notes, color,
         tracking_number, carrier, is_local, packing, status, status_at
  from events;
grant select on public_board to anon;
