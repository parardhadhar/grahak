'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { authApi, dashboardApi, whatsappBridgeApi } from '@/lib/api';
import WhatsAppQRModal from '@/components/whatsapp/WhatsAppQRModal';
import toast from 'react-hot-toast';

/* nav items */
const NAV = [
  {
    href: '/overview',
    label: 'Overview',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="9" rx="1.5"/>
        <rect x="14" y="3" width="7" height="5" rx="1.5"/>
        <rect x="14" y="12" width="7" height="9" rx="1.5"/>
        <rect x="3" y="16" width="7" height="5" rx="1.5"/>
      </svg>
    ),
  },
  {
    href: '/dashboard',
    label: 'Inbox',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
    badgeKey: 'new_leads',
  },
  {
    href: '/contacts',
    label: 'Customers',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    href: '/reminders',
    label: 'Follow-ups',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
    badgeKey: 'pending_followups',
  },
];

function NavItem({ item, isActive, badge }: { item: typeof NAV[0]; isActive: boolean; badge?: string | null }) {
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      href={item.href}
      aria-current={isActive ? 'page' : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '7px 10px',
        borderRadius: 5,
        fontSize: 13,
        fontWeight: isActive ? 500 : 400,
        color: isActive ? 'var(--g-text)' : hovered ? '#C8C4BC' : 'var(--g-text-2)',
        background: isActive ? 'rgba(255,252,246,0.06)' : hovered ? 'rgba(255,252,246,0.025)' : 'transparent',
        textDecoration: 'none',
        transition: 'all 0.12s ease',
        gap: 10,
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        {/* active bar */}
        {isActive && (
          <span style={{
            position: 'absolute',
            left: 0,
            top: 6,
            bottom: 6,
            width: 2,
            borderRadius: '0 2px 2px 0',
            background: 'var(--g-accent-light)',
          }} />
        )}
        <span style={{ color: isActive ? 'var(--g-text)' : 'var(--g-text-3)', display: 'flex' }}>
          {item.icon}
        </span>
        <span>{item.label}</span>
      </div>
      {badge && (
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          fontWeight: 500,
          padding: '1px 5px',
          borderRadius: 4,
          background: isActive ? 'rgba(200,98,42,0.18)' : 'rgba(255,255,255,0.06)',
          color: isActive ? 'var(--g-accent-light)' : 'var(--g-text-3)',
        }}>
          {badge}
        </span>
      )}
    </Link>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [stats, setStats] = useState<{ new_leads?: number; pending_followups?: number } | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [bridge, setBridge] = useState<{ connected: boolean; phone: string | null }>({
    connected: false,
    phone: null,
  });

  useEffect(() => {
    if (user) {
      dashboardApi.get().then(r => setStats(r.data.stats)).catch(() => {});
    }
    const check = () => {
      whatsappBridgeApi.getStatus()
        .then(b => setBridge({ connected: b.connected, phone: b.phone }))
        .catch(() => {});
    };
    check();
    const iv = setInterval(check, 5000);
    return () => clearInterval(iv);
  }, [pathname, user]);

  async function handleLogout() {
    try { await authApi.logout(); } catch {}
    logout();
    router.push('/login');
    toast.success('Logged out.');
  }

  function fmtPhone(p: string | null) {
    if (!p) return '';
    const d = p.replace(/\D/g, '');
    if (d.length >= 10) {
      const n = d.slice(-10);
      return `+91 ${n.slice(0,5)} ${n.slice(5)}`;
    }
    return `+${d}`;
  }

  const firstLetter = (user?.full_name || 'G')[0].toUpperCase();

  return (
    <aside className="app-sidebar" style={{
      width: 'var(--sidebar-w)',
      minWidth: 'var(--sidebar-w)',
      height: '100vh',
      background: 'var(--g-surface)',
      borderRight: '1px solid var(--g-border)',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      zIndex: 40,
      userSelect: 'none',
      fontFamily: 'var(--font-sans)',
    }}>
      {/* ── Brand ── */}
      <div style={{ padding: '20px 16px 16px' }}>
        <Link href="/overview" style={{ display: 'block', textDecoration: 'none' }}>
          <div style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 24,
            fontWeight: 400,
            letterSpacing: '0.06em',
            color: 'var(--g-text)',
            lineHeight: 1,
          }}>
            GRAHAK.
          </div>
          <div style={{
            marginTop: 5,
            fontSize: 11,
            color: 'var(--g-text-3)',
            letterSpacing: '0.01em',
            lineHeight: 1.3,
          }}>
            apna WhatsApp, ab organized.
          </div>
        </Link>
      </div>

      {/* ── Divider ── */}
      <div className="g-divider" style={{ margin: '0 12px 12px' }} />

      {/* ── Navigation ── */}
      <nav style={{ padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
        {NAV.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/dashboard' && item.href !== '/overview' && pathname.startsWith(item.href));
          const badge = item.badgeKey === 'new_leads' && stats?.new_leads && stats.new_leads > 0
            ? String(stats.new_leads)
            : item.badgeKey === 'pending_followups' && stats?.pending_followups && stats.pending_followups > 0
            ? String(stats.pending_followups)
            : null;
          return <NavItem key={item.href} item={item} isActive={isActive} badge={badge} />;
        })}
        <Link className="mobile-nav-tool" href="/search" aria-label="Search">⌕</Link>
        <Link className="mobile-nav-tool" href="/settings" aria-label="Settings">⚙</Link>

        {/* ── WhatsApp section ── */}
        <div style={{ marginTop: 20 }}>
          <div style={{
            fontSize: 9.5,
            fontFamily: 'var(--font-mono)',
            color: 'var(--g-text-4)',
            textTransform: 'uppercase',
            letterSpacing: '0.09em',
            padding: '0 10px',
            marginBottom: 6,
          }}>
            WhatsApp
          </div>
          <button
            onClick={() => setShowQRModal(true)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 10px',
              borderRadius: 5,
              background: 'transparent',
              border: '1px solid var(--g-border)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.12s ease',
              fontFamily: 'var(--font-sans)',
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
            <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
              <div style={{
                fontSize: 12,
                fontWeight: 500,
                color: bridge.connected ? 'var(--g-text)' : 'var(--g-text-3)',
                fontFamily: 'var(--font-mono)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {bridge.connected ? fmtPhone(bridge.phone) || 'Connected' : 'Not paired'}
              </div>
              <div style={{ fontSize: 10, color: 'var(--g-text-4)', marginTop: 1 }}>
                {bridge.connected ? 'Tap to manage' : 'Scan QR to connect'}
              </div>
            </div>
          </button>
        </div>
      </nav>
      <Link href="/search" className="sidebar-search g-btn g-btn-ghost" style={{ margin: '8px 16px' }}>Search workspace</Link>

      {/* ── Bottom: Settings + Account ── */}
      <div style={{ padding: '8px 8px 16px', display: 'flex', flexDirection: 'column', gap: 1 }}>
        <div className="g-divider" style={{ margin: '0 4px 8px' }} />

        {/* Settings */}
        <Link
          href="/settings"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            padding: '7px 10px',
            borderRadius: 5,
            fontSize: 13,
            fontWeight: 400,
            color: pathname.startsWith('/settings') ? 'var(--g-text)' : 'var(--g-text-2)',
            background: pathname.startsWith('/settings') ? 'rgba(255,252,246,0.06)' : 'transparent',
            textDecoration: 'none',
            transition: 'all 0.12s ease',
          }}
          onMouseEnter={e => {
            if (!pathname.startsWith('/settings')) {
              e.currentTarget.style.background = 'rgba(255,252,246,0.025)';
              e.currentTarget.style.color = 'var(--g-text)';
            }
          }}
          onMouseLeave={e => {
            if (!pathname.startsWith('/settings')) {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--g-text-2)';
            }
          }}
        >
          <span style={{ color: 'var(--g-text-3)', display: 'flex' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </span>
          Settings
        </Link>

        {/* Account row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px 2px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <div style={{
              width: 24, height: 24,
              borderRadius: '50%',
              background: '#1c1510',
              border: '1px solid rgba(200,98,42,0.22)',
              color: 'var(--g-text)',
              fontSize: 10.5,
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              {firstLetter}
            </div>
            <div style={{ minWidth: 0, overflow: 'hidden' }}>
              <div style={{
                fontSize: 11.5,
                fontWeight: 500,
                color: 'var(--g-text)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {user?.full_name || 'Business Owner'}
              </div>
              <div style={{
                fontSize: 10,
                color: 'var(--g-text-4)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {user?.business_name || 'My Business'}
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Log out"
            style={{
              background: 'none', border: 'none',
              color: 'var(--g-text-4)', cursor: 'pointer',
              padding: 4, borderRadius: 4,
              display: 'flex', alignItems: 'center',
              transition: 'color 0.12s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--g-text-2)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--g-text-4)')}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </div>

      <WhatsAppQRModal
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
        onConnected={() => {
          whatsappBridgeApi.getStatus()
            .then(b => setBridge({ connected: b.connected, phone: b.phone }))
            .catch(() => {});
        }}
      />
    </aside>
  );
}
