'use client';

import Link from 'next/link';
import { useEffect } from 'react';

const chartHref = '/chart?cal=lunar&y=1990&m=5&d=23&h=8&mi=0&g=m&topics=marriage,career,wealth,family,children,health,personality,migration';

const freeItems = [
  ['命盘测算', '农历输入自动换算公历，生成十二宫盘面与推导复核。'],
  ['详细批注', '婚姻、事业、财运、家庭、子女等批注选项免费使用。'],
  ['古籍资料', '古籍原典库可直接检索查阅，不需要登录或支付。'],
];

export default function PaidDownloadsClient() {
  useEffect(() => {
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: '/paid-downloads-free' }),
    }).catch(() => {});
  }, []);

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '28px 20px 72px' }}>
      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(260px, 0.8fr)', gap: 24, alignItems: 'start' }}>
        <div>
          <div style={{ color: 'var(--ac)', fontSize: 12, letterSpacing: '0.24em', marginBottom: 10 }}>FREE ACCESS</div>
          <h1 style={{ color: 'var(--tx-0)', fontSize: 'clamp(28px,4vw,44px)', margin: '0 0 12px', letterSpacing: '0.08em' }}>
            当前免费开放使用
          </h1>
          <p style={{ color: 'var(--tx-2)', lineHeight: 1.8, maxWidth: 680 }}>
            现在不启用登录和支付。紫微命盘测算、详细批注、古籍原典库先全部免费开放，访问者可直接使用。
          </p>
          <div style={noticeStyle}>
            付费下载入口已暂时关闭。后续需要收费时，可在后台恢复商品上架并补齐支付配置。
          </div>
          <div style={{ display: 'grid', gap: 12, marginTop: 22 }}>
            {freeItems.map(([title, description]) => (
              <div key={title} style={infoRow}>
                <strong>{title}</strong>
                <span>{description}</span>
              </div>
            ))}
          </div>
        </div>

        <aside style={{ background: 'var(--bg-card)', border: '1px solid var(--bdr)', borderRadius: 8, padding: 18 }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 18, color: 'var(--tx-0)' }}>直接进入</h2>
          <Link href={chartHref} style={primaryLink}>立即起盘</Link>
          <Link href="/library" style={secondaryLink}>查阅古籍库</Link>
          <Link href="/heming" style={secondaryLink}>合命工具</Link>
        </aside>
      </section>
    </div>
  );
}

const noticeStyle: React.CSSProperties = { marginTop: 14, padding: 12, borderRadius: 8, border: '1px solid rgba(184,146,42,0.25)', color: 'var(--tx-2)', background: 'rgba(184,146,42,0.06)', fontSize: 13, lineHeight: 1.6 };
const infoRow: React.CSSProperties = { border: '1px solid var(--bdr)', borderRadius: 8, padding: 16, display: 'grid', gap: 6, background: 'var(--bg-card)', color: 'var(--tx-0)', lineHeight: 1.7 };
const primaryLink: React.CSSProperties = { display: 'block', width: '100%', borderRadius: 6, background: 'var(--ac)', color: '#fff', padding: '12px 14px', fontWeight: 700, textAlign: 'center', textDecoration: 'none' };
const secondaryLink: React.CSSProperties = { display: 'block', width: '100%', marginTop: 12, borderRadius: 6, border: '1px solid var(--bdr)', color: 'var(--tx-0)', padding: '11px 14px', fontWeight: 700, textAlign: 'center', textDecoration: 'none', background: 'transparent' };
