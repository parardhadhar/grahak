'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { MessageSquare, Eye, EyeOff, ArrowRight, Check } from 'lucide-react';
import { authApi, getApiErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function SignupPage() {
  const [form, setForm] = useState({
    email: '', password: '', full_name: '', business_name: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  function setField(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email || !form.password || !form.full_name || !form.business_name) {
      toast.error('Please fill in all fields.');
      return;
    }
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      const resp = await authApi.signup(form);
      login(resp.data);
      toast.success('Account created! Let\'s set up your business.');
      router.push('/onboarding');
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Signup failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  }

  const perks = [
    'Free to start, no credit card',
    'AI-powered customer organization',
    'Setup in under 5 minutes',
  ];

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      background: 'var(--bg-base)',
    }}>
      {/* Left panel */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 40, maxWidth: 480,
      }}>
        <div style={{ width: '100%' }}>
          <div style={{ marginBottom: 36 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <MessageSquare size={18} color="white" />
              </div>
              <span style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 18 }}>Grahak</span>
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Create your account</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              Start organizing your WhatsApp customers with AI.
            </p>
          </div>

          <div className="card" style={{ padding: 28 }}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="label">Your name</label>
                  <input aria-label="Your name" type="text" className="input" placeholder="Your full name" value={form.full_name} onChange={setField('full_name')} required />
                </div>
                <div>
                  <label className="label">Business name</label>
                  <input aria-label="Business name" type="text" className="input" placeholder="Your workspace" value={form.business_name} onChange={setField('business_name')} required />
                </div>
              </div>
              <div>
                <label className="label">Email address</label>
                <input aria-label="Email address" type="email" className="input" placeholder="you@business.com" value={form.email} onChange={setField('email')} autoComplete="email" required />
              </div>
              <div>
                <label className="label">Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                aria-label="Password"
                    type={showPassword ? 'text' : 'password'}
                    className="input"
                    placeholder="Min 8 characters"
                    minLength={8}
                    autoComplete="new-password"
                    value={form.password}
                    onChange={setField('password')}
                    style={{ paddingRight: 44 }}
                    required
                  />
                  <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)} style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4,
                  }}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <button type="submit" className="btn btn-primary" disabled={loading} style={{ justifyContent: 'center', marginTop: 4 }}>
                {loading ? 'Creating account…' : <><span>Create Account</span><ArrowRight size={16} /></>}
              </button>
            </form>
          </div>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text-muted)' }}>
            Already have an account?{' '}
            <Link href="/login" style={{ color: 'var(--accent)', fontWeight: 500 }}>Sign in →</Link>
          </p>
        </div>
      </div>

      {/* Right panel */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60,
        background: 'var(--bg-surface)', borderLeft: '1px solid var(--border-subtle)',
      }} className="hide-mobile">
        <div style={{ maxWidth: 380 }}>
          <div className="ai-badge" style={{ display: 'inline-block', marginBottom: 24 }}>✦ AI-Powered</div>
          <h2 style={{ fontSize: 26, marginBottom: 16, lineHeight: 1.4 }}>
            Built around how your business works.
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 32, lineHeight: 1.7 }}>
            Stop losing customers in your WhatsApp inbox. Grahak captures every conversation, understands what each customer wants, and reminds you when to follow up.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {perks.map(perk => (
              <div key={perk} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--accent-glow)', border: '1px solid rgba(124,106,247,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Check size={11} color="var(--accent)" />
                </div>
                <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{perk}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
