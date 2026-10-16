import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

// Read-only change history. ?event_id=<uuid> for one event, otherwise the latest 100 changes.
export async function GET(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const id = new URL(req.url).searchParams.get('event_id');
  let q = supabase.from('event_audit').select('*').order('created_at', { ascending: false }).limit(100);
  if (id) q = q.eq('event_id', id);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
