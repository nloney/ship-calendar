import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase-server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = ['pending', 'packed', 'shipped'];

// The board has no login, so status changes need the shared BOARD_PIN.
// Only the status column is writable here, and every change is audited.
export async function POST(req: Request) {
  const expected = process.env.BOARD_PIN;
  if (!expected) return NextResponse.json({ error: 'Board PIN is not configured.' }, { status: 503 });
  const b = await req.json().catch(() => null);
  if (!b || typeof b.pin !== 'string' || !UUID.test(b.id) || !STATUSES.includes(b.status)) {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }
  const a = Buffer.from(b.pin), e = Buffer.from(expected);
  if (a.length !== e.length || !timingSafeEqual(a, e)) {
    await new Promise(r => setTimeout(r, 1000)); // slows PIN guessing
    return NextResponse.json({ error: 'Wrong PIN.' }, { status: 401 });
  }
  const db = createAdminClient();
  const { data: before } = await db.from('events').select('id,title,status').eq('id', b.id).single();
  if (!before) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (before.status === b.status) return NextResponse.json({ ok: true });
  const { error } = await db.from('events')
    .update({ status: b.status, status_at: new Date().toISOString(), status_by: 'board' })
    .eq('id', b.id);
  if (error) return NextResponse.json({ error: 'could not save' }, { status: 500 });
  await db.from('event_audit').insert({
    event_id: before.id, event_title: before.title, action: 'status', changed_by: 'board (PIN)',
    changes: { status: { from: before.status, to: b.status } },
  });
  return NextResponse.json({ ok: true });
}
