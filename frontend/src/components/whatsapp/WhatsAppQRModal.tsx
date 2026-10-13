'use client';
import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { whatsappBridgeApi } from '@/lib/api';
import toast from 'react-hot-toast';
import Image from 'next/image';

interface Props { isOpen: boolean; onClose: () => void; onConnected?: () => void }

export default function WhatsAppQRModal({ isOpen, onClose, onConnected }: Props) {
  const [qr, setQR] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [phone, setPhone] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const callback = useRef(onConnected);
  useEffect(() => { callback.current = onConnected; }, [onConnected]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    let notified = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const data = await whatsappBridgeApi.getQR();
        if (cancelled) return;
        setConnected(data.connected); setPhone(data.phone); setQR(data.qr_image);
        setError(data.available === false ? 'WhatsApp has not been configured for this workspace. Ask your administrator to connect the service.' : '');
        if (data.connected && !notified) { notified = true; callback.current?.(); }
      } catch {
        if (!cancelled) setError('We could not reach the WhatsApp connection service. Check that it is running and try again.');
      } finally {
        if (!cancelled) timer = setTimeout(poll, 3000);
      }
    };
    timer = setTimeout(() => { setError(''); setQR(null); setConnected(false); void poll(); }, 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [isOpen]);

  async function action(disconnect: boolean) {
    setBusy(true);
    try {
      const result = disconnect ? await whatsappBridgeApi.disconnect() : await whatsappBridgeApi.resetQR();
      if (!result.success) throw new Error('Action failed');
      setQR(null); setConnected(false); setError('');
      toast.success(disconnect ? 'WhatsApp disconnected.' : 'Pairing restarted. Waiting for a new QR code.');
    } catch { setError('The connection could not be updated. Please try again.'); }
    finally { setBusy(false); }
  }

  return <Dialog.Root open={isOpen} onOpenChange={open => { if (!open) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Overlay style={{ position: 'fixed', inset: 0, background: '#0009', zIndex: 70 }} />
      <Dialog.Content className="connection-dialog" style={{ position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', zIndex: 71, maxHeight: '90dvh', overflowY: 'auto' }}>
        <Dialog.Title asChild><h2>{connected ? 'WhatsApp connected' : 'Connect WhatsApp'}</h2></Dialog.Title>
        <Dialog.Description asChild><p>{connected ? `Your account ${phone ? '+' + phone : ''} is ready to receive and send messages.` : 'Link your business account to manage conversations in Grahak.'}</p></Dialog.Description>
        {error && <div className="connection-error" role="alert">{error}</div>}
        {!connected && !error && (qr ? <Image className="connection-qr" src={qr} width={256} height={256} unoptimized alt="Scan this QR code with WhatsApp to link your account" /> : <div role="status" style={{ padding: '32px 0', textAlign: 'center' }}>Waiting for a pairing code…</div>)}
        {!connected && <ol><li>Open WhatsApp on your phone.</li><li>Go to Settings or Menu → Linked devices.</li><li>Tap Link a device and scan the code.</li></ol>}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <button className="g-btn g-btn-ghost" disabled={busy} onClick={() => action(connected)}>{busy ? 'Please wait…' : connected ? 'Disconnect account' : 'Restart pairing'}</button>
          <Dialog.Close asChild><button className="g-btn g-btn-primary">Done</button></Dialog.Close>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
