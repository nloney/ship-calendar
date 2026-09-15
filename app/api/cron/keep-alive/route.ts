import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-server';

// Tiny query that runs on a schedule so Supabase never sees "7 days of
// inactivity" and pauses the free-tier project. Keeps the TV board alive.
export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const db = createAdminClient();
  await db.from('events').select('id').limit(1);
  return NextResponse.json({ ok: true, pinged: new Date().toISOString() });
}
