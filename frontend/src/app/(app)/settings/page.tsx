'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { businessApi, devApi, whatsappBridgeApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Business } from '@/types';
import WhatsAppQRModal from '@/components/whatsapp/WhatsAppQRModal';
import LuxuryLoader from '@/components/ui/LuxuryLoader';

const serif = "var(--font-serif)";
const mono = "var(--font-mono)";
const sans = "var(--font-sans)";
const ACCENT = 'var(--g-accent-light)';
const BG = 'var(--g-bg)';


export default function SettingsPage() {
  const { user } = useAuth();
  const [business, setBusiness] = useState<Business | null>(null);
  const [status, setStatus] = useState<{dev_mode?:boolean; ai?:{available:boolean; model?:string; provider?:string}} | null>(null);
  const [bridgeStatus, setBridgeStatus] = useState<{ connected: boolean; phone: string | null }>({ connected: false, phone: null });
  const [loading, setLoading] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);

  async function fetchSettings() {
    try {
      const [bResp, sResp, bridgeResp] = await Promise.all([
        businessApi.getProfile().catch(() => ({ data: null })),
        businessApi.getStatus().catch(() => ({ data: null })),
        whatsappBridgeApi.getStatus().catch(() => ({ connected: false, phone: null })),
      ]);
      setBusiness(bResp.data);
      setStatus(sResp.data);
      setBridgeStatus(bridgeResp);
    } catch {
      toast.error('Failed to load settings.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const initial = setTimeout(() => void fetchSettings(), 0);
    const interval = setInterval(async () => {
      try {
        const b = await whatsappBridgeApi.getStatus();
        setBridgeStatus(b);
      } catch {}
    }, 4000);
    return () => { clearTimeout(initial); clearInterval(interval); };
  }, []);

  async function handleReset() {
    if (!confirmReset) {
      setConfirmReset(true);
      setTimeout(() => setConfirmReset(false), 5000);
      toast('Click again within 5s to permanently wipe all CRM data.', { icon: '⚠️' });
      return;
    }

    setConfirmReset(false);
    setIsResetting(true);
    const toastId = toast.loading('Clearing all CRM data…');
    try {
      await devApi.reset();
      toast.success('CRM completely cleared. Ready for real WhatsApp chats.', { id: toastId });
      await fetchSettings();
    } catch {
      toast.error('Reset failed.', { id: toastId });
    } finally {
      setIsResetting(false);
    }
  }

  async function handleSeed() {
    setIsSeeding(true);
    const toastId = toast.loading('Loading sample high-touch leads…');
    try {
      const resp = await devApi.seed();
      toast.success(resp.data.message || 'Demo data loaded.', { id: toastId });
      await fetchSettings();
    } catch {
      toast.error('Seed failed.', { id: toastId });
    } finally {
      setIsSeeding(false);
    }
  }

  if (loading) {
    return <LuxuryLoader title="Loading Settings…" subtitle="Retrieving account and bridge status" />;
  }

  return (
    <div className="g-page settings-page" style={{
      flex: 1,
      minHeight: '100vh',
      background: BG,
      color: '#f2ede7',
      fontFamily: sans,
      padding: '36px 48px 60px',
      overflowY: 'auto',
    }}>
      {/* ── HEADER ── */}
      <div style={{
        marginBottom: 36,
        paddingBottom: 24,
        borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
      }}>
        <div style={{ fontFamily: mono, fontSize: 11, color: '#8a837c', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
          Configuration & Integrations
        </div>
        <h1 style={{ fontFamily: serif, fontSize: 36, fontWeight: 400, color: '#f5f0eb', margin: 0, letterSpacing: '-0.02em' }}>
          Settings.
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: '#8a837c' }}>
          Manage your WhatsApp bridge pairing, AI qualification models, and business identity.
        </p>
      </div>

      <div style={{ maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 32 }}>

        {/* ── WHATSAPP QR COMPANION (PRIMARY) ── */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(212, 107, 46, 0.12) 0%, rgba(20, 14, 10, 0.85) 100%)',
          border: '1px solid rgba(212, 107, 46, 0.35)',
          borderRadius: 12,
          padding: '24px 28px',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 22 }}>📱</span>
                <h2 style={{ fontFamily: serif, fontSize: 20, margin: 0, color: '#f5f0eb', fontWeight: 500 }}>
                  WhatsApp Direct Linking (Scan QR)
                </h2>
                <span style={{
                  fontSize: 10,
                  fontFamily: mono,
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: 4,
                  background: bridgeStatus.connected ? 'rgba(52, 211, 153, 0.15)' : 'rgba(212, 107, 46, 0.2)',
                  color: bridgeStatus.connected ? '#34d399' : '#e58e4e',
                  border: `1px solid ${bridgeStatus.connected ? 'rgba(52, 211, 153, 0.4)' : 'rgba(212, 107, 46, 0.4)'}`,
                }}>
                  {bridgeStatus.connected ? 'LINKED & ACTIVE' : 'NOT LINKED'}
                </span>
              </div>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: '#a8a098', lineHeight: 1.5 }}>
                {bridgeStatus.connected
                  ? `Your personal or business WhatsApp is connected (+${bridgeStatus.phone}). Real client inquiries will automatically flow into Grahak with AI parsing.`
                  : 'Link your phone just like WhatsApp Web. No Meta developer account or test numbers needed. Keep your WhatsApp app running normally on your phone.'}
              </p>
            </div>

            <button
              onClick={() => setShowQRModal(true)}
              style={{
                padding: '10px 20px',
                borderRadius: 8,
                background: bridgeStatus.connected ? 'rgba(255, 255, 255, 0.08)' : ACCENT,
                border: bridgeStatus.connected ? '1px solid rgba(255, 255, 255, 0.2)' : 'none',
                color: '#ffffff',
                fontSize: 13,
                fontWeight: 600,
                fontFamily: sans,
                cursor: 'pointer',
                flexShrink: 0,
                boxShadow: bridgeStatus.connected ? 'none' : '0 4px 16px rgba(212, 107, 46, 0.4)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span>{bridgeStatus.connected ? 'Manage / Change Phone' : 'Scan QR Code'}</span>
              <span>→</span>
            </button>
          </div>
        </div>

        {/* ── SECTION 01: BUSINESS PROFILE ── */}
        <section style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.07)',
          borderRadius: 12,
          padding: '24px 28px',
        }}>
          <h2 style={{
            fontFamily: mono,
            fontSize: 10,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#8a837c',
            margin: '0 0 20px',
            paddingBottom: 10,
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          }}>
            01 // Business Profile
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
            {[
              { label: 'Business Name', value: business?.name || 'My Creative Studio' },
              { label: 'Category', value: business?.category || 'Event Planning & Photography' },
              { label: 'Owner Name', value: business?.owner_name || user?.full_name || 'Parardha Dhar' },
              { label: 'Paired Phone', value: bridgeStatus.phone ? `+${bridgeStatus.phone}` : (business?.whatsapp_number || 'Not connected') },
              { label: 'Current Plan', value: (business?.plan?.toUpperCase() || 'FOUNDER PRO') },
            ].map((item, idx) => (
              <div key={idx} style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '12px 16px', borderRadius: 8, border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                <div style={{ fontFamily: mono, fontSize: 10, color: '#7a746e', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                  {item.label}
                </div>
                <div style={{ fontSize: 15, fontWeight: 500, color: '#f0eae3' }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── SECTION 02: AI INTELLIGENCE ── */}
        <section style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.07)',
          borderRadius: 12,
          padding: '24px 28px',
        }}>
          <h2 style={{
            fontFamily: mono,
            fontSize: 10,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#8a837c',
            margin: '0 0 20px',
            paddingBottom: 10,
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          }}>
            02 // AI Extraction Engine
          </h2>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 500, color: '#f0eae3', marginBottom: 4 }}>
                {status?.ai?.available ? `Groq AI · ${status.ai.model || 'Configured model'}` : 'Local classification'}
              </div>
              <div style={{ fontSize: 13, color: '#8a837c', lineHeight: 1.5 }}>
                Customer intent, summaries, budget, dates, and suggested follow-ups.
              </div>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              borderRadius: 999,
              background: 'rgba(52, 211, 153, 0.12)',
              border: '1px solid rgba(52, 211, 153, 0.3)',
              fontFamily: mono,
              fontSize: 11,
              color: '#34d399',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399' }} />
              {status?.ai?.available ? 'CONFIGURED' : 'LOCAL FALLBACK'}
            </div>
          </div>
        </section>

        {/* ── SECTION 03: DEVELOPER TOOLS ── */}
        {status?.dev_mode && <section style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.07)',
          borderRadius: 12,
          padding: '24px 28px',
        }}>
          <h2 style={{
            fontFamily: mono,
            fontSize: 10,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#8a837c',
            margin: '0 0 20px',
            paddingBottom: 10,
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          }}>
            03 // Data Controls
          </h2>

          <div style={{ display: 'flex', gap: 14 }}>
            <button
              onClick={handleSeed}
              disabled={isSeeding || isResetting}
              style={{
                padding: '10px 18px',
                borderRadius: 8,
                background: isSeeding ? 'rgba(212, 107, 46, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: isSeeding ? '#e58e4e' : '#e0d8ce',
                fontSize: 12,
                fontFamily: mono,
                cursor: isSeeding || isResetting ? 'not-allowed' : 'pointer',
                letterSpacing: '0.06em',
                transition: 'all 0.15s ease',
                opacity: isSeeding || isResetting ? 0.6 : 1,
              }}
            >
              {isSeeding ? '✦ SEEDING PIPELINE…' : 'LOAD DEMO LEADS'}
            </button>
            <button
              onClick={handleReset}
              disabled={isSeeding || isResetting}
              style={{
                padding: '10px 18px',
                borderRadius: 8,
                background: isResetting
                  ? 'rgba(220, 80, 80, 0.25)'
                  : confirmReset
                  ? 'rgba(220, 80, 80, 0.45)'
                  : 'rgba(220, 80, 80, 0.08)',
                border: `1px solid ${confirmReset ? '#ff4d4d' : 'rgba(220, 80, 80, 0.25)'}`,
                color: confirmReset ? '#ffffff' : '#e06060',
                fontWeight: confirmReset ? 600 : 400,
                fontSize: 12,
                fontFamily: mono,
                cursor: isSeeding || isResetting ? 'not-allowed' : 'pointer',
                letterSpacing: '0.06em',
                transition: 'all 0.15s ease',
                opacity: isSeeding || isResetting ? 0.6 : 1,
                boxShadow: confirmReset ? '0 0 16px rgba(220, 80, 80, 0.4)' : 'none',
              }}
            >
              {isResetting
                ? '✦ CLEARING DATABASE…'
                : confirmReset
                ? '⚠️ CONFIRM: CLICK TO WIPE ALL'
                : 'RESET ALL CRM DATA'}
            </button>
          </div>
        </section>}

      </div>

      <WhatsAppQRModal
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
        onConnected={() => fetchSettings()}
      />
    </div>
  );
}
