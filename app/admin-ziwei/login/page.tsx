import Link from 'next/link';
import LoginForm from './LoginForm';

export const metadata = {
  title: '紫微后台登录',
};

export default function AdminLoginPage() {
  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-page)', display: 'grid', placeItems: 'center', padding: 24 }}>
      <section style={{ width: '100%', maxWidth: 460, background: 'var(--bg-card)', border: '1px solid var(--bdr)', borderRadius: 8, padding: 28 }}>
        <Link href="/" style={{ color: 'var(--ac)', fontSize: 12, textDecoration: 'none', letterSpacing: '0.2em' }}>← 返回首页</Link>
        <h1 style={{ margin: '20px 0 8px', color: 'var(--tx-0)', fontSize: 24 }}>紫微运营后台</h1>
        <p style={{ margin: '0 0 22px', color: 'var(--tx-2)', fontSize: 13 }}>管理微信支付、付费文档、订单与下载授权。</p>
        <LoginForm />
      </section>
    </main>
  );
}
