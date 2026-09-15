'use client';
import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { trackingUrl, carrierLabel } from '@/lib/carriers';

type Ev = {
  id: string; title: string; event_date: string; ship_date: string;
  notes: string; color: string; tracking_number: string; carrier: string; is_local: boolean;
};

const fmt = (d: Date) => d.toISOString().slice(0, 10);
const prettyShort = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export default function Board() {
  const supabase = createClient();
  const [events, setEvents] = useState<Ev[]>([]);
  const [now, setNow] = useState(new Date());

  const load = useCallback(async () => {
    const { data } = await supabase.from('public_board').select('*');
    if (data) setEvents(data as Ev[]);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  // clock + safety re-fetch every 5 min (in case realtime drops on a long-running TV)
  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 30_000);
    const poll = setInterval(load, 5 * 60_000);
    return () => { clearInterval(clock); clearInterval(poll); };
  }, [load]);

  // live updates
  useEffect(() => {
    const ch = supabase
      .channel('board-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [supabase, load]);

  const todayIso = fmt(now);
  const view = now;
  const y = view.getFullYear(), m = view.getMonth();
  const first = new Date(y, m, 1);
  const start = new Date(first); start.setDate(1 - first.getDay());
  const cells = Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });

  const byDate: Record<string, { ev: Ev; kind: 'event' | 'ship' }[]> = {};
  events.forEach(ev => {
    (byDate[ev.event_date] ||= []).push({ ev, kind: 'event' });
    if (ev.ship_date) (byDate[ev.ship_date] ||= []).push({ ev, kind: 'ship' });
  });

  const shipsToday = events.filter(e => e.ship_date === todayIso);
  const upcoming = events
    .filter(e => e.ship_date >= todayIso)
    .sort((a, b) => a.ship_date.localeCompare(b.ship_date))
    .slice(0, 8);

  return (
    <div style={page}>
      <div style={topbar}>
        <div style={{ fontSize: 26, fontWeight: 500 }}>📦 Shipping board</div>
        <div style={{ fontSize: 22, color: '#9aa0a6' }}>
          {view.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 22, color: '#9aa0a6' }}>
          {now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
        </div>
      </div>

      {shipsToday.length > 0 && (
        <div style={alert}>
          {shipsToday.filter(e => !e.is_local).length > 0 &&
            <span>🚚 SHIP TODAY:&nbsp;{shipsToday.filter(e => !e.is_local).map(e => e.title).join('  ·  ')}</span>}
          {shipsToday.filter(e => !e.is_local).length > 0 && shipsToday.filter(e => e.is_local).length > 0 &&
            <span>&nbsp;&nbsp;&nbsp;&nbsp;</span>}
          {shipsToday.filter(e => e.is_local).length > 0 &&
            <span>📦 PACK TODAY:&nbsp;{shipsToday.filter(e => e.is_local).map(e => e.title).join('  ·  ')}</span>}
        </div>
      )}

      <div style={main}>
        {/* Calendar — the star */}
        <div style={calWrap}>
          <div style={weekdays}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
          </div>
          <div style={grid}>
            {cells.map((d, i) => {
              const iso = fmt(d);
              const other = d.getMonth() !== m;
              const items = (byDate[iso] || []).sort((a, b) => a.kind.localeCompare(b.kind));
              return (
                <div key={i} style={{ ...cell, opacity: other ? 0.35 : 1 }}>
                  <div style={{ ...dayNum, ...(iso === todayIso ? todayNum : {}) }}>{d.getDate()}</div>
                  {items.slice(0, 4).map((it, j) => (
                    <div key={j} style={{
                      ...pill, background: it.ev.color,
                      border: it.kind === 'ship' ? '2px dashed rgba(255,255,255,.85)' : 'none',
                    }}>
                      {it.kind === 'ship' ? (it.ev.is_local ? '📦 ' : '🚚 ') : ''}{it.ev.title}
                    </div>
                  ))}
                  {items.length > 4 && <div style={{ fontSize: 13, color: '#9aa0a6' }}>+{items.length - 4} more</div>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming shipments — corner panel */}
        <div style={sidePanel}>
          <div style={panelTitle}>Upcoming ship &amp; pack</div>
          {upcoming.length === 0 && <div style={{ color: '#9aa0a6' }}>Nothing scheduled.</div>}
          {upcoming.map(e => {
            const url = trackingUrl(e.carrier, e.tracking_number);
            const isToday = e.ship_date === todayIso;
            return (
              <div key={e.id} style={{ ...shipRow, borderLeft: `4px solid ${e.color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontWeight: 500, fontSize: 17 }}>
                    <span style={{ fontSize: 13, color: '#9aa0a6', marginRight: 6 }}>
                      {e.is_local ? '📦 PACK' : '🚚 SHIP'}
                    </span>
                    {e.title}
                  </span>
                  <span style={{ fontSize: 15, color: isToday ? '#ffd54f' : '#9aa0a6', fontWeight: isToday ? 600 : 400 }}>
                    {isToday ? 'TODAY' : prettyShort(e.ship_date)}
                  </span>
                </div>
                {e.notes && <div style={{ fontSize: 14, color: '#bdc1c6', marginTop: 2 }}>{e.notes}</div>}
                {!e.is_local && e.tracking_number && (
                  <div style={{ fontSize: 14, marginTop: 4 }}>
                    <span style={{ color: '#9aa0a6' }}>{carrierLabel(e.carrier)}: </span>
                    {url
                      ? <a href={url} target="_blank" rel="noreferrer" style={{ color: '#8ab4f8' }}>{e.tracking_number}</a>
                      : <span style={{ color: '#e8eaed' }}>{e.tracking_number}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const page: React.CSSProperties = { background: '#202124', color: '#e8eaed', minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'Roboto, Arial, sans-serif' };
const topbar: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 24, padding: '14px 24px', borderBottom: '1px solid #3c4043' };
const alert: React.CSSProperties = { background: '#5c3a00', color: '#ffd54f', fontSize: 22, fontWeight: 600, padding: '10px 24px', letterSpacing: '.5px' };
const main: React.CSSProperties = { flex: 1, display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 0, minHeight: 0 };
const calWrap: React.CSSProperties = { display: 'flex', flexDirection: 'column', borderRight: '1px solid #3c4043', minHeight: 0 };
const weekdays: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', textAlign: 'center', fontSize: 14, color: '#9aa0a6', padding: '8px 0', textTransform: 'uppercase' };
const grid: React.CSSProperties = { flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gridAutoRows: '1fr' };
const cell: React.CSSProperties = { border: '1px solid #3c4043', padding: 6, overflow: 'hidden', minHeight: 0 };
const dayNum: React.CSSProperties = { fontSize: 15, width: 30, height: 30, lineHeight: '30px', textAlign: 'center', borderRadius: '50%', margin: '0 auto 4px' };
const todayNum: React.CSSProperties = { background: '#8ab4f8', color: '#202124', fontWeight: 600 };
const pill: React.CSSProperties = { fontSize: 14, padding: '3px 8px', borderRadius: 5, margin: '3px 0', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
const sidePanel: React.CSSProperties = { padding: '14px 18px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 };
const panelTitle: React.CSSProperties = { fontSize: 18, fontWeight: 500, color: '#9aa0a6', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 };
const shipRow: React.CSSProperties = { background: '#2a2b2e', borderRadius: 8, padding: '10px 12px' };
