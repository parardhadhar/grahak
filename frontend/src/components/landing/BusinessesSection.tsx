'use client';
import { useState } from 'react';

const businesses = [
  { name: 'Photographers', context: 'Never forget a wedding inquiry.' },
  { name: 'Salons', context: 'Know exactly who needs a follow-up.' },
  { name: 'Tutors', context: 'Keep every student organized.' },
  { name: 'Consultants', context: 'Turn scattered chats into client profiles.' },
  { name: 'Repair Shops', context: 'Remember every customer issue.' },
  { name: 'Freelancers', context: "Never miss a payment follow-up." },
];

export default function BusinessesSection() {
  const [active, setActive] = useState(0);

  return (
    <section className="relative z-10 bg-[#0a0806] border-t border-[#1f1d1b] py-32">
      <div className="max-w-[1600px] mx-auto px-10 md:px-16 lg:px-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <p className="font-mono text-[10px] tracking-[0.2em] text-[#7a7168] uppercase mb-8">04 / 06</p>
            <h2
              style={{
                fontFamily: "'Bodoni Moda', serif",
                fontSize: 'clamp(2.5rem, 5vw, 5rem)',
                lineHeight: 1,
                fontWeight: 400,
              }}
              className="uppercase text-white mb-10"
            >
              Built for people<br />
              <span style={{ fontStyle: 'italic', color: '#b8b0a4' }}>
                who run businesses.
              </span>
            </h2>
            <p
              className="font-mono text-[11px] tracking-[0.18em] uppercase border-l-2 pl-6 leading-loose"
              style={{ color: '#d96030', borderColor: '#d96030' }}
            >
              {businesses[active].context}
            </p>
          </div>

          <div className="flex flex-col gap-6 border-l border-[#1f1d1b] pl-10 lg:pl-20">
            {businesses.map((b, i) => (
              <div
                key={b.name}
                onMouseEnter={() => setActive(i)}
                style={{
                  fontFamily: "'Bodoni Moda', serif",
                  fontSize: 'clamp(1.8rem, 3vw, 3rem)',
                  fontWeight: 400,
                  cursor: 'default',
                  transition: 'color 0.4s ease',
                  color: active === i ? '#f4efe8' : '#2e2b28',
                  lineHeight: 1.2,
                  userSelect: 'none',
                }}
              >
                {b.name.toUpperCase()}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
