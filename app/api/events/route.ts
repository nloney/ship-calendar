import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { isoAddDays, DEFAULT_LEAD_DAYS } from '@/lib/dates';

async function requireUser() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
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
  const b = await req.json();
  if (!b.title || !b.event_date) return NextResponse.json({ error: 'title and event_date required' }, { status: 400 });
  const row = {
    title: b.title,
    event_date: b.event_date,
    ship_date: b.ship_date || isoAddDays(b.event_date, -DEFAULT_LEAD_DAYS),
    notes: b.notes || '',
    color: b.color || '#1a73e8',
    tracking_number: b.tracking_number || '',
    carrier: b.carrier || '',
    is_local: !!b.is_local,
    ship_notified: false,
    created_by: user.id,
  };
  const { data, error } = await supabase.from('events').insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const b = await req.json();
  if (!b.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const patch: Record<string, unknown> = {};
  ['title', 'event_date', 'ship_date', 'notes', 'color', 'tracking_number', 'carrier', 'is_local'].forEach(k => {
    if (b[k] !== undefined) patch[k] = b[k];
  });
  // if the ship date changed, allow it to be re-notified
  if (b.ship_date !== undefined) patch.ship_notified = false;
  const { data, error } = await supabase.from('events').update(patch).eq('id', b.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await req.json();
  const { error } = await supabase.from('events').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
