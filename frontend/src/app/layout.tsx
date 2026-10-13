import type { Metadata } from 'next';
import { Bodoni_Moda, Inter, IBM_Plex_Mono } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/lib/auth-context';
import './globals.css';

const bodoni = Bodoni_Moda({
  subsets: ['latin'],
  variable: '--font-bodoni',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const mono = IBM_Plex_Mono({
  weight: ['400', '500'],
  subsets: ['latin'],
  variable: '--font-plex',
  display: 'swap',
});

export const metadata: Metadata = {
  icons: { icon: '/icon.svg' },
  title: 'Grahak — apna WhatsApp, ab organized.',
  description: 'Grahak helps small businesses organize WhatsApp conversations, understand customer intent, remember important details, and never forget follow-ups.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bodoni.variable} ${inter.variable} ${mono.variable}`}>
      <body className="antialiased">
        <div className="grain-overlay pointer-events-none fixed inset-0 z-50 opacity-[0.03] mix-blend-overlay"></div>
        <AuthProvider>
          {children}
          <Toaster
            position="bottom-center"
            toastOptions={{
              style: {
                background: '#11100E',
                color: '#F2EEE8',
                border: '1px solid rgba(242, 238, 232, 0.15)',
                borderRadius: '0',
                fontSize: '13px',
                fontFamily: 'var(--font-inter)',
                letterSpacing: '0.02em',
                padding: '12px 24px',
              },
              success: { iconTheme: { primary: '#9A522A', secondary: '#11100E' } },
              error: { iconTheme: { primary: '#B86B3A', secondary: '#11100E' } },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
