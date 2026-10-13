'use client';

import { useEffect, useState } from 'react';

interface LuxuryLoaderProps {
  title?: string;
  subtitle?: string;
}

export default function LuxuryLoader({
  title = 'Loading Grahak…',
  subtitle = 'Preparing your workspace',
}: LuxuryLoaderProps) {
  const [phase, setPhase] = useState(0);
  const [dots, setDots] = useState('');

  // Advance phases for the animated text
  const steps = [
    subtitle,
    'Connecting to WhatsApp bridge',
    'Loading conversations',
    'Almost there',
  ];

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 600);
    const t2 = setTimeout(() => setPhase(2), 1200);
    const t3 = setTimeout(() => setPhase(3), 1800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  useEffect(() => {
    const iv = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 380);
    return () => clearInterval(iv);
  }, []);

  return (
    <>
      <style>{`
        @keyframes loaderFade {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes loaderSweep {
          0%   { left: -60%; width: 50%; }
          100% { left: 130%; width: 30%; }
        }
        @keyframes loaderPulse {
          0%, 100% { opacity: 0.4; transform: scaleY(0.6); }
          50%       { opacity: 1;   transform: scaleY(1); }
        }
        @keyframes grahakMark {
          0%   { opacity: 0; letter-spacing: 0.18em; }
          100% { opacity: 1; letter-spacing: 0.07em; }
        }
        @keyframes subtextCycle {
          0%   { opacity: 0; transform: translateY(5px); }
          15%  { opacity: 1; transform: translateY(0); }
          80%  { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-5px); }
        }
        @keyframes barFill {
          from { width: 0%; }
          to   { width: var(--bar-w); }
        }
      `}</style>

      <div role="status" aria-label={title} style={{
        height: '100vh', width: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--g-bg)',
        userSelect: 'none',
        fontFamily: 'var(--font-sans)',
        overflow: 'hidden',
      }}>
        {/* Background subtle grid lines */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.03,
          backgroundImage: 'linear-gradient(rgba(255,252,246,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,252,246,0.5) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }} />

        <div style={{
          textAlign: 'center', maxWidth: 320, width: '100%', padding: '0 24px',
          animation: 'loaderFade 0.5s cubic-bezier(0.22,1,0.36,1) both',
        }}>
          {/* GRAHAK wordmark */}
          <div style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 28,
            color: 'var(--g-text)',
            letterSpacing: '0.07em',
            marginBottom: 28,
            animation: 'grahakMark 0.8s cubic-bezier(0.22,1,0.36,1) both',
          }}>
            GRAHAK.
          </div>

          {/* Animated bars — like a music equalizer / sound wave */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 4, height: 28, marginBottom: 28,
          }}>
            {[0.4, 0.7, 1, 0.6, 0.9, 0.5, 0.8, 0.45, 0.75, 1, 0.55, 0.85].map((h, i) => (
              <div key={i} style={{
                width: 3, borderRadius: 2,
                background: i % 3 === 0 ? 'var(--g-accent-light)' : 'rgba(255,252,246,0.2)',
                animation: `loaderPulse ${0.6 + (i % 4) * 0.15}s ease-in-out ${i * 0.05}s infinite`,
                height: `${h * 24}px`,
              }} />
            ))}
          </div>

          {/* Status text cycling */}
          <div style={{ height: 18, overflow: 'hidden', marginBottom: 20, position: 'relative' }}>
            <div key={phase} style={{
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              color: 'var(--g-text-4)',
              letterSpacing: '0.05em',
              animation: 'subtextCycle 1.2s ease both',
            }}>
              {steps[phase]}{dots}
            </div>
          </div>

          {/* Sleek progress bar */}
          <div style={{
            width: '100%', height: 1.5,
            background: 'rgba(255,252,246,0.06)',
            borderRadius: 2, overflow: 'hidden',
            position: 'relative',
          }}>
            {/* Indeterminate sweep */}
            <div style={{
              position: 'absolute', top: 0, height: '100%',
              background: 'linear-gradient(90deg, transparent, var(--g-accent-light), var(--g-text), var(--g-accent-light), transparent)',
              animation: 'loaderSweep 1.4s cubic-bezier(0.4,0,0.6,1) infinite',
              borderRadius: 2,
            }} />
          </div>
        </div>
      </div>
    </>
  );
}
