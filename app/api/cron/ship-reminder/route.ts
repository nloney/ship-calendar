import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-server';
import { todayIso } from '@/lib/dates';

// Vercel Cron calls this daily. Protected by CRON_SECRET so nobody else can trigger it.
export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const db = createAdminClient();
  const today = todayIso();

  const { data: due, error } = await db
    .from('events')
    .select('*')
    .eq('ship_date', today)
    .eq('ship_notified', false);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!due || due.length === 0) return NextResponse.json({ sent: 0 });

  const lines = due.map(e => {
    const verb = e.is_local ? 'PACK' : 'SHIP';
    const context = e.is_local
      ? `pack for the ${e.event_date} local event`
      : `ships today for the ${e.event_date} event`;
    return `• *${e.title}* — ${verb}: ${context}.` + (e.notes ? `\n   _${e.notes}_` : '');
  });
  const shipCount = due.filter(e => !e.is_local).length;
  const packCount = due.filter(e => e.is_local).length;
  const parts = [];
  if (shipCount) parts.push(`${shipCount} to ship`);
  if (packCount) parts.push(`${packCount} to pack`);
  const text = `📦 *Reminder — ${today}*\n${parts.join(' · ')} today:\n${lines.join('\n')}`;

  const webhook = process.env.SLACK_WEBHOOK_URL;
  if (webhook) {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
  }

  // mark as notified so we don't send again tomorrow if anything reruns
  await db.from('events').update({ ship_notified: true }).in('id', due.map(e => e.id));

  return NextResponse.json({ sent: due.length });
}
