'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Sidebar from '@/components/layout/Sidebar';
import TopProgressBar from '@/components/ui/TopProgressBar';

function Spinner() {
  const [dots, setDots] = useState('');
  useEffect(() => {
    const iv = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 380);
    return () => clearInterval(iv);
  }, []);

  return (
    <div style={{
      width: '100vw', height: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--g-bg)', flexDirection: 'column', gap: 20,
      fontFamily: 'var(--font-sans)',
    }}>
      <style>{`
        @keyframes authFade {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes authBar {
          0%   { left: -60%; width: 50%; }
          100% { left: 130%; width: 30%; }
        }
        @keyframes authPulse {
          0%, 100% { opacity: 0.4; transform: scaleY(0.5); }
          50%       { opacity: 1;   transform: scaleY(1); }
        }
      `}</style>

      <div style={{ animation: 'authFade 0.5s cubic-bezier(0.22,1,0.36,1) both', textAlign: 'center' }}>
        <div style={{
          fontFamily: 'var(--font-serif)', fontSize: 22,
          letterSpacing: '0.07em', color: 'var(--g-text)',
          marginBottom: 20,
        }}>
          GRAHAK.
        </div>

        {/* Mini equalizer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, height: 20, marginBottom: 16 }}>
          {[0.5, 0.8, 1, 0.6, 0.9, 0.5, 0.75].map((h, i) => (
            <div key={i} style={{
              width: 2.5, borderRadius: 2,
              background: i === 3 ? 'var(--g-accent-light)' : 'rgba(255,252,246,0.2)',
              animation: `authPulse ${0.5 + (i%3)*0.15}s ease-in-out ${i*0.07}s infinite`,
              height: `${h * 18}px`,
            }} />
          ))}
        </div>

        <div style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--g-text-4)', letterSpacing: '0.05em' }}>
          Authenticating{dots}
        </div>

        {/* Slim bar */}
        <div style={{ width: 120, height: 1.5, background: 'rgba(255,252,246,0.06)', borderRadius: 2, overflow: 'hidden', position: 'relative', margin: '12px auto 0' }}>
          <div style={{ position: 'absolute', top: 0, height: '100%', background: 'linear-gradient(90deg, transparent, var(--g-accent-light), transparent)', animation: 'authBar 1.4s ease-in-out infinite', borderRadius: 2 }} />
        </div>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) return <Spinner />;
  if (!isAuthenticated) return null;

  return (
    <div className="app-shell" style={{
      display: 'flex',
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      background: 'var(--g-bg)',
    }}>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <TopProgressBar />
      <Sidebar />
      <main id="main-content" className="app-main" style={{
        flex: 1,
        minWidth: 0,
        height: '100vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        background: 'var(--g-bg)',
      }}>
        {children}
      </main>
    </div>
  );
}
