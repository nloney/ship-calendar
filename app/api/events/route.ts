import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase-server';
import { isoAddDays, DEFAULT_LEAD_DAYS } from '@/lib/dates';

const STATUSES = ['pending', 'packed', 'shipped'];
const CARRIERS = ['', 'ups', 'fedex', 'usps', 'dhl'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const COLOR = /^#[0-9a-fA-F]{6}$/;
const FIELDS = ['title', 'event_date', 'ship_date', 'notes', 'color', 'tracking_number', 'carrier', 'is_local', 'packing', 'ship_address', 'status'] as const;

async function requireUser() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

// Validates and trims input; returns an error string or the cleaned fields.
function clean(b: Record<string, unknown>): { error: string } | { row: Record<string, unknown> } {
  const row: Record<string, unknown> = {};
  const str = (k: string, max: number) => {
    if (b[k] === undefined) return null;
    if (typeof b[k] !== 'string' || (b[k] as string).length > max) return `${k} must be text up to ${max} characters`;
    row[k] = (b[k] as string).trim();
    return null;
  };
  for (const [k, max] of [['title', 200], ['notes', 2000], ['tracking_number', 100], ['ship_address', 500]] as const) {
    const err = str(k, max); if (err) return { error: err };
  }
  for (const k of ['event_date', 'ship_date'] as const) {
    if (b[k] === undefined) continue;
    if (typeof b[k] !== 'string' || !DATE.test(b[k] as string)) return { error: `${k} must be YYYY-MM-DD` };
    row[k] = b[k];
  }
  if (b.color !== undefined) {
    if (typeof b.color !== 'string' || !COLOR.test(b.color)) return { error: 'color must be a hex value' };
    row.color = b.color;
  }
  if (b.carrier !== undefined) {
    if (typeof b.carrier !== 'string' || !CARRIERS.includes(b.carrier)) return { error: 'unknown carrier' };
    row.carrier = b.carrier;
  }
  if (b.status !== undefined) {
    if (typeof b.status !== 'string' || !STATUSES.includes(b.status)) return { error: 'unknown status' };
    row.status = b.status;
  }
  if (b.is_local !== undefined) row.is_local = !!b.is_local;
  if (b.packing !== undefined) {
    if (typeof b.packing !== 'object' || b.packing === null || Array.isArray(b.packing) || JSON.stringify(b.packing).length > 10_000) {
      return { error: 'packing is invalid or too large' };
    }
    row.packing = b.packing;
  }
  return { row };
}

// Only changed fields: { field: { from, to } }.
function diff(before: Record<string, unknown>, after: Record<string, unknown>) {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of FIELDS) {
    if (k in after && JSON.stringify(before[k] ?? null) !== JSON.stringify(after[k] ?? null)) {
      out[k] = { from: before[k] ?? null, to: after[k] };
    }
  }
  return out;
}

// Written with the service role so signed-in users can read history but never edit it.
async function audit(eventId: string, title: string, action: string, by: string, changes: unknown) {
  await createAdminClient().from('event_audit').insert({
    event_id: eventId, event_title: title, action, changed_by: by, changes,
  });
}

export async function GET() {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { data, error } = await supabase.from('events').select('*').order('event_date');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== 'object') return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  if (!b.title || !b.event_date) return NextResponse.json({ error: 'title and event_date required' }, { status: 400 });
  const c = clean(b);
  if ('error' in c) return NextResponse.json({ error: c.error }, { status: 400 });
  const row = {
    notes: '', color: '#1a73e8', tracking_number: '', carrier: '', is_local: false,
    packing: {}, ship_address: '', status: 'pending',
    ...c.row,
    ship_date: (c.row.ship_date as string) || isoAddDays(c.row.event_date as string, -DEFAULT_LEAD_DAYS),
    ship_notified: false,
    created_by: user.id,
  };
  const { data, error } = await supabase.from('events').insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await audit(data.id, data.title, 'created', user.email || user.id, { title: data.title, event_date: data.event_date });
  return NextResponse.json(data);
}

export async function PATCH(req: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const b = await req.json().catch(() => null);
  if (!b || typeof b.id !== 'string') return NextResponse.json({ error: 'id required' }, { status: 400 });
  const c = clean(b);
  if ('error' in c) return NextResponse.json({ error: c.error }, { status: 400 });
  const patch = c.row;
  const { data: before } = await supabase.from('events').select('*').eq('id', b.id).single();
  if (!before) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const changes = diff(before, patch);
  if (!Object.keys(changes).length) return NextResponse.json(before);
  // if the ship date changed, allow it to be re-notified
  if (changes.ship_date) patch.ship_notified = false;
  const who = user.email || user.id;
  if (changes.status) { patch.status_at = new Date().toISOString(); patch.status_by = who; }
  const { data, error } = await supabase.from('events').update(patch).eq('id', b.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await audit(data.id, data.title, Object.keys(changes).length === 1 && changes.status ? 'status' : 'updated', who, changes);
  return NextResponse.json(data);
}

export async function DELETE(req: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const b = await req.json().catch(() => null);
  if (!b || typeof b.id !== 'string') return NextResponse.json({ error: 'id required' }, { status: 400 });
  const { data: before } = await supabase.from('events').select('id,title,event_date').eq('id', b.id).single();
  const { error } = await supabase.from('events').delete().eq('id', b.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (before) await audit(before.id, before.title, 'deleted', user.email || user.id, { title: before.title, event_date: before.event_date });
  return NextResponse.json({ ok: true });
}
