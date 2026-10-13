'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export default function TopProgressBar() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger loading animation on route change
    const t0 = setTimeout(() => { setVisible(true); setProgress(30); }, 0);
    let t3: ReturnType<typeof setTimeout>;

    const t1 = setTimeout(() => setProgress(75), 120);
    const t2 = setTimeout(() => {
      setProgress(100);
      t3 = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 250);
    }, 350);

    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [pathname]);

  if (!visible && progress === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 2.5,
        zIndex: 60,
        pointerEvents: 'none',
        background: 'rgba(0, 0, 0, 0.2)',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${progress}%`,
          background: 'var(--g-accent-light)',
          transition: progress === 100 ? 'width 0.2s ease-out, opacity 0.25s ease' : 'width 0.35s cubic-bezier(0.1, 0.7, 0.1, 1)',
          opacity: visible ? 1 : 0,
        }}
      />
    </div>
  );
}
