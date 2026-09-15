'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-browser';

// Invited users (and password resets) land here from the email link.
// Supabase has already established a session from the link, so we just
// let them set a password.
export default function SetPassword() {
  const supabase = createClient();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setReady(!!data.session);
      if (!data.session) setErr('This link is invalid or has expired. Ask for a new invite.');
    });
  }, [supabase]);

  async function save() {
    setErr('');
    if (pw.length < 8) { setErr('Use at least 8 characters.'); return; }
    if (pw !== pw2) { setErr('The two passwords do not match.'); return; }
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) { setErr(error.message); return; }
    setDone(true);
    setTimeout(() => { location.href = '/'; }, 1200);
  }

  return (
    <div style={{ maxWidth: 360, margin: '80px auto', textAlign: 'center' }}>
      <h1 style={{ fontWeight: 400 }}>Set your password</h1>
      {done ? (
        <p style={{ color: '#33b679' }}>Password set. Taking you to the calendar…</p>
      ) : (
        <>
          <p style={{ color: '#70757a' }}>Your email is your username. Choose a password to finish.</p>
          <input type="password" placeholder="New password" value={pw}
            onChange={e => setPw(e.target.value)} style={inp} disabled={!ready} />
          <input type="password" placeholder="Confirm password" value={pw2}
            onChange={e => setPw2(e.target.value)} style={inp} disabled={!ready} />
          {err && <p style={{ color: '#d93025', fontSize: 13 }}>{err}</p>}
          <button onClick={save} disabled={!ready} style={btn}>Save password</button>
        </>
      )}
    </div>
  );
}

const inp: React.CSSProperties = { width: '100%', padding: 10, border: '1px solid #dadce0', borderRadius: 4, marginBottom: 10, fontSize: 14 };
const btn: React.CSSProperties = { width: '100%', padding: 11, background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 4, fontSize: 15, cursor: 'pointer' };
