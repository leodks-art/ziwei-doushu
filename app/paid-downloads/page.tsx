import Link from 'next/link';
import PaidDownloadsClient from './PaidDownloadsClient';

export const metadata = {
  title: '免费使用 · 紫微命盘',
  description: '紫微命盘测算、详细批注与古籍原典库当前免费开放。',
};

export default function PaidDownloadsPage() {
  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-page)' }}>
      <header style={{ height: 56, borderBottom: '1px solid var(--bdr)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
        <Link href="/" style={{ color: 'var(--ac)', textDecoration: 'none', fontSize: 12, letterSpacing: '0.2em' }}>← 首页</Link>
        <div style={{ color: 'var(--tx-3)', fontSize: 12, letterSpacing: '0.2em' }}>免费开放 · 直接使用</div>
        <Link href="/library" style={{ color: 'var(--ac)', textDecoration: 'none', fontSize: 12, letterSpacing: '0.2em' }}>古籍库 →</Link>
      </header>
      <PaidDownloadsClient />
    </main>
  );
}
