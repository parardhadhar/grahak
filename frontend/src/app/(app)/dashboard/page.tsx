'use client';
import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { dashboardApi, contactsApi, remindersApi, whatsappBridgeApi, devApi, getApiErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { DashboardData, Contact, Message, Reminder, ContactStatus } from '@/types';
import SimulatorPanel from '@/components/dashboard/SimulatorPanel';
import WhatsAppQRModal from '@/components/whatsapp/WhatsAppQRModal';
import toast from 'react-hot-toast';

// ─── Utilities ────────────────────────────────────────────────
function fmtTime(iso: string): string {
  const d = new Date(iso), now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return d.toLocaleDateString([], { weekday:'short' });
  return d.toLocaleDateString([], { day:'numeric', month:'short' });
}

function fmtFull(iso: string): string {
  return new Date(iso).toLocaleString([], { hour:'2-digit', minute:'2-digit', day:'numeric', month:'short' });
}

function initials(name?: string|null, phone?: string) {
  if (name?.trim()) {
    const p = name.trim().split(/\s+/);
    return p.length >= 2 ? (p[0][0]+p[1][0]).toUpperCase() : name.slice(0,2).toUpperCase();
  }
  return phone ? phone.replace(/\D/g,'').slice(-2) : 'WA';
}

const STATUS_LABEL: Record<string,string> = {
  new_lead:'New Lead', follow_up_required:'Follow-up', active_customer:'Active',
  returning_customer:'Returning', complaint:'Complaint', closed:'Closed', spam:'Spam',
};

function statusStyle(s: string) {
  switch(s) {
    case 'new_lead':           return { bg:'rgba(200,98,42,0.12)',  color:'var(--g-accent-light)' };
    case 'follow_up_required': return { bg:'rgba(200,144,42,0.12)', color:'#CBA048' };
    case 'active_customer':
    case 'returning_customer': return { bg:'rgba(61,140,94,0.12)',  color:'#52A874' };
    case 'complaint':          return { bg:'rgba(184,80,80,0.12)',  color:'#C86060' };
    default:                   return { bg:'rgba(255,255,255,0.05)', color:'#6A6560' };
  }
}

const AVATAR_BGS = ['#231510','#13201a','#1a1824','#211808','#101e28','#201414'];
function Avatar({ name, phone, size=38 }: { name?:string|null; phone?:string; size?:number }) {
  const init = initials(name, phone);
  const hash = ((name||phone||'').charCodeAt(0)) % AVATAR_BGS.length;
  return (
    <div style={{
      width:size, height:size, borderRadius:'50%',
      background:AVATAR_BGS[hash],
      color:'var(--g-text-2)', fontSize:size*0.34,
      fontFamily:'var(--font-serif)', fontStyle:'italic',
      display:'flex', alignItems:'center', justifyContent:'center',
      flexShrink:0, border:'1px solid rgba(255,255,255,0.08)',
      userSelect:'none',
    }}>{init}</div>
  );
}

function SkeletonMsg({ dir='in' }: { dir?:'in'|'out' }) {
  return (
    <div style={{ display:'flex', justifyContent: dir==='out'?'flex-end':'flex-start', marginBottom:12 }}>
      <div className="g-skeleton" style={{ width:160, height:36, borderRadius:10 }} />
    </div>
  );
}

// ─── Main inbox content (uses useSearchParams, needs Suspense) ─
function InboxContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const preselect = searchParams.get('contact');

  const [data, setData] = useState<DashboardData|null>(null);
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activeContactId, setActiveContactId] = useState<string|null>(preselect);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgsLoading, setMsgsLoading] = useState(false);
  const [msgInput, setMsgInput] = useState('');
  const [sending, setSending] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [filter, setFilter] = useState<'all'|'leads'|'customers'|'follow-ups'>('all');
  const [bridge, setBridge] = useState<{connected:boolean;phone:string|null}>({connected:false,phone:null});
  const [showQR, setShowQR] = useState(false);
  const [showSim, setShowSim] = useState(false);
  const [tab, setTab] = useState<'info'|'summary'|'notes'>('info');
  const [showDetails, setShowDetails] = useState(false);
  const [notes, setNotes] = useState<{id:string;body:string;created_at:string}[]>([]);
  const [noteInput, setNoteInput] = useState('');
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleNote, setScheduleNote] = useState('');
  const [schedulingFollowup, setSchedulingFollowup] = useState(false);
  const msgsEnd = useRef<HTMLDivElement>(null);

  // ── fetch dashboard ──
  const fetchDash = useCallback(async () => {
    try {
      const [dashRes, bRes, contactsRes] = await Promise.allSettled([
        dashboardApi.get(),
        whatsappBridgeApi.getStatus(),
        contactsApi.listAll(),
      ]);
      if (dashRes.status === 'fulfilled') {
        const dash = dashRes.value;
        setData(dash.data);

      }
      if (contactsRes.status === 'fulfilled') setContacts(contactsRes.value);
      if (bRes.status === 'fulfilled') {
        const b = bRes.value;
        setBridge({ connected: b.connected, phone: b.phone });
      }
    } catch (err) {
      console.error('Inbox fetch error', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = setTimeout(() => void fetchDash(), 0);
    const iv = setInterval(async () => {
      try {
        const [bRes, dashRes, contactsRes] = await Promise.allSettled([
          whatsappBridgeApi.getStatus(),
          dashboardApi.get(),
          contactsApi.listAll(),
        ]);
        if (bRes.status === 'fulfilled') {
          setBridge({ connected: bRes.value.connected, phone: bRes.value.phone });
        }
        if (dashRes.status === 'fulfilled') {
          setData(dashRes.value.data);
        }
        if (contactsRes.status === 'fulfilled') setContacts(contactsRes.value);
      } catch {}
    }, 6000);
    return () => { clearTimeout(initial); clearInterval(iv); };
  }, [fetchDash]);

  // ── fetch messages ──
  useEffect(() => {
    let mounted = true;
    if (!activeContactId) {
      const initial = setTimeout(() => { if (mounted) setMessages([]); }, 0);
      return () => { mounted = false; clearTimeout(initial); };
    }
    const initial = setTimeout(() => { if (mounted) { setMsgsLoading(true); setMessages([]); } }, 0);
    contactsApi.getMessages(activeContactId)
      .then(r => { if (mounted) setMessages(r.data || []); })
      .catch(() => { if (mounted) setMessages([]); })
      .finally(() => { if (mounted) setMsgsLoading(false); });
    const timer = setInterval(async () => {
      try {
        const response = await contactsApi.getMessages(activeContactId);
        if (mounted) setMessages(previous => JSON.stringify(previous) === JSON.stringify(response.data) ? previous : response.data);
      } catch { /* Retain the existing thread during a temporary outage. */ }
    }, 4000);
    return () => { mounted = false; clearTimeout(initial); clearInterval(timer); };
  }, [activeContactId]);

  // fetch notes + reminders when contact changes
  useEffect(() => {
    if (!activeContactId) {
      const initial = setTimeout(() => { setNotes([]); setReminders([]); }, 0);
      return () => clearTimeout(initial);
    }
    contactsApi.getNotes(activeContactId)
      .then(r => setNotes(r.data || [])).catch(() => {});
    remindersApi.list({ status:'pending' })
      .then(r => setReminders((r.data || []).filter((x:Reminder) => x.contact_id === activeContactId)))
      .catch(() => {});
  }, [activeContactId]);

  // auto-scroll to bottom of messages
  useEffect(() => {
    msgsEnd.current?.scrollIntoView({ behavior:'smooth' });
  }, [messages]);

  const activeContact = contacts.find(c => c.id === activeContactId) || null;

  const filteredContacts = contacts.filter(c => {
    const q = searchQ.toLowerCase();
    if (q && !((c.display_name||'').toLowerCase().includes(q) || c.whatsapp_number.includes(q) || (c.ai_summary||'').toLowerCase().includes(q))) return false;
    if (filter === 'leads') return c.status === 'new_lead';
    if (filter === 'customers') return ['active_customer','returning_customer'].includes(c.status);
    if (filter === 'follow-ups') return c.status === 'follow_up_required';
    return true;
  });

  async function sendMessage() {
    if (sending || !msgInput.trim() || !activeContactId) return;
    const txt = msgInput.trim();
    setMsgInput('');
    setSending(true);
    try {
      const r = await contactsApi.sendMessage(activeContactId, txt);
      setMessages(prev => [...prev, r.data]);
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, 'Failed to send'));
      setMsgInput(txt);
    } finally { setSending(false); }
  }

  async function saveNote() {
    if (!noteInput.trim() || !activeContactId) return;
    try {
      const r = await contactsApi.createNote(activeContactId, noteInput.trim());
      setNotes(prev => [...prev, r.data]);
      setNoteInput('');
    } catch { toast.error('Failed to save note'); }
  }

  async function scheduleFollowup() {
    if (!scheduleDate || !activeContactId) return;
    setSchedulingFollowup(true);
    try {
      await contactsApi.createReminder(activeContactId, { due_at: new Date(scheduleDate).toISOString(), note: scheduleNote || undefined });
      toast.success('Follow-up scheduled!');
      setScheduleDate('');
      setScheduleNote('');
      const r = await remindersApi.list({ status:'pending' });
      setReminders((r.data || []).filter((x:Reminder) => x.contact_id === activeContactId));
    } catch { toast.error('Failed to schedule follow-up'); }
    finally { setSchedulingFollowup(false); }
  }

  async function updateStatus(status: string) {
    if (!activeContact) return;
    try {
      await contactsApi.update(activeContact.id, { status: status as ContactStatus });
      toast.success('Status updated');
      fetchDash();
    } catch { toast.error('Failed to update status'); }
  }

  function smartReply() {
    if (!activeContact) return;
    const name = activeContact.display_name?.split(' ')[0] || 'there';
    const svc = activeContact.extracted_service || 'your inquiry';
    const budget = activeContact.extracted_budget ? ` within ₹${Number(activeContact.extracted_budget).toLocaleString('en-IN')}` : '';
    const date = activeContact.extracted_date ? ` for ${activeContact.extracted_date}` : '';
    setMsgInput(`Hi ${name}! Thanks for reaching out. We'd love to help you with ${svc}${date}${budget}. I'll share our packages shortly. 🙏`);
  }

  const followupsCount = data?.todays_followups?.length ?? 0;

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────

  return (
    <div className="inbox-workspace">
      <header className="workspace-header">
        <div><p>Welcome back,</p><h1>{user?.full_name?.split(' ')[0] || 'Your workspace'}.</h1><span>{data?.stats.pending_followups || 0} follow-ups waiting for your attention.</span></div>
        <div className="workspace-header-actions"><a className="g-btn g-btn-ghost" href="/search">Search workspace</a><button className="g-btn g-btn-accent" onClick={() => setShowQR(true)}>{bridge.connected ? 'WhatsApp connected' : 'Connect WhatsApp'}</button></div>
      </header>
      <div className="workspace-metrics">
        {[
          ['Total customers', data?.stats.total_contacts],
          ['Pending follow-ups', data?.stats.pending_followups],
          ['New leads', data?.stats.new_leads],
          ['Active conversations', data?.stats.active_conversations],
        ].map(([label, value]) => <div key={String(label)}><strong>{loading ? '…' : value ?? 0}</strong><span>{label}</span></div>)}
      </div>
    <div className={`crm-inbox ${activeContactId ? 'has-conversation' : ''}`} style={{ display:'flex', height:'100%', width:'100%', overflow:'hidden', fontFamily:'var(--font-sans)' }}>

      {/* ── Simulator drawer overlay ── */}
      {showSim && (
        <div style={{
          position:'absolute', top:0, left:0, right:0, zIndex:60,
          background:'var(--g-surface)',
          borderBottom:'1px solid var(--g-border)',
          boxShadow:'0 8px 32px rgba(0,0,0,0.5)',
          padding:'16px 24px',
        }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <div style={{ fontSize:11.5, fontWeight:600, color:'var(--g-text-2)', display:'flex', alignItems:'center', gap:8 }}>
              <span className="g-dot g-dot-accent" />
              Dev Simulator
              {bridge.connected && (
                <span style={{ fontSize:10, color:'var(--g-green-dot)', fontFamily:'var(--font-mono)' }}>
                  · LIVE
                </span>
              )}
            </div>
            <button onClick={() => setShowSim(false)} style={{ background:'none', border:'none', color:'var(--g-text-3)', cursor:'pointer', fontSize:16, lineHeight:1 }}>✕</button>
          </div>
          <SimulatorPanel onSent={() => { fetchDash(); setShowSim(false); }} />
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          COLUMN 1 — CONVERSATION LIST
      ═══════════════════════════════════════════════════════════ */}
      <div className="conversation-list" style={{
        width:320, minWidth:320, maxWidth:320,
        height:'100vh',
        borderRight:'1px solid var(--g-border)',
        display:'flex', flexDirection:'column',
        background:'var(--g-surface)',
        overflow:'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding:'16px 16px 10px',
          borderBottom:'1px solid var(--g-border)',
        }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <h2 style={{
              fontFamily:'var(--font-serif)', fontSize:18, fontWeight:400,
              color:'var(--g-text)', letterSpacing:'-0.01em', margin:0,
            }}>
              Inbox
            </h2>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              {followupsCount > 0 && (
                <span style={{
                  fontSize:10, fontFamily:'var(--font-mono)', fontWeight:500,
                  padding:'2px 6px', borderRadius:4,
                  background:'rgba(200,144,42,0.12)', color:'#CBA048',
                }}>
                  {followupsCount} due
                </span>
              )}
              <button
                onClick={() => setShowSim(!showSim)}
                title="Dev Simulator"
                style={{
                  width:26, height:26, borderRadius:4,
                  border:'1px solid var(--g-border)',
                  background:'transparent', color:'var(--g-text-3)',
                  cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:11, transition:'all 0.12s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background='var(--g-hover)'; e.currentTarget.style.color='var(--g-text)'; }}
                onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--g-text-3)'; }}
              >
                ⌁
              </button>
            </div>
          </div>

          {/* Search */}
          <div style={{
            display:'flex', alignItems:'center', gap:8,
            background:'var(--g-raised)', border:'1px solid var(--g-border)',
            borderRadius:5, padding:'7px 10px',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--g-text-4)" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              placeholder="Search conversations…"
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              style={{
                background:'transparent', border:'none', outline:'none',
                fontSize:12.5, color:'var(--g-text)', width:'100%',
                fontFamily:'var(--font-sans)',
              }}
            />
            {searchQ && (
              <button onClick={() => setSearchQ('')} style={{ background:'none', border:'none', color:'var(--g-text-3)', cursor:'pointer', fontSize:13, lineHeight:1 }}>✕</button>
            )}
          </div>

          {/* Filter tabs */}
          <div style={{ display:'flex', gap:0, marginTop:10 }}>
            {(['all','leads','customers','follow-ups'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  flex:1, padding:'5px 0', fontSize:11,
                  fontFamily:'var(--font-sans)',
                  background:'transparent', border:'none',
                  borderBottom: filter===f ? '2px solid var(--g-accent-light)' : '2px solid transparent',
                  color: filter===f ? 'var(--g-text)' : 'var(--g-text-3)',
                  fontWeight: filter===f ? 500 : 400,
                  cursor:'pointer', transition:'all 0.12s',
                  textTransform:'capitalize',
                }}
              >
                {f === 'all' ? `All${contacts.length > 0 ? ` (${contacts.length})` : ''}` :
                 f === 'leads' ? 'Leads' :
                 f === 'customers' ? 'Customers' : 'Follow-ups'}
              </button>
            ))}
          </div>
        </div>

        {/* Contact list */}
        <div style={{ flex:1, overflowY:'auto' }}>
          {loading ? (
            Array.from({length:5}).map((_,i) => (
              <div key={i} style={{ display:'flex', gap:10, padding:'12px 14px', borderBottom:'1px solid var(--g-border)' }}>
                <div className="g-skeleton" style={{ width:38, height:38, borderRadius:'50%', flexShrink:0 }} />
                <div style={{ flex:1 }}>
                  <div className="g-skeleton" style={{ width:'50%', height:11, marginBottom:7 }} />
                  <div className="g-skeleton" style={{ width:'75%', height:9 }} />
                </div>
              </div>
            ))
          ) : filteredContacts.length === 0 ? (
            <div style={{ padding:'32px 20px', textAlign:'center' }}>
              <div style={{ fontSize:13, color:'var(--g-text-4)', lineHeight:1.7 }}>
                {searchQ ? 'No conversations matching your search.' : 'No conversations yet.'}
              </div>
              {!searchQ && (
                <button
                  onClick={async () => {
                    try {
                      await devApi.seed();
                      toast.success('Demo conversations loaded!');
                      fetchDash();
                    } catch { toast.error('Seeding failed'); }
                  }}
                  style={{
                    marginTop:12, padding:'6px 14px', borderRadius:4,
                    border:'1px solid var(--g-border)',
                    background:'transparent', color:'var(--g-text-3)',
                    fontSize:11.5, cursor:'pointer', fontFamily:'var(--font-sans)',
                  }}
                >
                  Load demo data
                </button>
              )}
            </div>
          ) : (
            filteredContacts.map(c => {
              const isActive = c.id === activeContactId;
              const st = statusStyle(c.status);
              return (
                <div
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveContactId(c.id); } }}
                  onClick={() => setActiveContactId(c.id)}
                  style={{
                    display:'flex', gap:10, padding:'11px 14px',
                    borderBottom:'1px solid var(--g-border)',
                    borderLeft: isActive ? '2px solid var(--g-accent-light)' : '2px solid transparent',
                    background: isActive ? 'rgba(200,98,42,0.06)' : 'transparent',
                    cursor:'pointer', transition:'all 0.12s', alignItems:'flex-start',
                  }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'var(--g-hover)'; }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                >
                  <Avatar name={c.display_name} phone={c.whatsapp_number} size={36} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:6, marginBottom:2 }}>
                      <span style={{ fontSize:13, fontWeight:isActive?600:500, color:'var(--g-text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {c.display_name || c.whatsapp_number}
                      </span>
                      <span style={{ fontSize:10, color:'var(--g-text-4)', fontFamily:'var(--font-mono)', flexShrink:0 }}>
                        {fmtTime(c.last_contacted_at)}
                      </span>
                    </div>
                    <div style={{ fontSize:11.5, color:'var(--g-text-3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:4 }}>
                      {c.ai_summary ? c.ai_summary.slice(0,70) : (c.extracted_service || 'New conversation')}
                    </div>
                    <span style={{
                      ...st, padding:'1px 5px', borderRadius:3,
                      fontSize:9.5, fontFamily:'var(--font-mono)', fontWeight:500,
                      display:'inline-block',
                    }}>
                      {STATUS_LABEL[c.status] || c.status}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          COLUMN 2 — CHAT WINDOW
      ═══════════════════════════════════════════════════════════ */}
      <div className="conversation-panel" style={{
        flex:1, minWidth:0, height:'100%',
        display:'flex', flexDirection:'column',
        borderRight:'1px solid var(--g-border)',
        background:'var(--g-bg)',
        overflow:'hidden',
      }}>
        {!activeContact ? (
          <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16 }}>
            <div style={{ opacity:0.15 }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <div style={{ fontSize:14, color:'var(--g-text-4)' }}>
              Select a conversation
            </div>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="conversation-header" style={{
              display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'12px 20px', borderBottom:'1px solid var(--g-border)',
              background:'var(--g-surface)',
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <button className="g-btn g-btn-ghost mobile-back" onClick={() => setActiveContactId(null)} aria-label="Back to conversations">←</button>
                <button className="g-btn g-btn-ghost context-toggle" onClick={() => setShowDetails(true)}>Details</button>
                <Avatar name={activeContact.display_name} phone={activeContact.whatsapp_number} size={34} />
                <div>
                  <div style={{ fontSize:14, fontWeight:600, color:'var(--g-text)', lineHeight:1.2 }}>
                    {activeContact.display_name || activeContact.whatsapp_number}
                  </div>
                  <div style={{ fontSize:11, color:'var(--g-text-4)', fontFamily:'var(--font-mono)', marginTop:2 }}>
                    {activeContact.whatsapp_number}
                    <span style={{ marginLeft:8 }}>
                      <span className="g-dot" style={{ background: bridge.connected ? 'var(--g-green-dot)' : 'var(--g-text-4)', verticalAlign:'middle', width:5, height:5, display:'inline-block', borderRadius:'50%' }} />
                      {' '}{bridge.connected ? 'WhatsApp connected' : 'Not connected'}
                    </span>
                  </div>
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <button
                  onClick={() => setShowQR(true)}
                  style={{
                    display:'flex', alignItems:'center', gap:5,
                    padding:'5px 10px', borderRadius:4,
                    border:'1px solid var(--g-border)',
                    background:'transparent', color:'var(--g-text-3)',
                    fontSize:11, cursor:'pointer', fontFamily:'var(--font-sans)',
                    transition:'all 0.12s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background='var(--g-hover)'; e.currentTarget.style.color='var(--g-text)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--g-text-3)'; }}
                >
                  <span className="g-dot" style={{ background: bridge.connected ? 'var(--g-green-dot)' : 'var(--g-text-4)' }} />
                  WhatsApp
                </button>
                {/* Status changer */}
                <select
                  value={activeContact.status}
                  onChange={e => updateStatus(e.target.value)}
                  style={{
                    padding:'5px 8px', borderRadius:4,
                    border:'1px solid var(--g-border)',
                    background:'var(--g-raised)', color:'var(--g-text-2)',
                    fontSize:11, cursor:'pointer',
                    fontFamily:'var(--font-sans)', outline:'none',
                  }}
                >
                  {Object.entries(STATUS_LABEL).map(([k,v]) => (
                    <option key={k} value={k} style={{ background:'#1a1614' }}>{v}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex:1, overflowY:'auto', padding:'20px 24px' }}>
              {msgsLoading ? (
                <>
                  <SkeletonMsg dir="in"/><SkeletonMsg dir="out"/><SkeletonMsg dir="in"/><SkeletonMsg dir="in"/>
                </>
              ) : messages.length === 0 ? (
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:8 }}>
                  <div style={{ fontSize:12, color:'var(--g-text-4)' }}>No messages yet in this conversation.</div>
                </div>
              ) : (
                messages.map((m, i) => {
                  const isOut = m.direction === 'outbound';
                  return (
                    <div key={m.id || i} style={{ display:'flex', justifyContent: isOut ? 'flex-end' : 'flex-start', marginBottom:10 }}>
                      {!isOut && (
                        <Avatar name={activeContact.display_name} phone={activeContact.whatsapp_number} size={26} />
                      )}
                      <div style={{ marginLeft: isOut ? 0 : 8, marginRight: isOut ? 0 : 0, maxWidth:'70%' }}>
                        <div style={{
                          padding:'10px 14px',
                          borderRadius: isOut ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
                          background: isOut ? 'var(--g-raised)' : 'rgba(255,255,255,0.05)',
                          border: isOut ? '1px solid var(--g-border-mid)' : '1px solid var(--g-border)',
                          color:'var(--g-text)',
                          fontSize:13, lineHeight:1.5, whiteSpace:'pre-wrap', overflowWrap:'anywhere',
                        }}>
                          {m.body}
                        </div>
                        <div style={{
                          fontSize:10, color:'var(--g-text-4)',
                          fontFamily:'var(--font-mono)',
                          marginTop:3, textAlign: isOut ? 'right' : 'left',
                        }}>
                          {fmtFull(m.created_at)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={msgsEnd} />
            </div>

            {/* Message input */}
            <div style={{
              padding:'12px 20px',
              borderTop:'1px solid var(--g-border)',
              background:'var(--g-surface)',
            }}>
              <div style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
                <div style={{ flex:1 }}>
                  <textarea
                    aria-label="Message"
                    value={msgInput}
                    onChange={e => setMsgInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    placeholder="Type a message… (Enter to send)"
                    rows={msgInput.split('\n').length > 1 ? 3 : 1}
                    style={{
                      width:'100%', background:'var(--g-raised)',
                      border:'1px solid var(--g-border)',
                      borderRadius:6, padding:'9px 12px',
                      color:'var(--g-text)', fontSize:13,
                      fontFamily:'var(--font-sans)', outline:'none',
                      resize:'none', lineHeight:1.5,
                      transition:'border-color 0.12s',
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = 'var(--g-border-focus)')}
                    onBlur={e => (e.currentTarget.style.borderColor = 'var(--g-border)')}
                  />
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                  <button
                    onClick={smartReply}
                    title="Draft smart reply"
                    style={{
                      padding:'7px 10px', borderRadius:5,
                      border:'1px solid var(--g-border)',
                      background:'transparent', color:'var(--g-text-3)',
                      fontSize:11, cursor:'pointer', fontFamily:'var(--font-sans)',
                      transition:'all 0.12s', whiteSpace:'nowrap',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background='var(--g-hover)'; e.currentTarget.style.color='var(--g-text)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--g-text-3)'; }}
                  >
                    Suggest reply
                  </button>
                  <button
                    onClick={sendMessage}
                    disabled={!msgInput.trim() || sending}
                    style={{
                      padding:'7px 14px', borderRadius:5,
                      border:'1px solid var(--g-border-mid)',
                      background: msgInput.trim() ? 'var(--g-text)' : 'transparent',
                      color: msgInput.trim() ? 'var(--g-bg)' : 'var(--g-text-4)',
                      fontSize:12, fontWeight:500, cursor: msgInput.trim() ? 'pointer' : 'default',
                      fontFamily:'var(--font-sans)', transition:'all 0.12s',
                    }}
                  >
                    {sending ? '…' : 'Send'}
                  </button>
                </div>
              </div>
              {!bridge.connected && (
                <div style={{ marginTop:8, fontSize:11, color:'var(--g-text-4)' }}>
                  WhatsApp not connected.{' '}
                  <button onClick={() => setShowQR(true)} style={{ background:'none', border:'none', color:'var(--g-accent-light)', cursor:'pointer', fontSize:11, padding:0, textDecoration:'underline' }}>
                    Connect now
                  </button>
                  {' '}to send real messages.
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════
          COLUMN 3 — CUSTOMER INTELLIGENCE
      ═══════════════════════════════════════════════════════════ */}
      <div className={`customer-panel ${showDetails ? 'show-details' : ''}`} style={{
        width:300, minWidth:300, maxWidth:300,
        height:'100vh',
        display:'flex', flexDirection:'column',
        background:'var(--g-surface)',
        overflow:'hidden',
      }}>
        <button className="g-btn g-btn-ghost context-toggle" onClick={() => setShowDetails(false)}>Close customer details</button>
        {!activeContact ? (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div style={{ fontSize:12, color:'var(--g-text-4)', textAlign:'center', padding:20 }}>
              Select a conversation to see customer details
            </div>
          </div>
        ) : (
          <>
            {/* Customer header */}
            <div style={{ padding:'16px', borderBottom:'1px solid var(--g-border)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                <Avatar name={activeContact.display_name} phone={activeContact.whatsapp_number} size={40} />
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:'var(--g-text)', lineHeight:1.2 }}>
                    {activeContact.display_name || 'Unknown'}
                  </div>
                  <div style={{ fontSize:11, color:'var(--g-text-4)', fontFamily:'var(--font-mono)', marginTop:2 }}>
                    {activeContact.whatsapp_number}
                  </div>
                </div>
              </div>
              {/* Tabs */}
              <div style={{ display:'flex', gap:1, borderBottom:'1px solid var(--g-border)', paddingBottom:0 }}>
                {(['info','summary','notes'] as const).map(t => (
                  <button key={t} onClick={() => setTab(t)} style={{
                    flex:1, padding:'5px 0', fontSize:11,
                    background:'transparent', border:'none',
                    borderBottom: tab===t ? '2px solid var(--g-accent-light)' : '2px solid transparent',
                    color: tab===t ? 'var(--g-text)' : 'var(--g-text-3)',
                    fontWeight: tab===t ? 500 : 400,
                    cursor:'pointer', transition:'all 0.12s',
                    textTransform:'capitalize', fontFamily:'var(--font-sans)',
                    marginBottom:-1,
                  }}>
                    {t === 'summary' ? 'AI' : t.charAt(0).toUpperCase()+t.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab content */}
            <div style={{ flex:1, overflowY:'auto', padding:'16px' }}>

              {/* ── INFO TAB ── */}
              {tab === 'info' && (
                <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                  {/* Contact details */}
                  <section>
                    <div className="g-label" style={{ marginBottom:8 }}>Contact</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      {[
                        ['Phone', activeContact.whatsapp_number],
                        ['Status', STATUS_LABEL[activeContact.status] || activeContact.status],
                        ['Priority', activeContact.priority || 'medium'],
                        ['Messages', String(activeContact.message_count || 0)],
                        ['Customer since', new Date(activeContact.first_contacted_at).toLocaleDateString([], { month:'short', year:'numeric' })],
                      ].map(([k,v]) => (
                        <div key={k} style={{ display:'flex', justifyContent:'space-between', gap:8 }}>
                          <span style={{ fontSize:11.5, color:'var(--g-text-4)' }}>{k}</span>
                          <span style={{ fontSize:11.5, color:'var(--g-text-2)', textAlign:'right', fontFamily: k==='Phone' ? 'var(--font-mono)' : 'inherit' }}>{v}</span>
                        </div>
                      ))}
                    </div>
                  </section>

                  <div className="g-divider" />

                  {/* Extracted details */}
                  {(activeContact.extracted_service || activeContact.extracted_budget || activeContact.extracted_date || activeContact.extracted_location) && (
                    <section>
                      <div className="g-label" style={{ marginBottom:8 }}>Business Details</div>
                      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                        {activeContact.extracted_service && (
                          <div style={{ display:'flex', justifyContent:'space-between', gap:8 }}>
                            <span style={{ fontSize:11.5, color:'var(--g-text-4)' }}>Service</span>
                            <span style={{ fontSize:11.5, color:'var(--g-text-2)', textAlign:'right' }}>{activeContact.extracted_service}</span>
                          </div>
                        )}
                        {activeContact.extracted_budget && (
                          <div style={{ display:'flex', justifyContent:'space-between', gap:8 }}>
                            <span style={{ fontSize:11.5, color:'var(--g-text-4)' }}>Budget</span>
                            <span style={{ fontSize:11.5, color:'var(--g-text-2)' }}>₹{Number(activeContact.extracted_budget).toLocaleString('en-IN')}</span>
                          </div>
                        )}
                        {activeContact.extracted_date && (
                          <div style={{ display:'flex', justifyContent:'space-between', gap:8 }}>
                            <span style={{ fontSize:11.5, color:'var(--g-text-4)' }}>Date</span>
                            <span style={{ fontSize:11.5, color:'var(--g-text-2)' }}>{activeContact.extracted_date}</span>
                          </div>
                        )}
                        {activeContact.extracted_location && (
                          <div style={{ display:'flex', justifyContent:'space-between', gap:8 }}>
                            <span style={{ fontSize:11.5, color:'var(--g-text-4)' }}>Location</span>
                            <span style={{ fontSize:11.5, color:'var(--g-text-2)' }}>{activeContact.extracted_location}</span>
                          </div>
                        )}
                      </div>
                    </section>
                  )}

                  {/* Tags */}
                  {activeContact.tags && activeContact.tags.length > 0 && (
                    <>
                      <div className="g-divider" />
                      <section>
                        <div className="g-label" style={{ marginBottom:8 }}>Tags</div>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                          {activeContact.tags.map((tag, i) => (
                            <span key={i} style={{
                              padding:'3px 8px', borderRadius:4,
                              border:'1px solid var(--g-border)',
                              fontSize:11, color:'var(--g-text-3)',
                              fontFamily:'var(--font-mono)',
                            }}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      </section>
                    </>
                  )}

                  <div className="g-divider" />

                  {/* Schedule follow-up */}
                  <section>
                    <div className="g-label" style={{ marginBottom:8 }}>Schedule Follow-up</div>
                    {reminders.length > 0 && (
                      <div style={{ marginBottom:10, padding:'8px 10px', borderRadius:5, background:'rgba(200,144,42,0.08)', border:'1px solid rgba(200,144,42,0.18)' }}>
                        {reminders.map(r => (
                          <div key={r.id} style={{ fontSize:11.5, color:'#CBA048' }}>
                            {new Date(r.due_at).toLocaleString([], { weekday:'short', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}
                            {r.note && <div style={{ color:'var(--g-text-3)', marginTop:2 }}>{r.note}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                    <input
                      type="datetime-local"
                      aria-label="Follow-up date and time"
                      value={scheduleDate}
                      onChange={e => setScheduleDate(e.target.value)}
                      onInput={e => setScheduleDate(e.currentTarget.value)}
                      style={{
                        width:'100%', marginBottom:6, padding:'7px 10px',
                        borderRadius:5, border:'1px solid var(--g-border)',
                        background:'var(--g-raised)', color:'var(--g-text-2)',
                        fontSize:11.5, fontFamily:'var(--font-sans)', outline:'none',
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Note (optional)"
                      value={scheduleNote}
                      onChange={e => setScheduleNote(e.target.value)}
                      style={{
                        width:'100%', marginBottom:8, padding:'7px 10px',
                        borderRadius:5, border:'1px solid var(--g-border)',
                        background:'var(--g-raised)', color:'var(--g-text-2)',
                        fontSize:11.5, fontFamily:'var(--font-sans)', outline:'none',
                      }}
                    />
                    <button
                      onClick={scheduleFollowup}
                      disabled={!scheduleDate || schedulingFollowup}
                      style={{
                        width:'100%', padding:'7px 0',
                        borderRadius:5, border:'1px solid var(--g-border)',
                        background:'transparent', color: scheduleDate ? 'var(--g-text)' : 'var(--g-text-4)',
                        fontSize:12, fontWeight:500, cursor: scheduleDate ? 'pointer' : 'default',
                        fontFamily:'var(--font-sans)', transition:'all 0.12s',
                      }}
                      onMouseEnter={e => { if (scheduleDate) { e.currentTarget.style.background='var(--g-hover)'; e.currentTarget.style.borderColor='var(--g-border-mid)'; } }}
                      onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='var(--g-border)'; }}
                    >
                      {schedulingFollowup ? 'Scheduling…' : 'Schedule follow-up'}
                    </button>
                  </section>
                </div>
              )}

              {/* ── AI SUMMARY TAB ── */}
              {tab === 'summary' && (
                <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                  <section>
                    <div className="g-label" style={{ marginBottom:10 }}>Grahak Summary</div>
                    {activeContact.ai_summary ? (
                      <div style={{
                        padding:'12px 14px',
                        borderRadius:6,
                        background:'var(--g-raised)',
                        border:'1px solid var(--g-border)',
                        fontSize:12.5,
                        color:'var(--g-text-2)',
                        lineHeight:1.65,
                        fontStyle:'italic',
                      }}>
                        &ldquo;{activeContact.ai_summary}&rdquo;
                      </div>
                    ) : (
                      <div style={{ fontSize:12, color:'var(--g-text-4)', fontStyle:'italic' }}>
                        AI summary will appear after messages are processed.
                      </div>
                    )}
                  </section>

                  {activeContact.extracted_service && (
                    <section>
                      <div className="g-label" style={{ marginBottom:8 }}>Extracted intent</div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                        {activeContact.extracted_service && (
                          <span style={{ padding:'4px 9px', borderRadius:4, background:'var(--g-raised)', border:'1px solid var(--g-border)', fontSize:11.5, color:'var(--g-text-2)' }}>
                            {activeContact.extracted_service}
                          </span>
                        )}
                        {activeContact.extracted_budget && (
                          <span style={{ padding:'4px 9px', borderRadius:4, background:'rgba(200,98,42,0.1)', border:'1px solid rgba(200,98,42,0.2)', fontSize:11.5, color:'var(--g-accent-light)' }}>
                            ₹{Number(activeContact.extracted_budget).toLocaleString('en-IN')}
                          </span>
                        )}
                        {activeContact.extracted_date && (
                          <span style={{ padding:'4px 9px', borderRadius:4, background:'var(--g-raised)', border:'1px solid var(--g-border)', fontSize:11.5, color:'var(--g-text-2)' }}>
                            {activeContact.extracted_date}
                          </span>
                        )}
                      </div>
                    </section>
                  )}

                  {/* Suggested reply */}
                  <section>
                    <div className="g-label" style={{ marginBottom:8 }}>Suggested reply</div>
                    <button
                      onClick={smartReply}
                      style={{
                        width:'100%', padding:'10px 12px',
                        borderRadius:5, border:'1px solid var(--g-border)',
                        background:'var(--g-raised)', color:'var(--g-text-2)',
                        fontSize:12, cursor:'pointer', fontFamily:'var(--font-sans)',
                        textAlign:'left', lineHeight:1.5, transition:'all 0.12s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor='var(--g-border-mid)'; e.currentTarget.style.color='var(--g-text)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor='var(--g-border)'; e.currentTarget.style.color='var(--g-text-2)'; }}
                    >
                      Draft a personalized reply based on their message →
                    </button>
                  </section>
                </div>
              )}

              {/* ── NOTES TAB ── */}
              {tab === 'notes' && (
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  <div>
                    <textarea
                      value={noteInput}
                      onChange={e => setNoteInput(e.target.value)}
                      placeholder="Add a private note about this customer…"
                      rows={3}
                      style={{
                        width:'100%', padding:'9px 12px',
                        borderRadius:5, border:'1px solid var(--g-border)',
                        background:'var(--g-raised)', color:'var(--g-text)',
                        fontSize:12.5, fontFamily:'var(--font-sans)',
                        resize:'vertical', outline:'none', lineHeight:1.5,
                        transition:'border-color 0.12s',
                      }}
                      onFocus={e => (e.currentTarget.style.borderColor = 'var(--g-border-focus)')}
                      onBlur={e => (e.currentTarget.style.borderColor = 'var(--g-border)')}
                    />
                    <button
                      onClick={saveNote}
                      disabled={!noteInput.trim()}
                      style={{
                        marginTop:6, width:'100%', padding:'7px 0',
                        borderRadius:5, border:'1px solid var(--g-border)',
                        background:'transparent', color: noteInput.trim() ? 'var(--g-text)' : 'var(--g-text-4)',
                        fontSize:12, fontWeight:500, cursor: noteInput.trim() ? 'pointer' : 'default',
                        fontFamily:'var(--font-sans)', transition:'all 0.12s',
                      }}
                    >
                      Save note
                    </button>
                  </div>
                  {notes.length > 0 && (
                    <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:4 }}>
                      {notes.map((n, i) => (
                        <div key={n.id || i} style={{
                          padding:'10px 12px', borderRadius:5,
                          background:'var(--g-raised)', border:'1px solid var(--g-border)',
                        }}>
                          <div style={{ fontSize:12, color:'var(--g-text-2)', lineHeight:1.5 }}>{n.body}</div>
                          <div style={{ fontSize:10, color:'var(--g-text-4)', fontFamily:'var(--font-mono)', marginTop:5 }}>
                            {new Date(n.created_at).toLocaleDateString([], { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {notes.length === 0 && (
                    <div style={{ fontSize:12, color:'var(--g-text-4)', fontStyle:'italic', paddingTop:4 }}>
                      No notes yet for this customer.
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <WhatsAppQRModal
        isOpen={showQR}
        onClose={() => setShowQR(false)}
        onConnected={() => {
          whatsappBridgeApi.getStatus()
            .then(b => setBridge({ connected:b.connected, phone:b.phone }))
            .catch(() => {});
        }}
      />
    </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'var(--g-bg)', color:'var(--g-text-3)', fontSize:13 }}>
        Loading inbox…
      </div>
    }>
      <InboxContent />
    </Suspense>
  );
}
