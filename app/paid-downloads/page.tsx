import Link from 'next/link';
import PaidDownloadsClient from './PaidDownloadsClient';

export const metadata = {
  title: '完整文档下载 · 紫微命盘',
  description: '微信内支付后下载紫微斗数完整整理文档。',
};

export default function PaidDownloadsPage() {
  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-page)' }}>
      <header style={{ height: 56, borderBottom: '1px solid var(--bdr)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
        <Link href="/" style={{ color: 'var(--ac)', textDecoration: 'none', fontSize: 12, letterSpacing: '0.2em' }}>← 首页</Link>
        <div style={{ color: 'var(--tx-3)', fontSize: 12, letterSpacing: '0.2em' }}>微信支付 · 文档下载</div>
        <Link href="/library" style={{ color: 'var(--ac)', textDecoration: 'none', fontSize: 12, letterSpacing: '0.2em' }}>古籍库 →</Link>
      </header>
      <PaidDownloadsClient />
    </main>
  );
}
