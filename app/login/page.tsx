'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';

export default function Login() {
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const site = process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '');

  async function signIn() {
    setErr(''); setMsg('');
    if (!email || !pw) { setErr('Enter your email and password.'); return; }
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    if (error) { setErr('Wrong email or password.'); return; }
    location.href = '/';
  }
  async function google() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${site}/auth/callback` },
    });
  }
  async function reset() {
    setErr(''); setMsg('');
    if (!email) { setErr('Enter your email first, then click reset.'); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${site}/set-password`,
    });
    if (error) { setErr(error.message); return; }
    setMsg('If that email has an account, a reset link is on its way.');
  }

  return (
    <div style={{ maxWidth: 360, margin: '80px auto', textAlign: 'center' }}>
      <h1 style={{ fontWeight: 400 }}>📦 Shipping Calendar</h1>
      <p style={{ color: '#70757a' }}>Sign in with your email and password.</p>
      <input placeholder="you@company.com" value={email}
        onChange={e => setEmail(e.target.value)} style={inp} />
      <input type="password" placeholder="Password" value={pw}
        onChange={e => setPw(e.target.value)} style={inp}
        onKeyDown={e => { if (e.key === 'Enter') signIn(); }} />
      {err && <p style={{ color: '#d93025', fontSize: 13, margin: '4px 0' }}>{err}</p>}
      {msg && <p style={{ color: '#33b679', fontSize: 13, margin: '4px 0' }}>{msg}</p>}
      <button onClick={signIn} style={btn}>Sign in</button>
      <div style={{ marginTop: 10 }}>
        <a onClick={reset} style={link}>Forgot password?</a>
      </div>
      <div style={{ margin: '20px 0', color: '#bdc1c6' }}>— or —</div>
      <button onClick={google} style={{ ...btn, background: '#fff', color: '#3c4043', border: '1px solid #dadce0' }}>
        Sign in with Google
      </button>
      <p style={{ color: '#9aa0a6', fontSize: 12, marginTop: 24 }}>
        New here? You need an invite from a teammate — check your email for the link.
      </p>
    </div>
  );
}

const inp: React.CSSProperties = { width: '100%', padding: 10, border: '1px solid #dadce0', borderRadius: 4, marginBottom: 10, fontSize: 14 };
const btn: React.CSSProperties = { width: '100%', padding: 11, background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 4, fontSize: 15, cursor: 'pointer' };
const link: React.CSSProperties = { color: '#1a73e8', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' };
