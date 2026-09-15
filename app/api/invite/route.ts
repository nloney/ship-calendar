import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase-server';

// Sends a Supabase invite email. The invitee clicks the link and sets their
// own password — we never see or store it. Only signed-in users may invite.
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { email } = await req.json();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL;
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${site}/set-password`,
  });

  if (error) {
    // Most common: user already exists.
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
