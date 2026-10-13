'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { contactsApi } from '@/lib/api';
import { Contact, Message, Note, AIInsight } from '@/types';
import { getContactStatusConfig, formatDateTime, formatPhone, formatBudget } from '@/lib/utils';

export default function ContactDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();

  const [contact, setContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'conversation' | 'notes'>('conversation');
  const [newNote, setNewNote] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cResp, mResp, nResp, iResp] = await Promise.all([
        contactsApi.get(id),
        contactsApi.getMessages(id),
        contactsApi.getNotes(id),
        contactsApi.getAIInsights(id),
      ]);
      setContact(cResp.data);
      setMessages(mResp.data);
      setNotes(nResp.data);
      setInsights(iResp.data);
    } catch {
      toast.error('Contact not found.');
      router.push('/contacts');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => { const initial = setTimeout(() => void fetchAll(), 0); return () => clearTimeout(initial); }, [fetchAll]);

  async function handleAddNote() {
    if (!newNote.trim()) return;
    try {
      const resp = await contactsApi.createNote(id, newNote.trim());
      setNotes(prev => [resp.data, ...prev]);
      setNewNote('');
      toast.success('Note saved.');
    } catch { toast.error('Failed to save note.'); }
  }

  if (loading) return <div className="page-content font-serif italic animate-pulse">Loading contact...</div>;
  if (!contact) return null;

  const statusConfig = getContactStatusConfig(contact.status);
  const latestInsight = insights[0];

  return (
    <div className="page-content customer-detail animate-fade-in relative max-w-[1200px]">
      {/* Back Button */}
      <button onClick={() => router.push('/contacts')} className="font-mono text-[10px] tracking-widest uppercase text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors mb-16">
        ← BACK TO CUSTOMERS
      </button>

      <div className="grid md:grid-cols-[1fr_400px] gap-24 items-start">
        {/* Left Column: Details & Thread */}
        <div>
          {/* Header */}
          <div className="mb-24">
            <h1 className="font-serif text-5xl md:text-7xl uppercase mb-8 leading-none tracking-tight break-words">
              {contact.display_name || formatPhone(contact.whatsapp_number)}
            </h1>
            
            <div className="flex flex-wrap gap-8 font-mono text-[10px] tracking-widest uppercase text-[var(--text-secondary)] border-b border-[var(--border)] pb-8">
              <div>
                <div className="text-[var(--text-muted)] mb-2">STATUS</div>
                <div className="text-[var(--accent)]">{statusConfig.label}</div>
              </div>
              <div>
                <div className="text-[var(--text-muted)] mb-2">WHATSAPP</div>
                <a href={`https://wa.me/${contact.whatsapp_number.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="hover:text-[var(--text-primary)]">
                  {formatPhone(contact.whatsapp_number)} ↗
                </a>
              </div>
              {contact.extracted_service && (
                <div>
                  <div className="text-[var(--text-muted)] mb-2">INTEREST</div>
                  <div>{contact.extracted_service}</div>
                </div>
              )}
              {contact.extracted_budget && (
                <div>
                  <div className="text-[var(--text-muted)] mb-2">BUDGET</div>
                  <div>{formatBudget(contact.extracted_budget)}</div>
                </div>
              )}
            </div>
          </div>

          {/* AI Intelligence Block */}
          {(contact.ai_summary || latestInsight?.summary) && (
            <div className="mb-24 border border-[var(--border)] p-8 relative">
              <div className="absolute top-0 left-8 -translate-y-1/2 bg-[var(--bg-base)] px-4 font-mono text-[10px] tracking-widest uppercase text-[var(--accent)]">
                GRAHAK INTELLIGENCE
              </div>
              <p className="font-serif italic text-xl md:text-2xl leading-relaxed text-[var(--text-primary)]">
                {contact.ai_summary || latestInsight?.summary}
              </p>
              {latestInsight?.suggested_action && (
                <div className="mt-8 pt-6 border-t border-[var(--border-subtle)] font-mono text-[10px] tracking-widest uppercase text-[var(--text-secondary)] flex gap-4">
                  <span className="text-[var(--accent)]">SUGGESTED ACTION //</span>
                  <span>{latestInsight.suggested_action}</span>
                </div>
              )}
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-12 font-mono text-[10px] tracking-widest uppercase border-b border-[var(--border)] pb-4 mb-12">
            <button 
              onClick={() => setActiveTab('conversation')}
              className={`transition-colors ${activeTab === 'conversation' ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
            >
              Conversation
            </button>
            <button 
              onClick={() => setActiveTab('notes')}
              className={`transition-colors ${activeTab === 'notes' ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
            >
              Notes ({notes.length})
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'conversation' && (
            <div className="flex flex-col gap-12">
              {messages.length === 0 ? (
                <div className="font-serif italic text-[var(--text-muted)]">No messages yet.</div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className={`flex flex-col ${msg.direction === 'inbound' ? 'items-start' : 'items-end'}`}>
                    <div className="font-mono text-[9px] tracking-widest uppercase text-[var(--text-muted)] mb-2">
                      {formatDateTime(msg.created_at)}
                    </div>
                    <div className={`
                      font-serif text-lg md:text-xl leading-relaxed max-w-[85%]
                      ${msg.direction === 'inbound' ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] italic'}
                    `}>
                      {msg.body}
                    </div>
                    {msg.intent && msg.direction === 'inbound' && (
                      <div className="font-mono text-[9px] tracking-widest uppercase text-[var(--accent)] mt-3 border border-[var(--border)] px-3 py-1">
                        {msg.intent.replace('_', ' ')}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'notes' && (
            <div>
              <div className="mb-12">
                <textarea
                  className="w-full bg-transparent border border-[var(--border)] text-sm font-light p-6 focus:border-[var(--accent)] outline-none resize-none transition-colors"
                  placeholder="Add a note... e.g., Quoted ₹25,000. Waiting for date confirmation."
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  rows={3}
                />
                <button 
                  onClick={handleAddNote} 
                  disabled={!newNote.trim()} 
                  className="mt-4 font-mono text-[10px] tracking-widest uppercase text-[var(--text-primary)] border-b border-[var(--text-primary)] hover:text-[var(--accent)] hover:border-[var(--accent)] pb-1 transition-colors disabled:opacity-30"
                >
                  SAVE NOTE
                </button>
              </div>

              <div className="flex flex-col gap-8">
                {notes.length === 0 ? (
                  <div className="font-serif italic text-[var(--text-muted)]">No notes yet.</div>
                ) : (
                  notes.map(note => (
                    <div key={note.id} className="border-t border-[var(--border-subtle)] pt-6">
                      <div className="font-mono text-[9px] tracking-widest uppercase text-[var(--text-muted)] mb-4">
                        {formatDateTime(note.created_at)}
                      </div>
                      <p className="font-light text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
                        {note.body}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Actions (Sticky) */}
        <div className="sticky top-24">
          <div className="border border-[var(--border)] p-8">
            <h3 className="font-serif text-2xl uppercase mb-8">Follow Up</h3>
            <p className="font-light text-sm text-[var(--text-secondary)] mb-8">
              Open the conversation to reply, review context, and schedule a follow-up.
            </p>
            <Link 
              href={`/dashboard?contact=${id}`} 
              className="block w-full text-center font-mono text-[10px] tracking-widest uppercase bg-[var(--text-primary)] text-[var(--bg-base)] py-4 hover:bg-[var(--accent)] hover:text-white transition-colors duration-500"
            >
              OPEN CONVERSATION →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
