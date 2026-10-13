'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { dashboardApi, remindersApi, whatsappBridgeApi, devApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { DashboardData, Contact, Reminder } from '@/types';
import WhatsAppQRModal from '@/components/whatsapp/WhatsAppQRModal';
import toast from 'react-hot-toast';

// ─── helpers ───────────────────────────────────────────────
function rel(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso), now = new Date();
  const s = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (s < 60) return 'Just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const dy = Math.floor(h / 24); if (dy === 1) return 'Yesterday';
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function initials(name?: string | null, phone?: string) {
  if (name?.trim()) {
    const p = name.trim().split(/\s+/);
    return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : name.slice(0,2).toUpperCase();
  }
  return phone ? phone.replace(/\D/g,'').slice(-2) : 'WA';
}

const statusLabel: Record<string,string> = {
  new_lead: 'New lead', follow_up_required: 'Follow-up',
  active_customer: 'Active', returning_customer: 'Returning',
  complaint: 'Complaint', closed: 'Closed', spam: 'Spam',
};

function statusBadgeStyle(s: string): { bg: string; color: string } {
  switch(s) {
    case 'new_lead':           return { bg:'rgba(200,98,42,0.12)',   color:'var(--g-accent-light)' };
    case 'follow_up_required': return { bg:'rgba(200,144,42,0.12)',  color:'#CBA048' };
    case 'active_customer':
    case 'returning_customer': return { bg:'rgba(61,140,94,0.12)',   color:'#52A874' };
    case 'complaint':          return { bg:'rgba(184,80,80,0.12)',   color:'#C86060' };
    default:                   return { bg:'rgba(255,255,255,0.05)', color:'#6A6560' };
  }
}

function fmtDue(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
  if (isToday) return `Today · ${time}`;
  return `${d.toLocaleDateString([], { weekday:'short', month:'short', day:'numeric' })} · ${time}`;
}

// ─── Avatar ─────────────────────────────────────────────────
const AVATAR_BGS = ['#231510','#13201a','#1a1824','#211808','#101e28','#201414'];
function Avatar({ name, phone, size=36 }: { name?:string|null; phone?:string; size?:number }) {
  const init = initials(name, phone);
  const hash = ((name || phone || '') + '').charCodeAt(0) % AVATAR_BGS.length;
  return (
    <div style={{
      width:size, height:size, borderRadius:'50%',
      background: AVATAR_BGS[hash],
      color:'var(--g-text-2)', fontSize: size*0.35,
      fontFamily:'var(--font-serif)', fontStyle:'italic',
      display:'flex', alignItems:'center', justifyContent:'center',
      flexShrink:0, border:'1px solid rgba(255,255,255,0.08)',
      userSelect:'none',
    }}>
      {init}
    </div>
  );
}

