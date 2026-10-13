'use client';
import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { remindersApi } from '@/lib/api';
import { Reminder } from '@/types';

function fmtDate(iso: string): { date: string; time: string; isOverdue: boolean; isToday: boolean } {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const isOverdue = d < now;
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  
  let date = d.toLocaleDateString([], { weekday:'short', month:'short', day:'numeric' });
  if (isToday) date = 'Today';
  else if (isTomorrow) date = 'Tomorrow';
  
  const time = d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
  return { date, time, isOverdue: isOverdue && !isToday, isToday };
}

function initials(name?: string|null, phone?: string) {
  if (name?.trim()) {
    const p = name.trim().split(/\s+/);
    return p.length >= 2 ? (p[0][0]+p[1][0]).toUpperCase() : name.slice(0,2).toUpperCase();
  }
  return phone ? phone.replace(/\D/g,'').slice(-2) : 'WA';
}

const AVATAR_BGS = ['#231510','#13201a','#1a1824','#211808','#101e28','#201414'];
function Avatar({ name, phone, size=32 }: { name?:string|null; phone?:string; size?:number }) {
  const init = initials(name, phone);
  const hash = ((name||phone||'').charCodeAt(0)) % AVATAR_BGS.length;
  return (
    <div style={{
      width:size, height:size, borderRadius:'50%',
      background:AVATAR_BGS[hash], color:'var(--g-text-2)',
      fontSize:size*0.34, fontFamily:'var(--font-serif)', fontStyle:'italic',
      display:'flex', alignItems:'center', justifyContent:'center',
      flexShrink:0, border:'1px solid rgba(255,255,255,0.08)',
    }}>{init}</div>
  );
}

function ReminderCard({ r, onComplete, onSnooze }: {
  r: Reminder;
  onComplete: (id:string) => void;
  onSnooze: (id:string) => void;
}) {
  const [completing, setCompleting] = useState(false);
  const [snoozing, setSnoozing] = useState(false);
  const { date, time, isOverdue, isToday } = fmtDate(r.due_at);

  return (
    <div style={{
      padding:'14px 16px',
      borderBottom:'1px solid var(--g-border)',
      background:'var(--g-surface)',
      transition:'background 0.12s',
    }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--g-hover)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'var(--g-surface)')}
    >
      <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
        <Avatar name={r.contact_name} phone={r.contact_whatsapp ?? undefined} size={34} />
        <div style={{ flex:1, minWidth:0 }}>
          <div className="reminder-card-body" style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8 }}>
            <div style={{ minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:500, color:'var(--g-text)', marginBottom:2 }}>
                {r.contact_name || r.contact_whatsapp || 'Customer'}
              </div>
              {r.note && (
                <div style={{ fontSize:12, color:'var(--g-text-3)', lineHeight:1.5, marginBottom:6 }}>
                  {r.note}
                </div>
              )}
              {r.contact_service && (
                <div style={{ fontSize:11.5, color:'var(--g-text-4)', marginBottom:4 }}>
                  {r.contact_service}
                </div>
              )}
              <div style={{
                display:'inline-flex', alignItems:'center', gap:5,
                fontSize:10.5, fontFamily:'var(--font-mono)',
                color: isOverdue ? '#C86060' : isToday ? '#CBA048' : 'var(--g-text-4)',
                background: isOverdue ? 'rgba(184,80,80,0.08)' : isToday ? 'rgba(200,144,42,0.08)' : 'transparent',
                padding: (isOverdue || isToday) ? '2px 7px' : '0',
                borderRadius: 4,
              }}>
                {isOverdue ? (
                  <span style={{ width:5, height:5, borderRadius:'50%', background:'#C86060', display:'inline-block' }} />
                ) : isToday ? (
                  <span style={{ width:5, height:5, borderRadius:'50%', background:'#CBA048', display:'inline-block' }} />
                ) : null}
                {date} · {time}
                {isOverdue && ' · Overdue'}
              </div>
            </div>
            <div style={{ display:'flex', gap:6, flexShrink:0, alignItems:'center' }}>
              <button
                onClick={async () => { setSnoozing(true); await onSnooze(r.id); setSnoozing(false); }}
                disabled={snoozing || completing}
                style={{
                  padding:'5px 10px', borderRadius:4,
                  border:'1px solid var(--g-border)',
                  background:'transparent', color:'var(--g-text-3)',
                  fontSize:11, cursor:'pointer',
                  fontFamily:'var(--font-sans)', transition:'all 0.12s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background='var(--g-raised)'; e.currentTarget.style.color='var(--g-text)'; }}
                onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--g-text-3)'; }}
              >
                {snoozing ? '…' : '+24h'}
              </button>
              <button
                onClick={async () => { setCompleting(true); await onComplete(r.id); setCompleting(false); }}
                disabled={completing || snoozing}
                style={{
                  padding:'5px 10px', borderRadius:4,
                  border:'1px solid rgba(61,140,94,0.25)',
                  background:'rgba(61,140,94,0.08)', color:'#52A874',
                  fontSize:11, cursor:'pointer',
                  fontFamily:'var(--font-sans)', transition:'all 0.12s',
                  fontWeight:500,
                }}
                onMouseEnter={e => { e.currentTarget.style.background='rgba(61,140,94,0.15)'; }}
                onMouseLeave={e => { e.currentTarget.style.background='rgba(61,140,94,0.08)'; }}
              >
                {completing ? '…' : 'Done ✓'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title, count }: { title:string; count:number }) {
  return (
    <div style={{
      padding:'16px 16px 10px',
      display:'flex', alignItems:'center', justifyContent:'space-between',
      borderBottom:'1px solid var(--g-border)',
    }}>
      <div style={{
        fontFamily:'var(--font-mono)', fontSize:9.5,
        letterSpacing:'0.09em', textTransform:'uppercase',
        color:'var(--g-text-4)',
      }}>
        {title}
      </div>
      <span style={{
        fontSize:10, fontFamily:'var(--font-mono)', fontWeight:500,
        padding:'1px 6px', borderRadius:4,
        background:'rgba(255,255,255,0.05)', color:'var(--g-text-4)',
      }}>
        {count}
      </span>
    </div>
  );
}

