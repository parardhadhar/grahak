'use client';

export default function MessageSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '20px 8px' }}>
      {/* Date separator skeleton */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{
          width: 90,
          height: 18,
          borderRadius: 10,
          background: 'rgba(255, 255, 255, 0.04)',
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
      </div>

      {/* Inbound bubble skeleton 1 */}
      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
        <div style={{
          width: '58%',
          borderRadius: '14px 14px 14px 2px',
          background: 'linear-gradient(90deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.08) 50%, rgba(255, 255, 255, 0.04) 100%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.8s infinite',
          padding: '14px 16px',
          border: '1px solid rgba(255, 255, 255, 0.05)',
        }}>
          <div style={{ height: 12, width: '85%', background: 'rgba(255, 255, 255, 0.08)', borderRadius: 4, marginBottom: 8 }} />
          <div style={{ height: 12, width: '60%', background: 'rgba(255, 255, 255, 0.08)', borderRadius: 4, marginBottom: 10 }} />
          <div style={{ height: 8, width: 35, background: 'rgba(255, 255, 255, 0.05)', borderRadius: 3, marginLeft: 'auto' }} />
        </div>
      </div>

      {/* Outbound bubble skeleton */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{
          width: '52%',
          borderRadius: '14px 14px 2px 14px',
          background: 'linear-gradient(90deg, rgba(212, 107, 46, 0.15) 0%, rgba(212, 107, 46, 0.28) 50%, rgba(212, 107, 46, 0.15) 100%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.8s infinite 0.2s',
          padding: '14px 16px',
          border: '1px solid rgba(212, 107, 46, 0.25)',
        }}>
          <div style={{ height: 12, width: '90%', background: 'rgba(255, 255, 255, 0.12)', borderRadius: 4, marginBottom: 8 }} />
          <div style={{ height: 12, width: '45%', background: 'rgba(255, 255, 255, 0.12)', borderRadius: 4, marginBottom: 10 }} />
          <div style={{ height: 8, width: 35, background: 'rgba(255, 255, 255, 0.08)', borderRadius: 3, marginLeft: 'auto' }} />
        </div>
      </div>

      {/* Inbound bubble skeleton 2 */}
      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
        <div style={{
          width: '65%',
          borderRadius: '14px 14px 14px 2px',
          background: 'linear-gradient(90deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.08) 50%, rgba(255, 255, 255, 0.04) 100%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.8s infinite 0.4s',
          padding: '14px 16px',
          border: '1px solid rgba(255, 255, 255, 0.05)',
        }}>
          <div style={{ height: 12, width: '75%', background: 'rgba(255, 255, 255, 0.08)', borderRadius: 4, marginBottom: 8 }} />
          <div style={{ height: 12, width: '50%', background: 'rgba(255, 255, 255, 0.08)', borderRadius: 4, marginBottom: 10 }} />
          <div style={{ height: 8, width: 35, background: 'rgba(255, 255, 255, 0.05)', borderRadius: 3, marginLeft: 'auto' }} />
        </div>
      </div>

      {/* Live typing indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', color: '#8a837c', fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }}>
        <span>Retrieving encrypted WhatsApp stream</span>
        <span style={{ animation: 'pulse 1s infinite' }}>•</span>
        <span style={{ animation: 'pulse 1s infinite 0.2s' }}>•</span>
        <span style={{ animation: 'pulse 1s infinite 0.4s' }}>•</span>
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
