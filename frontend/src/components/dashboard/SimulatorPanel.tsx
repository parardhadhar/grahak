'use client';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { devApi } from '@/lib/api';

export default function SimulatorPanel({ onSent }: { onSent: () => void }) {
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!phone || !message) {
      toast.error('Phone and message required');
      return;
    }

    setLoading(true);
    try {
      await devApi.simulateMessage({
        customer_name: customerName,
        phone: '91' + phone.replace(/\D/g, ''),
        message,
      });
      toast.success('Message processed.');
      setMessage('');
      onSent();
    } catch {
      toast.error('Failed to simulate message.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border border-[var(--border)] p-8">
      <div className="font-mono text-[9px] tracking-widest uppercase text-[var(--accent)] mb-8">
        DEV SIMULATOR // INCOMING MESSAGE
      </div>
      
      <form onSubmit={handleSend} className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-8">
          <div>
            <label className="font-mono text-[9px] tracking-widest uppercase text-[var(--text-muted)] block mb-2">
              Customer Name
            </label>
            <input
              className="w-full bg-transparent border-b border-[var(--border)] py-2 font-serif text-lg outline-none focus:border-[var(--accent)] transition-colors"
              placeholder="e.g. Rahul"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
            />
          </div>
          <div>
            <label className="font-mono text-[9px] tracking-widest uppercase text-[var(--text-muted)] block mb-2">
              Phone Number
            </label>
            <input
              className="w-full bg-transparent border-b border-[var(--border)] py-2 font-serif text-lg outline-none focus:border-[var(--accent)] transition-colors"
              placeholder="10 digit number"
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />
          </div>
        </div>
        
        <div>
          <label className="font-mono text-[9px] tracking-widest uppercase text-[var(--text-muted)] block mb-2">
            Message
          </label>
          <input
            className="w-full bg-transparent border-b border-[var(--border)] py-2 font-serif text-xl outline-none focus:border-[var(--accent)] transition-colors"
            placeholder="Type a message to simulate..."
            value={message}
            onChange={e => setMessage(e.target.value)}
          />
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="self-end mt-4 font-mono text-[10px] tracking-widest uppercase border border-[var(--border)] px-8 py-3 hover:bg-[var(--text-primary)] hover:text-[var(--bg-base)] transition-colors disabled:opacity-30"
        >
          {loading ? 'PROCESSING...' : 'SEND SIMULATED MESSAGE'}
        </button>
      </form>
    </div>
  );
}
