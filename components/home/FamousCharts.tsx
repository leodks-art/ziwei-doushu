'use client';

import Link from 'next/link';
import { FAMOUS_PERSONS } from '@/lib/ziwei/famous';

interface FamousChartsProps {
  colors?: Record<string, string>;
  theme?: string;
}

export default function FamousCharts({ colors }: FamousChartsProps) {
  const accent = colors?.goldSolid ?? 'var(--ac)';

  return (
    <section className="max-w-6xl mx-auto px-6 py-16">
      <div className="text-center mb-8">
        <div style={{ fontSize: '11px', color: accent, letterSpacing: '0.35em', marginBottom: '10px' }}>
          FAMOUS CHARTS
        </div>
        <h2 style={{ fontSize: '28px', color: 'var(--tx-0)', fontWeight: 700, letterSpacing: '0.12em' }}>
          名人命盘样本
        </h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {FAMOUS_PERSONS.slice(0, 6).map(person => (
          <Link
            key={person.id}
            href={`/chart?y=${person.year}&m=${person.month}&d=${person.day}&h=8&g=${person.gender === 'female' ? 'f' : 'm'}&n=${encodeURIComponent(person.name)}`}
            style={{
              display: 'block',
              padding: '16px',
              border: '1px solid rgba(184,146,42,0.18)',
              borderRadius: '8px',
              background: 'var(--bg-card)',
              textDecoration: 'none',
            }}
          >
            <div style={{ fontSize: '16px', color: 'var(--tx-0)', fontWeight: 700, marginBottom: '4px' }}>
              {person.name}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--tx-3)', marginBottom: '8px' }}>
              {person.category} · {person.description}
            </div>
            <p style={{ fontSize: '12px', color: 'var(--tx-2)', lineHeight: 1.7 }}>
              {person.notable}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
