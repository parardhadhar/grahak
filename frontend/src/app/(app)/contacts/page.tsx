'use client';
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { contactsApi } from '@/lib/api';
import { Contact, ContactStatus } from '@/types';

function fmtTime(iso: string): string {
  const d = new Date(iso), now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return d.toLocaleDateString([], { weekday:'short' });
  return d.toLocaleDateString([], { day:'numeric', month:'short' });
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
function Avatar({ name, phone, size=36 }: { name?:string|null; phone?:string; size?:number }) {
  const init = initials(name, phone);
  const hash = ((name||phone||'').charCodeAt(0)) % AVATAR_BGS.length;
  return (
    <div style={{
      width:size, height:size, borderRadius:'50%',
      background:AVATAR_BGS[hash], color:'var(--g-text-2)',
      fontSize:size*0.34, fontFamily:'var(--font-serif)', fontStyle:'italic',
      display:'flex', alignItems:'center', justifyContent:'center',
      flexShrink:0, border:'1px solid rgba(255,255,255,0.08)', userSelect:'none',
    }}>{init}</div>
  );
}

const TABS: { label: string; value: ContactStatus | 'all' }[] = [
  { label:'All', value:'all' },
  { label:'New leads', value:'new_lead' },
  { label:'Follow-up', value:'follow_up_required' },
  { label:'Active', value:'active_customer' },
  { label:'Returning', value:'returning_customer' },
];

function ContactsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = (searchParams.get('status') || 'all') as ContactStatus | 'all';
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');

  useEffect(() => {
    const initial = setTimeout(() => { setLoading(true); setError(''); }, 0);
    let cancelled = false;
    contactsApi.list({
      status: status === 'all' ? undefined : status,
      page_size: 100,
      page,
      search: search || undefined,
    })
      .then(r => { if (!cancelled) { setContacts(r.data.contacts); setTotal(r.data.total); } })
      .catch(() => { if (!cancelled) setError('Customers could not be loaded. Check your connection and try again.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; clearTimeout(initial); };
  }, [status, search, page]);

  return (
    <div className="g-page" style={{ fontFamily:'var(--font-sans)' }}>
      <div style={{ padding:'28px 40px 48px', maxWidth:1200, margin:'0 auto' }}>

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
              Customers
            </h1>
            <div style={{ marginTop:6, fontSize:13, color:'var(--g-text-3)' }}>
              {loading ? 'Loading…' : `${total} total customer${total !== 1 ? 's' : ''}`}
            </div>
          </div>
          {/* Search */}
          <div style={{
            display:'flex', alignItems:'center', gap:8,
            padding:'8px 12px', borderRadius:5,
            border:'1px solid var(--g-border)',
            background:'var(--g-surface)', width:240,
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--g-text-4)" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              placeholder="Search customers…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              style={{
                background:'transparent', border:'none', outline:'none',
                fontSize:12.5, color:'var(--g-text)', width:'100%',
                fontFamily:'var(--font-sans)',
              }}
            />
          </div>
        </header>
        {error && <p role="alert" className="connection-error">{error}</p>}

        {/* Filter tabs */}
        <div className="customer-tabs" style={{ display:'flex', gap:0, borderBottom:'1px solid var(--g-border)', marginBottom:24 }}>
          {TABS.map(t => (
            <button
              key={t.value}
              onClick={() => { setPage(1); router.push(`/contacts${t.value==='all' ? '' : `?status=${t.value}`}`); }}
              style={{
                padding:'8px 16px', fontSize:12, background:'transparent', border:'none',
                borderBottom: status===t.value ? '2px solid var(--g-accent-light)' : '2px solid transparent',
                color: status===t.value ? 'var(--g-text)' : 'var(--g-text-3)',
                fontWeight: status===t.value ? 500 : 400,
                cursor:'pointer', transition:'all 0.12s',
                fontFamily:'var(--font-sans)', marginBottom:-1,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div>
            {Array.from({length:6}).map((_,i) => (
              <div key={i} style={{ display:'flex', gap:12, padding:'14px 16px', borderBottom:'1px solid var(--g-border)', alignItems:'center' }}>
                <div className="g-skeleton" style={{ width:36, height:36, borderRadius:'50%' }} />
                <div style={{ flex:1 }}>
                  <div className="g-skeleton" style={{ width:'25%', height:12, marginBottom:6 }} />
                  <div className="g-skeleton" style={{ width:'40%', height:10 }} />
                </div>
                <div className="g-skeleton" style={{ width:80, height:20, borderRadius:4 }} />
              </div>
            ))}
          </div>
        ) : contacts.length === 0 ? (
          <div style={{
            padding:'64px 0', textAlign:'center',
          }}>
            <div style={{ fontFamily:'var(--font-serif)', fontSize:18, color:'var(--g-text)', marginBottom:8 }}>
              No customers found.
            </div>
            <div style={{ fontSize:13, color:'var(--g-text-4)' }}>
              {search ? 'Try a different search.' : 'Connect WhatsApp and customers will appear here automatically.'}
            </div>
          </div>
        ) : (
          <div className="customer-table" style={{ border:'1px solid var(--g-border)', borderRadius:6, overflow:'hidden', background:'var(--g-surface)' }}>
            {/* Table header */}
            <div style={{
              display:'grid', gridTemplateColumns:'2fr 1.5fr 1fr 0.8fr 0.8fr',
              padding:'10px 16px',
              borderBottom:'1px solid var(--g-border)',
              background:'var(--g-raised)',
            }}>
              {['Customer','Last conversation','Status','Value','Messages'].map(h => (
                <div key={h} style={{
                  fontSize:10, fontFamily:'var(--font-mono)',
                  letterSpacing:'0.07em', textTransform:'uppercase',
                  color:'var(--g-text-4)',
                }}>
                  {h}
                </div>
              ))}
            </div>

            {/* Rows */}
            {contacts.map(c => {
              const st = statusStyle(c.status);
              return (
                <Link
                  key={c.id}
                  className="customer-row"
                  href={`/dashboard?contact=${c.id}`}
                  style={{
                    display:'grid', gridTemplateColumns:'2fr 1.5fr 1fr 0.8fr 0.8fr',
                    padding:'12px 16px', textDecoration:'none',
                    borderBottom:'1px solid var(--g-border)',
                    transition:'background 0.12s', alignItems:'center',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.background = 'var(--g-hover)'}
                  onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'}
                >
                  {/* Customer */}
                  <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
                    <Avatar name={c.display_name} phone={c.whatsapp_number} size={32} />
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:500, color:'var(--g-text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {c.display_name || c.whatsapp_number}
                      </div>
                      <div style={{ fontSize:11, color:'var(--g-text-4)', fontFamily:'var(--font-mono)', marginTop:1 }}>
                        {c.whatsapp_number}
                      </div>
                    </div>
                  </div>

                  {/* Last conversation */}
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:12, color:'var(--g-text-2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {c.extracted_service || c.ai_summary?.slice(0,40) || '—'}
                    </div>
                    <div style={{ fontSize:11, color:'var(--g-text-4)', fontFamily:'var(--font-mono)', marginTop:2 }}>
                      {fmtTime(c.last_contacted_at)}
                    </div>
                  </div>

                  {/* Status */}
                  <div>
                    <span style={{
                      ...st, padding:'3px 8px', borderRadius:4,
                      fontSize:10, fontFamily:'var(--font-mono)', fontWeight:500,
                      display:'inline-block',
                    }}>
                      {STATUS_LABEL[c.status] || c.status}
                    </span>
                  </div>

                  {/* Budget value */}
                  <div style={{ fontSize:12, color: c.extracted_budget ? 'var(--g-text-2)' : 'var(--g-text-4)' }}>
                    {c.extracted_budget ? `₹${Number(c.extracted_budget).toLocaleString('en-IN')}` : '—'}
                  </div>

                  {/* Message count */}
                  <div style={{ fontSize:12, color:'var(--g-text-3)', fontFamily:'var(--font-mono)' }}>
                    {c.message_count || 0}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
        {total > 100 && <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:20}}><button className="g-btn g-btn-ghost" disabled={page===1} onClick={() => setPage(p=>p-1)}>Previous</button><span>Page {page} of {Math.ceil(total/100)}</span><button className="g-btn g-btn-ghost" disabled={page*100>=total} onClick={() => setPage(p=>p+1)}>Next</button></div>}
      </div>
    </div>
  );
}

export default function ContactsPage() {
  return (
    <Suspense fallback={
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', fontSize:13, color:'var(--g-text-3)' }}>
        Loading customers…
      </div>
    }>
      <ContactsContent />
    </Suspense>
  );
}
