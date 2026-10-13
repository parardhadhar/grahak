'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { MessageSquare, ArrowRight, Check, Briefcase, User, Phone, Wifi } from 'lucide-react';
import { businessApi } from '@/lib/api';

const CATEGORIES = [
  'Photography', 'Salon & Spa', 'Tutor / Education', 'Freelancer',
  'Consultant', 'Repair Shop', 'Agency', 'Retailer',
  'Clinic / Healthcare', 'Event Management', 'Catering', 'Other',
];

const STEPS = [
  { id: 1, icon: Briefcase, title: 'Business Category', desc: 'What type of business do you run?' },
  { id: 2, icon: User, title: 'Your Name', desc: 'How should we address you?' },
  { id: 3, icon: Phone, title: 'WhatsApp Number', desc: 'Your WhatsApp Business number.' },
  { id: 4, icon: Wifi, title: 'Connect WhatsApp', desc: 'Link your WhatsApp Business account.' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleNext() {
    setLoading(true);
    try {
      if (step === 1) {
        if (!category) { toast.error('Please select your business category.'); setLoading(false); return; }
        await businessApi.updateOnboarding({ step: 'business_category', business_category: category });
        setStep(2);
      } else if (step === 2) {
        if (!ownerName.trim()) { toast.error('Please enter your name.'); setLoading(false); return; }
        await businessApi.updateOnboarding({ step: 'owner_name', owner_name: ownerName });
        setStep(3);
      } else if (step === 3) {
        if (!whatsappNumber.trim()) { toast.error('Please enter your WhatsApp number.'); setLoading(false); return; }
        await businessApi.updateOnboarding({ step: 'whatsapp_number', whatsapp_number: whatsappNumber });
        setStep(4);
      } else if (step === 4) {
        await businessApi.updateOnboarding({ step: 'connect_whatsapp' });
        toast.success('Setup complete! Welcome to Grahak 🎉');
        router.push('/dashboard');
      }
    } catch { toast.error('Something went wrong.'); }
    finally { setLoading(false); }
  }

  const currentStep = STEPS[step - 1];
  const Icon = currentStep.icon;

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-base)', padding: 20,
    }}>
      <div style={{ width: '100%', maxWidth: 520 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 40, justifyContent: 'center' }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MessageSquare size={18} color="white" />
          </div>
          <span style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 20 }}>Grahak</span>
        </div>

        {/* Progress */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 32 }}>
          {STEPS.map((s) => (
            <div key={s.id} style={{
              flex: 1, height: 4, borderRadius: 2,
              background: s.id <= step ? 'var(--accent)' : 'var(--border)',
              transition: 'background 0.3s',
            }} />
          ))}
        </div>

        <div className="card" style={{ padding: 32 }} >
          {/* Step header */}
          <div style={{ marginBottom: 28, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--accent-glow)', border: '1px solid rgba(124,106,247,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={22} color="var(--accent)" />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>Step {step} of {STEPS.length}</div>
              <h2 style={{ fontSize: 20, fontWeight: 700 }}>{currentStep.title}</h2>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 2 }}>{currentStep.desc}</p>
            </div>
          </div>

          {/* Step 1 — Category */}
          {step === 1 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  style={{
                    padding: '10px 8px', borderRadius: 8, border: '1px solid',
                    fontSize: 12, fontWeight: 500, cursor: 'pointer', textAlign: 'center',
                    transition: 'all 0.15s',
                    borderColor: category === cat ? 'var(--accent)' : 'var(--border)',
                    background: category === cat ? 'var(--accent-glow)' : 'var(--bg-elevated)',
                    color: category === cat ? 'var(--accent)' : 'var(--text-secondary)',
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {/* Step 2 — Name */}
          {step === 2 && (
            <div>
              <label className="label">Your full name</label>
              <input
                className="input"
                placeholder="e.g., Parardha Kumar"
                value={ownerName}
                onChange={e => setOwnerName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleNext()}
                autoFocus
              />
            </div>
          )}

          {/* Step 3 — WhatsApp Number */}
          {step === 3 && (
            <div>
              <label className="label">WhatsApp Business number (with country code)</label>
              <input
                className="input"
                placeholder="e.g., 919876543210"
                value={whatsappNumber}
                onChange={e => setWhatsappNumber(e.target.value.replace(/\D/g, ''))}
                onKeyDown={e => e.key === 'Enter' && handleNext()}
                autoFocus
              />
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                Include country code. India: 91XXXXXXXXXX
              </p>
            </div>
          )}

          {/* Step 4 — Connect WhatsApp */}
          {step === 4 && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{
                width: 64, height: 64, borderRadius: 16,
                background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px', fontSize: 32,
              }}>
                🔌
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Connect WhatsApp</h3>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
                Connect your WhatsApp account from Settings after completing your business profile.
              </p>
              <div className="demo-banner" style={{ textAlign: 'left' }}>
                You can explore your workspace before connecting. Pair WhatsApp from Settings when you are ready.
              </div>
            </div>
          )}

          <button
            onClick={handleNext}
            disabled={loading}
            className="btn btn-primary"
            style={{ marginTop: 24, width: '100%', justifyContent: 'center' }}
          >
            {loading ? 'Saving…' : step === STEPS.length ? (
              <><Check size={16} /> Complete Setup</>
            ) : (
              <><span>Continue</span><ArrowRight size={16} /></>
            )}
          </button>

          {step === 4 && (
            <button
              onClick={() => router.push('/dashboard')}
              className="btn btn-ghost"
              style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
            >
              Skip for now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