type TabType = 'pending' | 'done' | '';

export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabType>('pending');

  const fetchReminders = useCallback(async () => {
    setLoading(true);
    try {
      const r = await remindersApi.list({ status: tab || undefined });
      setReminders(r.data);
    } catch { toast.error('Failed to load follow-ups'); }
    finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { const initial = setTimeout(() => void fetchReminders(), 0); return () => clearTimeout(initial); }, [fetchReminders]);

  async function handleComplete(id: string) {
    try {
      await remindersApi.complete(id);
      toast.success('Follow-up marked as done!');
      fetchReminders();
    } catch { toast.error('Failed to complete'); }
  }

  async function handleSnooze(id: string) {
    try {
      await remindersApi.snooze(id, 24);
      toast.success('Snoozed for 24 hours');
      fetchReminders();
    } catch { toast.error('Failed to snooze'); }
  }

  // Group by day
  const today = reminders.filter(r => {
    const d = new Date(r.due_at);
    return d.toDateString() === new Date().toDateString();
  });
  const thisWeek = reminders.filter(r => {
    const d = new Date(r.due_at), now = new Date();
    const tomorrow = new Date(now); tomorrow.setDate(now.getDate()+1);
    const nextWeek = new Date(now); nextWeek.setDate(now.getDate()+7);
    return d.toDateString() !== now.toDateString() && d > now && d <= nextWeek;
  });
  const upcoming = reminders.filter(r => {
    const d = new Date(r.due_at), now = new Date();
    const nextWeek = new Date(now); nextWeek.setDate(now.getDate()+7);
    return d > nextWeek;
  });

  const allSections: { label: string; items: Reminder[] }[] = tab === 'pending' ? [
    { label:'Overdue', items: reminders.filter(r => new Date(r.due_at) < new Date()) },
    { label:'Today', items: today },
    { label:'This week', items: thisWeek },
    { label:'Upcoming', items: upcoming },
  ].filter(s => s.items.length > 0) : [];

  return (
    <div className="g-page" style={{ fontFamily:'var(--font-sans)' }}>
      <div style={{ padding:'28px 40px 48px', maxWidth:900, margin:'0 auto' }}>

        {/* Header */}
        <header style={{
          display:'flex', alignItems:'flex-start', justifyContent:'space-between',
          paddingBottom:20, borderBottom:'1px solid var(--g-border)', marginBottom:24,
        }}>
          <div>
            <h1 style={{
              fontFamily:'var(--font-serif)', fontSize:24, fontWeight:400,
              color:'var(--g-text)', letterSpacing:'-0.01em', margin:0,
            }}>
              Follow-ups
            </h1>
            <div style={{ marginTop:6, fontSize:13, color:'var(--g-text-3)' }}>
              {loading ? 'Loading…' : `${reminders.length} follow-up${reminders.length !== 1 ? 's' : ''} ${tab || 'total'}`}
            </div>
          </div>
        </header>

        {/* Tabs */}
        <div style={{ display:'flex', gap:0, borderBottom:'1px solid var(--g-border)', marginBottom:24 }}>
          {[
            { label:'Pending', value:'pending' as TabType },
            { label:'Completed', value:'done' as TabType },
            { label:'All', value:'' as TabType },
          ].map(t => (
            <button
              key={t.label}
              onClick={() => setTab(t.value)}
              style={{
                padding:'8px 20px', fontSize:12, background:'transparent', border:'none',
                borderBottom: tab===t.value ? '2px solid var(--g-accent-light)' : '2px solid transparent',
                color: tab===t.value ? 'var(--g-text)' : 'var(--g-text-3)',
                fontWeight: tab===t.value ? 500 : 400,
                cursor:'pointer', transition:'all 0.12s',
                fontFamily:'var(--font-sans)', marginBottom:-1,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div>
            {Array.from({length:4}).map((_,i) => (
              <div key={i} style={{ display:'flex', gap:12, padding:'14px 16px', borderBottom:'1px solid var(--g-border)', alignItems:'flex-start' }}>
                <div className="g-skeleton" style={{ width:34, height:34, borderRadius:'50%' }} />
                <div style={{ flex:1 }}>
                  <div className="g-skeleton" style={{ width:'30%', height:12, marginBottom:7 }} />
                  <div className="g-skeleton" style={{ width:'55%', height:10, marginBottom:7 }} />
                  <div className="g-skeleton" style={{ width:'25%', height:10 }} />
                </div>
              </div>
            ))}
          </div>
        ) : reminders.length === 0 ? (
          <div style={{ padding:'64px 0', textAlign:'center' }}>
            <div style={{
              fontFamily:'var(--font-serif)', fontSize:20,
              color:'var(--g-text)', marginBottom:10,
            }}>
              {tab === 'pending' ? 'No follow-ups pending.' : 'Nothing here yet.'}
            </div>
            <div style={{ fontSize:13, color:'var(--g-text-4)', lineHeight:1.7 }}>
              {tab === 'pending'
                ? 'You\'re all caught up. Great work.'
                : 'Completed follow-ups will appear here.'
              }
            </div>
          </div>
        ) : tab === 'pending' && allSections.length > 0 ? (
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
            {allSections.map(section => (
              <div key={section.label} style={{ border:'1px solid var(--g-border)', borderRadius:6, overflow:'hidden' }}>
                <SectionHeader title={section.label} count={section.items.length} />
                {section.items.map(r => (
                  <ReminderCard key={r.id} r={r} onComplete={handleComplete} onSnooze={handleSnooze} />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ border:'1px solid var(--g-border)', borderRadius:6, overflow:'hidden' }}>
            {reminders.map(r => (
              <ReminderCard key={r.id} r={r} onComplete={handleComplete} onSnooze={handleSnooze} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
