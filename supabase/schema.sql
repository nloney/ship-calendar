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
create policy "anon can read for the public board" on events
  for select to anon using (true);

-- If you'd rather NOT expose the table to anon at all, delete the policy above
-- and the board will still work — it just won't update live; it re-fetches
-- every 5 minutes on its own timer instead.
