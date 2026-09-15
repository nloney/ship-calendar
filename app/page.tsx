'use client';
import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { isoAddDays, DEFAULT_LEAD_DAYS } from '@/lib/dates';

const COLORS = ['#1a73e8', '#d50000', '#33b679', '#f4511e', '#8e24aa', '#e67c73', '#f6bf26', '#0b8043'];

type Ev = {
  id: string; title: string; event_date: string; ship_date: string;
  notes: string; color: string; tracking_number: string; carrier: string; is_local: boolean;
};

const fmt = (d: Date) => d.toISOString().slice(0, 10);

export default function Calendar() {
  const supabase = createClient();
  const [events, setEvents] = useState<Ev[]>([]);
  const [view, setView] = useState(new Date());
  const [editing, setEditing] = useState<Ev | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Ev>>({});
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMsg, setInviteMsg] = useState('');
  const [inviteErr, setInviteErr] = useState('');

  const loadEvents = useCallback(async () => {
    const res = await fetch('/api/events');
    if (res.ok) setEvents(await res.json());
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  // live updates so colleagues see each other's edits without refresh
  useEffect(() => {
    const ch = supabase
      .channel('events-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, loadEvents)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [supabase, loadEvents]);

  function openNew(dateIso?: string) {
    const d = dateIso || fmt(new Date());
    setEditing(null);
    setForm({ title: '', event_date: d, ship_date: isoAddDays(d, -DEFAULT_LEAD_DAYS), notes: '', color: COLORS[0], is_local: false });
    setOpen(true);
  }
  function openEdit(ev: Ev) { setEditing(ev); setForm({ ...ev }); setOpen(true); }

  async function submit() {
    if (!form.title || !form.event_date) { alert('Title and event date required.'); return; }
    if (editing) {
      await fetch('/api/events', { method: 'PATCH', body: JSON.stringify({ id: editing.id, ...form }) });
    } else {
      await fetch('/api/events', { method: 'POST', body: JSON.stringify(form) });
    }
    setOpen(false); loadEvents();
  }
  async function remove() {
    if (editing && confirm('Delete this event?')) {
      await fetch('/api/events', { method: 'DELETE', body: JSON.stringify({ id: editing.id }) });
      setOpen(false); loadEvents();
    }
  }
  async function signOut() { await supabase.auth.signOut(); location.href = '/login'; }

  async function sendInvite() {
    setInviteErr(''); setInviteMsg('');
    if (!inviteEmail) { setInviteErr('Enter an email address.'); return; }
    const res = await fetch('/api/invite', { method: 'POST', body: JSON.stringify({ email: inviteEmail }) });
    const data = await res.json();
    if (!res.ok) { setInviteErr(data.error || 'Could not send invite.'); return; }
    setInviteMsg(`Invite sent to ${inviteEmail}. They'll get an email to set a password.`);
    setInviteEmail('');
  }

  // build grid
  const y = view.getFullYear(), m = view.getMonth();
  const first = new Date(y, m, 1);
  const start = new Date(first); start.setDate(1 - first.getDay());
  const todayIso = fmt(new Date());
  const byDate: Record<string, { ev: Ev; kind: 'event' | 'ship' }[]> = {};
  events.forEach(ev => {
    (byDate[ev.event_date] ||= []).push({ ev, kind: 'event' });
    if (ev.ship_date) (byDate[ev.ship_date] ||= []).push({ ev, kind: 'ship' });
  });
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start); d.setDate(start.getDate() + i); return d;
  });
  const dueToday = events.filter(e => e.ship_date === todayIso);

  return (
    <div>
      <header style={hdr}>
        <h1 style={{ fontSize: 22, fontWeight: 400, color: '#5f6368', margin: 0 }}>📦 Shipping Calendar</h1>
        <button style={ibtn} onClick={() => { const v = new Date(view); v.setMonth(m - 1); setView(v); }}>‹</button>
        <button style={ibtn} onClick={() => { const v = new Date(view); v.setMonth(m + 1); setView(v); }}>›</button>
        <button style={btn} onClick={() => setView(new Date())}>Today</button>
        <span style={{ fontSize: 20 }}>{view.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
        <span style={{ flex: 1 }} />
        <button style={primary} onClick={() => openNew()}>+ Add event</button>
        <button style={btn} onClick={() => setInviteOpen(true)}>Invite</button>
        <button style={btn} onClick={signOut}>Sign out</button>
      </header>

      {dueToday.length > 0 && (() => {
        const ship = dueToday.filter(e => !e.is_local);
        const pack = dueToday.filter(e => e.is_local);
        const segs = [];
        if (ship.length) segs.push(`🚚 ship: ${ship.map(e => e.title).join(', ')}`);
        if (pack.length) segs.push(`📦 pack: ${pack.map(e => e.title).join(', ')}`);
        return <div style={banner}>⚠ Due today — {segs.join('  ·  ')}</div>;
      })()}

      <div style={weekdays}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} style={{ padding: 8 }}>{d}</div>)}
      </div>

      <div style={grid}>
        {cells.map((d, i) => {
          const iso = fmt(d);
          const other = d.getMonth() !== m;
          const items = (byDate[iso] || []).sort((a, b) => a.kind.localeCompare(b.kind));
          return (
            <div key={i} style={{ ...cell, background: other ? '#f8f9fa' : '#fff' }}
              onClick={() => openNew(iso)}>
              <div style={{ ...num, ...(iso === todayIso ? todayNum : {}), color: other ? '#bdc1c6' : num.color }}>
                {d.getDate()}
              </div>
              {items.map((it, j) => (
                <div key={j}
                  onClick={e => { e.stopPropagation(); openEdit(it.ev); }}
                  title={it.kind === 'ship'
                    ? `${it.ev.is_local ? 'PACK DAY' : 'SHIP DAY'} for "${it.ev.title}"\nNotes: ${it.ev.notes || '—'}`
                    : `${it.ev.title}\n${it.ev.notes || ''}`}
                  style={{
                    ...pill, background: it.ev.color,
                    border: it.kind === 'ship' ? '1.5px dashed rgba(255,255,255,.8)' : 'none',
                  }}>
                  {it.kind === 'ship' ? (it.ev.is_local ? '📦 PACK: ' : '🚚 SHIP: ') : ''}{it.ev.title}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {open && (
        <div style={overlay} onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div style={modal}>
            <h2 style={{ fontWeight: 400 }}>{editing ? 'Edit event' : 'Add event'}</h2>
            <Field label="Title">
              <input style={inp} value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} />
            </Field>
            <Field label="Event date">
              <input type="date" style={inp} value={form.event_date || ''}
                onChange={e => setForm({ ...form, event_date: e.target.value, ship_date: isoAddDays(e.target.value, -DEFAULT_LEAD_DAYS) })} />
            </Field>
            <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <input id="local" type="checkbox" checked={!!form.is_local}
                onChange={e => setForm({ ...form, is_local: e.target.checked })} />
              <label htmlFor="local" style={{ fontSize: 14, cursor: 'pointer' }}>
                Local event (pack instead of ship)
              </label>
            </div>
            <Field label={form.is_local ? 'Notes (what needs to be packed)' : 'Notes (what needs to ship)'}>
              <textarea style={{ ...inp, minHeight: 60 }} value={form.notes || ''}
                onChange={e => setForm({ ...form, notes: e.target.value })} />
            </Field>
            <Field label={form.is_local
              ? 'Pack date (auto: 1 week before — editable)'
              : 'Ship date (auto: 1 week before — editable)'}>
              <input type="date" style={inp} value={form.ship_date || ''}
                onChange={e => setForm({ ...form, ship_date: e.target.value })} />
            </Field>
            {!form.is_local && <>
              <Field label="Carrier">
                <select style={inp} value={form.carrier || ''}
                  onChange={e => setForm({ ...form, carrier: e.target.value })}>
                  <option value="">Other / none</option>
                  <option value="ups">UPS</option>
                  <option value="fedex">FedEx</option>
                  <option value="usps">USPS</option>
                  <option value="dhl">DHL</option>
                </select>
              </Field>
              <Field label="Tracking number">
                <input style={inp} value={form.tracking_number || ''}
                  placeholder="Added once it ships"
                  onChange={e => setForm({ ...form, tracking_number: e.target.value })} />
              </Field>
            </>}
            <Field label="Color">
              <div style={{ display: 'flex', gap: 8 }}>
                {COLORS.map(c => (
                  <div key={c} onClick={() => setForm({ ...form, color: c })}
                    style={{ width: 26, height: 26, borderRadius: '50%', background: c, cursor: 'pointer',
                      border: form.color === c ? '2px solid #3c4043' : '2px solid transparent' }} />
                ))}
              </div>
            </Field>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
              {editing ? <button style={{ ...btn, color: '#d93025', borderColor: '#d93025' }} onClick={remove}>Delete</button> : <span />}
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={btn} onClick={() => setOpen(false)}>Cancel</button>
                <button style={primary} onClick={submit}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {inviteOpen && (
        <div style={overlay} onClick={e => { if (e.target === e.currentTarget) { setInviteOpen(false); setInviteMsg(''); setInviteErr(''); } }}>
          <div style={{ ...modal, width: 400 }}>
            <h2 style={{ fontWeight: 400 }}>Invite a teammate</h2>
            <p style={{ fontSize: 13, color: '#70757a', marginTop: -6 }}>
              They'll get an email at this address (their username) with a link to set their own password.
            </p>
            <Field label="Email address">
              <input style={inp} type="email" value={inviteEmail} placeholder="colleague@company.com"
                onChange={e => setInviteEmail(e.target.value)} />
            </Field>
            {inviteErr && <p style={{ color: '#d93025', fontSize: 13 }}>{inviteErr}</p>}
            {inviteMsg && <p style={{ color: '#33b679', fontSize: 13 }}>{inviteMsg}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button style={btn} onClick={() => { setInviteOpen(false); setInviteMsg(''); setInviteErr(''); }}>Close</button>
              <button style={primary} onClick={sendInvite}>Send invite</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, color: '#70757a', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

const hdr: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid #dadce0', flexWrap: 'wrap' };
const btn: React.CSSProperties = { border: '1px solid #dadce0', background: '#fff', borderRadius: 4, padding: '8px 14px', fontSize: 14, cursor: 'pointer' };
const ibtn: React.CSSProperties = { border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', width: 34, height: 34, borderRadius: '50%' };
const primary: React.CSSProperties = { ...btn, background: '#1a73e8', color: '#fff', border: 'none' };
const weekdays: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderBottom: '1px solid #dadce0', textAlign: 'center', fontSize: 11, color: '#70757a', textTransform: 'uppercase' };
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gridAutoRows: '1fr', minHeight: 'calc(100vh - 150px)' };
const cell: React.CSSProperties = { borderRight: '1px solid #dadce0', borderBottom: '1px solid #dadce0', padding: 4, minHeight: 100, overflow: 'hidden', cursor: 'pointer' };
const num: React.CSSProperties = { fontSize: 12, textAlign: 'center', width: 24, height: 24, lineHeight: '24px', margin: '2px auto', borderRadius: '50%', color: '#3c4043' };
const todayNum: React.CSSProperties = { background: '#1a73e8', color: '#fff' };
const pill: React.CSSProperties = { fontSize: 11, padding: '2px 6px', borderRadius: 4, margin: '2px 0', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 };
const modal: React.CSSProperties = { background: '#fff', borderRadius: 8, width: 440, maxWidth: '92vw', padding: 24 };
const inp: React.CSSProperties = { width: '100%', padding: '9px 10px', border: '1px solid #dadce0', borderRadius: 4, fontSize: 14, fontFamily: 'inherit' };
const banner: React.CSSProperties = { background: '#fef7e0', borderBottom: '1px solid #fdd663', color: '#7c5c00', fontSize: 13, padding: '8px 20px' };