// ─── Metric strip ───────────────────────────────────────────
function MetricItem({ label, value, sub, accent }: { label:string; value:string|number; sub?:string; accent?:boolean }) {
  return (
    <div style={{ flex:1, minWidth:0, padding:'12px 20px', position:'relative' }}>
      <div style={{
        fontFamily:'var(--font-mono)',
        fontSize:9.5, letterSpacing:'0.08em', textTransform:'uppercase',
        color:'var(--g-text-4)', marginBottom:6,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily:'var(--font-serif)',
        fontSize:28, fontWeight:400, lineHeight:1,
        color: accent ? 'var(--g-accent-light)' : 'var(--g-text)',
        letterSpacing:'-0.01em',
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ marginTop:4, fontSize:11.5, color:'var(--g-text-3)', lineHeight:1.3 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ─── Conversation row ────────────────────────────────────────
function ConversationRow({ contact }: { contact:Contact }) {
  const [hov, setHov] = useState(false);
  const badge = statusBadgeStyle(contact.status);
  return (
    <Link
      href={`/dashboard?contact=${contact.id}`}
      style={{ textDecoration:'none', display:'block' }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <div style={{
        display:'flex', alignItems:'flex-start', gap:12,
        padding:'12px 16px',
        background: hov ? 'var(--g-hover)' : 'transparent',
        transition:'background 0.12s',
        borderBottom:'1px solid var(--g-border)',
      }}>
        <Avatar name={contact.display_name} phone={contact.whatsapp_number} size={34} />
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
            <div style={{ fontSize:13, fontWeight:500, color:'var(--g-text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              {contact.display_name || contact.whatsapp_number}
            </div>
            <div style={{ fontSize:11, color:'var(--g-text-4)', fontFamily:'var(--font-mono)', flexShrink:0 }}>
              {rel(contact.last_contacted_at)}
            </div>
          </div>
          <div style={{ marginTop:3, display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
            {contact.ai_summary ? (
              <div style={{
                fontSize:12, color:'var(--g-text-3)',
                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                flex:1, minWidth:0,
              }}>
                {contact.ai_summary.length > 80 ? contact.ai_summary.slice(0,80)+'…' : contact.ai_summary}
              </div>
            ) : (
              <div style={{ fontSize:12, color:'var(--g-text-4)', fontStyle:'italic' }}>No summary yet</div>
            )}
            <span style={{
              ...badge,
              padding:'2px 6px', borderRadius:4,
              fontSize:10, fontFamily:'var(--font-mono)', fontWeight:500,
              flexShrink:0,
            }}>
              {statusLabel[contact.status] || contact.status}
            </span>
          </div>
          {contact.extracted_service && (
            <div style={{ marginTop:3, fontSize:11, color:'var(--g-text-4)' }}>
              {contact.extracted_service}
              {contact.extracted_budget ? ` · ₹${Number(contact.extracted_budget).toLocaleString('en-IN')}` : ''}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

// ─── Follow-up card ──────────────────────────────────────────
function FollowUpCard({ reminder, onComplete }: { reminder:Reminder; onComplete:(id:string)=>void }) {
  const [completing, setCompleting] = useState(false);
  return (
    <div style={{
      padding:'12px 16px',
      borderBottom:'1px solid var(--g-border)',
    }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8 }}>
        <div style={{ minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:500, color:'var(--g-text)' }}>
            {reminder.contact_name || reminder.contact_whatsapp || 'Customer'}
          </div>
          {reminder.note && (
            <div style={{ marginTop:2, fontSize:12, color:'var(--g-text-3)', lineHeight:1.4 }}>
              {reminder.note}
            </div>
          )}
          <div style={{
            marginTop:5, fontSize:10.5,
            fontFamily:'var(--font-mono)', color:'var(--g-text-4)',
          }}>
            {fmtDue(reminder.due_at)}
          </div>
        </div>
        <button
          onClick={async () => {
            setCompleting(true);
            await onComplete(reminder.id);
            setCompleting(false);
          }}
          disabled={completing}
          style={{
            padding:'5px 10px', borderRadius:4,
            border:'1px solid var(--g-border)',
            background:'transparent', color:'var(--g-text-2)',
            fontSize:11, cursor:'pointer',
            fontFamily:'var(--font-sans)',
            transition:'all 0.12s',
            flexShrink:0,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(61,140,94,0.12)';
            e.currentTarget.style.borderColor = 'rgba(82,168,116,0.3)';
            e.currentTarget.style.color = '#52A874';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.borderColor = 'var(--g-border)';
            e.currentTarget.style.color = 'var(--g-text-2)';
          }}
        >
          {completing ? '...' : 'Done'}
        </button>
      </div>
    </div>
  );
}

// ─── Action row (new lead needs reply) ─────────────────────
function ActionCard({ contact }: { contact:Contact }) {
  const [hov, setHov] = useState(false);
  return (
    <div style={{
      padding:'12px 16px',
      borderBottom:'1px solid var(--g-border)',
    }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8 }}>
        <div style={{ minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:500, color:'var(--g-text)' }}>
            {contact.display_name || contact.whatsapp_number}
          </div>
          {contact.extracted_service && (
            <div style={{ marginTop:2, fontSize:12, color:'var(--g-text-3)' }}>
              {contact.extracted_service}
            </div>
          )}
          <div style={{
            marginTop:4, fontSize:10.5,
            fontFamily:'var(--font-mono)', color:'var(--g-text-4)',
          }}>
            {rel(contact.last_contacted_at)}
          </div>
        </div>
        <Link
          href={`/dashboard?contact=${contact.id}`}
          onMouseEnter={() => setHov(true)}
          onMouseLeave={() => setHov(false)}
          style={{
            padding:'5px 10px', borderRadius:4,
            border:'1px solid var(--g-border)',
            background: hov ? 'var(--g-hover)' : 'transparent',
            color:'var(--g-text-2)',
            fontSize:11,
            fontFamily:'var(--font-sans)',
            transition:'all 0.12s',
            textDecoration:'none',
            flexShrink:0,
            display:'flex', alignItems:'center', gap:4,
          }}
        >
          Reply <span style={{ fontSize:12 }}>→</span>
        </Link>
      </div>
    </div>
  );
}

// ─── Empty state ─────────────────────────────────────────────
function EmptyState({ onSeed, seeding }: { onSeed:()=>void; seeding:boolean }) {
  return (
    <div style={{
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      height:'100%', padding:'48px 32px',
      textAlign:'center',
    }}>
      {/* Subtle motif: 3 horizontal lines */}
      <div style={{ marginBottom:28, opacity:0.25 }}>
        {[80,120,60].map((w,i) => (
          <div key={i} style={{
            width:w, height:1, background:'var(--g-border-mid)',
            margin:'6px auto',
          }} />
        ))}
      </div>
      <div style={{
        fontFamily:'var(--font-serif)', fontSize:22,
        color:'var(--g-text)', fontWeight:400,
        lineHeight:1.2, marginBottom:12,
      }}>
        Your inbox is quiet.
      </div>
      <div style={{ fontSize:13, color:'var(--g-text-3)', lineHeight:1.7, maxWidth:320, marginBottom:28 }}>
        When a customer messages your WhatsApp, their conversation will appear here automatically.
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:10, alignItems:'center' }}>
        <button
          onClick={onSeed}
          disabled={seeding}
          style={{
            padding:'8px 18px', borderRadius:5,
            border:'1px solid var(--g-border)',
            background:'transparent', color:'var(--g-text-2)',
            fontSize:12, cursor:'pointer',
            fontFamily:'var(--font-sans)',
            transition:'all 0.15s',
            display:'flex', alignItems:'center', gap:6,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--g-hover)';
            e.currentTarget.style.borderColor = 'var(--g-border-mid)';
            e.currentTarget.style.color = 'var(--g-text)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.borderColor = 'var(--g-border)';
            e.currentTarget.style.color = 'var(--g-text-2)';
          }}
        >
          {seeding ? (
            <span style={{display:'flex',alignItems:'center',gap:6}}>
              <span className="animate-spin" style={{ display:'inline-block', width:11, height:11, border:'1.5px solid currentColor', borderTopColor:'transparent', borderRadius:'50%' }} />
              Loading…
            </span>
          ) : 'Load demo conversations'}
        </button>
        <div style={{ fontSize:10.5, color:'var(--g-text-4)' }}>
          Populates 5 realistic Indian business conversations
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton rows ───────────────────────────────────────────
function SkeletonRow() {
  return (
    <div style={{ display:'flex', gap:12, padding:'12px 16px', borderBottom:'1px solid var(--g-border)' }}>
      <div className="g-skeleton" style={{ width:34, height:34, borderRadius:'50%', flexShrink:0 }} />
      <div style={{ flex:1 }}>
        <div className="g-skeleton" style={{ width:'40%', height:12, marginBottom:6 }} />
        <div className="g-skeleton" style={{ width:'70%', height:10 }} />
      </div>
    </div>
  );
}

// ─── Main Overview page ─────────────────────────────────────
export default function OverviewPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showQRModal, setShowQRModal] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [bridge, setBridge] = useState<{ connected:boolean; phone:string|null; name:string|null }>({
    connected:false, phone:null, name:null,
  });

  const fetchAll = useCallback(async () => {
    try {
      const [dashRes, bRes] = await Promise.allSettled([
        dashboardApi.get(),
        whatsappBridgeApi.getStatus(),
      ]);
      if (dashRes.status === 'fulfilled') {
        setData(dashRes.value.data);
      }
      if (bRes.status === 'fulfilled') {
        setBridge(bRes.value);
      }
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const initial = setTimeout(() => void fetchAll(), 0);
    const iv = setInterval(fetchAll, 6000);
    return () => { clearTimeout(initial); clearInterval(iv); };
  }, [fetchAll]);

  const handleComplete = async (id: string) => {
    try {
      await remindersApi.complete(id);
      toast.success('Follow-up marked complete');
      fetchAll();
    } catch { toast.error('Failed to update'); }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await devApi.seed();
      toast.success('Demo conversations loaded!');
      await fetchAll();
    } catch { toast.error('Seeding failed. Is the backend running?'); }
    finally { setSeeding(false); }
  };

  // ── derived values ─────────────────────────────────────
  const stats = data?.stats;
  const conversations = data?.recent_conversations || [];
  const followups = data?.todays_followups || [];

  const totalContacts = stats?.total_contacts ?? conversations.length;
  const newLeads = stats?.new_leads ?? conversations.filter(c => c.status === 'new_lead').length;
  const pendingFollowups = stats?.pending_followups ?? followups.length;
  const activeCount = stats?.active_conversations ?? conversations.filter(c =>
    ['active_customer','returning_customer'].includes(c.status)
  ).length;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.full_name?.trim().split(' ')[0] || 'there';
  const urgentCount = newLeads + pendingFollowups;

  // new leads needing reply
  const needsReply = conversations.filter(c => c.status === 'new_lead').slice(0,3);

  const isEmpty = !loading && conversations.length === 0;

  return (
    <div className="g-page" style={{ fontFamily:'var(--font-sans)' }}>
      <div style={{ padding:'28px 40px 48px', maxWidth:1200, margin:'0 auto' }}>

        {/* ── PAGE HEADER ─────────────────────────────────────── */}
        <header style={{
          display:'flex', alignItems:'flex-start', justifyContent:'space-between',
          paddingBottom:20, borderBottom:'1px solid var(--g-border)', marginBottom:24,
        }}>
          <div>
            <h1 style={{
              fontFamily:'var(--font-serif)', fontSize:24, fontWeight:400,
              color:'var(--g-text)', letterSpacing:'-0.01em', margin:0, lineHeight:1.15,
            }}>
              Overview
            </h1>
            <div style={{ marginTop:7, fontSize:13, color:'var(--g-text-3)', lineHeight:1.5 }}>
              <span style={{ color:'var(--g-text-2)', fontWeight:500 }}>{greeting}, {firstName}.</span>{' '}
              {loading ? (
                <span>Loading your workspace…</span>
              ) : urgentCount > 0 ? (
                <span>
                  <span style={{ color:'var(--g-accent-light)', fontWeight:500 }}>
                    {urgentCount} conversation{urgentCount !== 1 ? 's' : ''}
                  </span>{' '}
                  need your attention today.
                </span>
              ) : (
                <span>All conversations are up to date.</span>
              )}
            </div>
          </div>

          {/* Top-right: WA status + action */}
          <div style={{ display:'flex', alignItems:'center', gap:16, flexShrink:0 }}>
            {/* WhatsApp status pill */}
            <button
              onClick={() => setShowQRModal(true)}
              style={{
                display:'flex', alignItems:'center', gap:6,
                padding:'6px 12px', borderRadius:5,
                border:'1px solid var(--g-border)',
                background:'transparent',
                cursor:'pointer', transition:'all 0.12s',
                fontFamily:'var(--font-sans)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--g-hover)';
                e.currentTarget.style.borderColor = 'var(--g-border-mid)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = 'var(--g-border)';
              }}
            >
              <span className="g-dot" style={{
                background: bridge.connected ? 'var(--g-green-dot)' : 'var(--g-text-4)',
              }} />
              <span style={{
                fontSize:12, color: bridge.connected ? 'var(--g-text-2)' : 'var(--g-text-3)',
                fontFamily:'var(--font-mono)',
              }}>
                {bridge.connected ? 'WhatsApp · Connected' : 'WhatsApp · Not paired'}
              </span>
            </button>

            {/* Open Inbox */}
            <Link
              href="/dashboard"
              style={{
                display:'inline-flex', alignItems:'center', gap:5,
                padding:'7px 14px', borderRadius:5,
                background:'var(--g-raised)',
                border:'1px solid var(--g-border-mid)',
                color:'var(--g-text)', fontSize:12.5, fontWeight:500,
                textDecoration:'none', transition:'all 0.12s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--g-hover)';
                e.currentTarget.style.borderColor = 'var(--g-border-focus)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'var(--g-raised)';
                e.currentTarget.style.borderColor = 'var(--g-border-mid)';
              }}
            >
              Open Inbox <span>→</span>
            </Link>
          </div>
        </header>

        {/* ── METRICS STRIP ───────────────────────────────────── */}
        {!loading && (
          <div style={{
            display:'flex',
            border:'1px solid var(--g-border)',
            borderRadius:6,
            overflow:'hidden',
            marginBottom:28,
            background:'var(--g-surface)',
          }}>
            <MetricItem label="Customers" value={totalContacts} sub={totalContacts > 0 ? 'total contacts' : 'Connect WhatsApp to start'} />
            <div style={{ width:1, background:'var(--g-border)' }} />
            <MetricItem label="New leads" value={newLeads} sub={newLeads > 0 ? 'need a reply' : 'none pending'} accent={newLeads > 0} />
            <div style={{ width:1, background:'var(--g-border)' }} />
            <MetricItem label="Follow-ups" value={pendingFollowups} sub={pendingFollowups > 0 ? 'awaiting follow-up' : 'all caught up'} accent={pendingFollowups > 0} />
            <div style={{ width:1, background:'var(--g-border)' }} />
            <MetricItem label="Active" value={activeCount} sub="ongoing conversations" />
          </div>
        )}

        {loading && (
          <div style={{
            height:90,
            border:'1px solid var(--g-border)',
            borderRadius:6,
            marginBottom:28,
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <div className="g-skeleton" style={{ width:200, height:10, borderRadius:4 }} />
          </div>
        )}

        {/* ── MAIN 65/35 SPLIT ────────────────────────────────── */}
        <div className="overview-columns" style={{
          display:'grid',
          gridTemplateColumns:'1fr 300px',
          gap:20,
          alignItems:'start',
        }}>

          {/* ── LEFT: RECENT CONVERSATIONS ── */}
          <section>
            <div style={{
              display:'flex', alignItems:'center', justifyContent:'space-between',
              marginBottom:12,
            }}>
              <div style={{
                fontFamily:'var(--font-mono)',
                fontSize:10, letterSpacing:'0.08em', textTransform:'uppercase',
                color:'var(--g-text-4)',
              }}>
                Recent conversations
              </div>
              {conversations.length > 0 && (
                <Link
                  href="/dashboard"
                  style={{ fontSize:11.5, color:'var(--g-text-3)', textDecoration:'none', transition:'color 0.12s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--g-text)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--g-text-3)')}
                >
                  View all →
                </Link>
              )}
            </div>

            <div style={{
              border:'1px solid var(--g-border)',
              borderRadius:6,
              overflow:'hidden',
              background:'var(--g-surface)',
              minHeight:300,
            }}>
              {loading ? (
                <>
                  <SkeletonRow/><SkeletonRow/><SkeletonRow/><SkeletonRow/>
                </>
              ) : isEmpty ? (
                <EmptyState onSeed={handleSeed} seeding={seeding} />
              ) : (
                conversations.slice(0,8).map((c, i) => (
                  <ConversationRow key={c.id || i} contact={c} />
                ))
              )}
            </div>
          </section>

          {/* ── RIGHT: TODAY COLUMN ─────────────────── */}
          <aside style={{ display:'flex', flexDirection:'column', gap:16 }}>

            {/* ── Needs reply ── */}
            {needsReply.length > 0 && (
              <div>
                <div style={{
                  fontFamily:'var(--font-mono)', fontSize:10,
                  letterSpacing:'0.08em', textTransform:'uppercase',
                  color:'var(--g-text-4)', marginBottom:10,
                }}>
                  Needs reply
                </div>
                <div style={{
                  border:'1px solid var(--g-border)',
                  borderRadius:6, overflow:'hidden',
                  background:'var(--g-surface)',
                }}>
                  {needsReply.map((c, i) => (
                    <ActionCard key={c.id || i} contact={c} />
                  ))}
                </div>
              </div>
            )}

            {/* ── Follow-ups today ── */}
            <div>
              <div style={{
                fontFamily:'var(--font-mono)', fontSize:10,
                letterSpacing:'0.08em', textTransform:'uppercase',
                color:'var(--g-text-4)', marginBottom:10,
              }}>
                Follow-ups today
              </div>
              <div style={{
                border:'1px solid var(--g-border)',
                borderRadius:6, overflow:'hidden',
                background:'var(--g-surface)',
              }}>
                {loading ? (
                  <SkeletonRow />
                ) : followups.length === 0 ? (
                  <div style={{ padding:'20px 16px', textAlign:'center' }}>
                    <div style={{ fontSize:12, color:'var(--g-text-4)', lineHeight:1.6 }}>
                      No follow-ups today.<br/>
                      <span style={{ color:'var(--g-text-3)' }}>You&apos;re all caught up.</span>
                    </div>
                  </div>
                ) : (
                  followups.slice(0,4).map((r,i) => (
                    <FollowUpCard key={r.id || i} reminder={r} onComplete={handleComplete} />
                  ))
                )}
              </div>
              {followups.length > 0 && (
                <Link
                  href="/reminders"
                  style={{
                    display:'block', marginTop:8, textAlign:'center',
                    fontSize:11.5, color:'var(--g-text-4)', textDecoration:'none',
                    transition:'color 0.12s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--g-text-2)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--g-text-4)')}
                >
                  All follow-ups →
                </Link>
              )}
            </div>

            {/* ── WhatsApp module ── */}
            {!bridge.connected && !loading && (
              <div style={{
                border:'1px solid var(--g-border)',
                borderRadius:6, padding:'16px',
                background:'var(--g-surface)',
              }}>
                <div style={{
                  fontFamily:'var(--font-mono)', fontSize:9.5,
                  letterSpacing:'0.08em', textTransform:'uppercase',
                  color:'var(--g-text-4)', marginBottom:10,
                }}>
                  WhatsApp
                </div>
                <div style={{ fontSize:12.5, color:'var(--g-text-3)', lineHeight:1.6, marginBottom:12 }}>
                  Connect your WhatsApp to start receiving customer messages automatically.
                </div>
                <button
                  onClick={() => setShowQRModal(true)}
                  style={{
                    width:'100%', padding:'8px 0',
                    borderRadius:5, border:'1px solid var(--g-border)',
                    background:'transparent', color:'var(--g-text)',
                    fontSize:12, fontWeight:500, cursor:'pointer',
                    fontFamily:'var(--font-sans)', transition:'all 0.12s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'var(--g-hover)';
                    e.currentTarget.style.borderColor = 'var(--g-border-mid)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderColor = 'var(--g-border)';
                  }}
                >
                  Connect WhatsApp
                </button>
              </div>
            )}
          </aside>
        </div>
      </div>

      <WhatsAppQRModal
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
        onConnected={() => {
          whatsappBridgeApi.getStatus()
            .then(b => setBridge(b))
            .catch(() => {});
        }}
      />
    </div>
  );
}
