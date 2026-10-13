'use client';
import { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { searchApi } from '@/lib/api';
import { Contact } from '@/types';
import { formatRelative, formatPhone, getContactStatusConfig } from '@/lib/utils';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const requestRef = useRef(0);
  useEffect(() => () => { clearTimeout(timerRef.current); requestRef.current++; }, []);

  const handleSearch = useCallback(async (q: string) => {
    clearTimeout(timerRef.current);
    const request = ++requestRef.current;
    if (!q.trim()) { setResults([]); setSearched(false); setLoading(false); setTotal(0); return; }
    setLoading(true);
    setSearched(true);
    try {
      const resp = await searchApi.search(q);
      if (request !== requestRef.current) return;
      setResults(resp.data.contacts);
      setTotal(resp.data.total);
    } catch { if (request === requestRef.current) { setResults([]); setTotal(0); } }
    finally { if (request === requestRef.current) setLoading(false); }
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(timerRef.current);
    requestRef.current++;
    timerRef.current = setTimeout(() => handleSearch(val), 400);
  }

  return (
    <div className="page-content animate-fade-in max-w-[1000px]">
      <header className="mb-24">
        <h1 className="font-serif text-3xl md:text-5xl leading-tight uppercase mb-12">
          Search.
        </h1>
        
        <div className="relative max-w-[600px]">
          <input
            className="w-full bg-transparent border-b border-[var(--border)] text-2xl md:text-3xl font-serif py-4 outline-none focus:border-[var(--accent)] transition-colors text-[var(--text-primary)] placeholder:italic placeholder:text-[var(--text-muted)]"
            placeholder="Name, number, service, or notes..."
            value={query}
            onChange={handleChange}
            autoFocus
          />
          {loading && (
            <div className="absolute right-0 top-1/2 -translate-y-1/2 font-mono text-[9px] tracking-widest uppercase text-[var(--accent)] animate-pulse">
              SEARCHING...
            </div>
          )}
        </div>
      </header>

      {!searched && (
        <div className="mb-24">
          <div className="font-mono text-[9px] tracking-widest uppercase text-[var(--text-muted)] mb-8">
            SUGGESTED
          </div>
          <div className="flex flex-wrap gap-8">
            {['wedding photography', 'complaint', 'budget 30000', 'December'].map(s => (
              <button 
                key={s} 
                onClick={() => { setQuery(s); handleSearch(s); }}
                className="font-serif italic text-xl text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors border-b border-transparent hover:border-[var(--accent)] pb-1"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {searched && !loading && (
        <div>
          <div className="font-mono text-[9px] tracking-widest uppercase text-[var(--text-muted)] mb-12">
            {total === 0 ? 'NO RESULTS' : `${total} RESULT${total === 1 ? '' : 'S'}`}
          </div>
          
          <div className="flex flex-col gap-8">
            {results.map(contact => {
              const statusConfig = getContactStatusConfig(contact.status);
              return (
                <Link 
                  key={contact.id} 
                  href={`/contacts/${contact.id}`}
                  className="group flex flex-col md:flex-row md:items-center justify-between gap-4 border-t border-[var(--border-subtle)] pt-6 hover:border-[var(--accent)] transition-colors"
                >
                  <div>
                    <div className="font-serif text-2xl group-hover:text-[var(--accent)] transition-colors mb-2">
                      {contact.display_name || formatPhone(contact.whatsapp_number)}
                    </div>
                    <div className="font-light text-sm text-[var(--text-secondary)] max-w-2xl truncate">
                      {contact.ai_summary || contact.extracted_service || formatPhone(contact.whatsapp_number)}
                    </div>
                  </div>
                  
                  <div className="flex md:flex-col items-end gap-2 shrink-0">
                    <div className="font-mono text-[9px] tracking-widest uppercase text-[var(--accent)]">
                      {statusConfig.label}
                    </div>
                    <div className="font-mono text-[9px] tracking-widest uppercase text-[var(--text-muted)]">
                      {formatRelative(contact.last_contacted_at)}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
