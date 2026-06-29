'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Product {
  id: string;
  slug: string;
  title: string;
  description: string;
  amountCents: number;
  filePath: string | null;
  active: boolean;
  file?: { exists: boolean; fullPath: string | null; size: number | null };
}

interface Order {
  orderNo: string;
  productTitle?: string;
  productSlug?: string;
  status: string;
  contact: string;
  contactType: string;
  amountCents: number;
  openid: string | null;
  downloadUrl: string | null;
  downloadCount: number;
  downloadLimit: number;
  createdAt: string;
  paidAt: string | null;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [status, setStatus] = useState<Record<string, unknown>>({});
  const [message, setMessage] = useState('');

  const paidCount = useMemo(() => orders.filter(o => o.status === 'paid').length, [orders]);

  async function load() {
    const [p, o, s] = await Promise.all([
      fetch('/api/admin/products').then(r => r.json()),
      fetch('/api/admin/orders').then(r => r.json()),
      fetch('/api/admin/wechat-status').then(r => r.json()),
    ]);
    if (p.error === 'UNAUTHORIZED' || o.error === 'UNAUTHORIZED') {
      router.push('/admin-ziwei/login');
      return;
    }
    setProducts(p.products || []);
    setOrders(o.orders || []);
    setStatus(s || {});
  }

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function updateProduct(product: Product, patch: Partial<Product>) {
    setMessage('');
    const res = await fetch(`/api/admin/products/${product.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(data.error || '保存失败');
      return;
    }
    setMessage('商品已保存');
    await load();
  }

  async function refreshDownload(orderNo: string) {
    const res = await fetch(`/api/admin/orders/${orderNo}/refresh-download`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(data.error || '补发失败');
      return;
    }
    setMessage(`下载链接已补发：${data.order.downloadUrl}`);
    await load();
  }

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin-ziwei/login');
  }

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-page)', color: 'var(--tx-0)' }}>
      <header style={{ height: 56, borderBottom: '1px solid var(--bdr)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <strong>紫微运营后台</strong>
          <Link href="/paid-downloads" style={linkStyle}>付费页</Link>
          <Link href="/" style={linkStyle}>首页</Link>
        </div>
        <button onClick={logout} style={ghostButton}>退出</button>
      </header>

      <div style={{ padding: 24, display: 'grid', gap: 18 }}>
        {message && <div style={{ padding: 12, border: '1px solid var(--ac-bdr)', borderRadius: 8, color: 'var(--ac)' }}>{message}</div>}

        <section style={bandStyle}>
          <h2 style={h2Style}>配置状态</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            {[
              ['数据库', status.database],
              ['公众号授权', status.officialAccount],
              ['微信支付', status.pay],
              ['回调验签公钥', status.callbackVerify],
              ['付费文件目录', status.paidFileRoot],
            ].map(([label, ok]) => (
              <div key={String(label)} style={miniCard}>
                <span style={{ color: 'var(--tx-2)' }}>{String(label)}</span>
                <strong style={{ color: ok ? '#16803c' : '#b42318' }}>{ok ? '已配置' : '未配置'}</strong>
              </div>
            ))}
          </div>
        </section>

        <section style={bandStyle}>
          <h2 style={h2Style}>商品管理</h2>
          <div style={{ display: 'grid', gap: 12 }}>
            {products.map(product => (
              <ProductEditor key={product.id} product={product} onSave={patch => updateProduct(product, patch)} />
            ))}
            {!products.length && <p style={muted}>暂无商品。请先执行 `pnpm db:migrate` 建表并插入默认商品。</p>}
          </div>
        </section>

        <section style={bandStyle}>
          <h2 style={h2Style}>订单列表 <span style={muted}>已支付 {paidCount} / 共 {orders.length}</span></h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: 'var(--tx-3)', textAlign: 'left' }}>
                  <th style={th}>订单</th>
                  <th style={th}>商品</th>
                  <th style={th}>状态</th>
                  <th style={th}>金额</th>
                  <th style={th}>联系</th>
                  <th style={th}>下载</th>
                  <th style={th}>操作</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(order => (
                  <tr key={order.orderNo} style={{ borderTop: '1px solid var(--bdr)' }}>
                    <td style={td}>{order.orderNo}<br /><span style={muted}>{new Date(order.createdAt).toLocaleString()}</span></td>
                    <td style={td}>{order.productTitle || order.productSlug}</td>
                    <td style={td}><strong style={{ color: order.status === 'paid' ? '#16803c' : '#9a6700' }}>{order.status}</strong></td>
                    <td style={td}>¥{(order.amountCents / 100).toFixed(2)}</td>
                    <td style={td}>{order.contact}<br /><span style={muted}>{order.openid ? `openid ...${order.openid.slice(-6)}` : ''}</span></td>
                    <td style={td}>{order.downloadCount}/{order.downloadLimit}</td>
                    <td style={td}>
                      <button onClick={() => refreshDownload(order.orderNo)} disabled={order.status !== 'paid'} style={smallButton}>补发链接</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function ProductEditor({ product, onSave }: { product: Product; onSave: (patch: Partial<Product>) => void }) {
  const [draft, setDraft] = useState(product);
  useEffect(() => setDraft(product), [product]);
  return (
    <div style={miniCard}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px 110px', gap: 10 }}>
        <input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} style={input} />
        <input value={draft.filePath || ''} onChange={e => setDraft({ ...draft, filePath: e.target.value })} placeholder="文件路径" style={input} />
        <input value={(draft.amountCents / 100).toFixed(2)} onChange={e => setDraft({ ...draft, amountCents: Math.round(Number(e.target.value) * 100) })} style={input} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={draft.active} onChange={e => setDraft({ ...draft, active: e.target.checked })} />
          上架
        </label>
      </div>
      <textarea value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} style={{ ...input, height: 68, marginTop: 10, paddingTop: 8 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
        <span style={muted}>slug: {product.slug} · 文件：{product.file?.exists ? '存在' : '未找到'}</span>
        <button onClick={() => onSave(draft)} style={smallButton}>保存商品</button>
      </div>
    </div>
  );
}

const bandStyle: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--bdr)', borderRadius: 8, padding: 18 };
const miniCard: React.CSSProperties = { border: '1px solid var(--bdr)', borderRadius: 8, padding: 12, background: 'rgba(255,255,255,0.02)' };
const h2Style: React.CSSProperties = { margin: '0 0 14px', fontSize: 18 };
const muted: React.CSSProperties = { color: 'var(--tx-3)', fontSize: 12, fontWeight: 400 };
const input: React.CSSProperties = { height: 36, border: '1px solid var(--bdr)', borderRadius: 6, background: 'var(--bg-page)', color: 'var(--tx-0)', padding: '0 10px' };
const linkStyle: React.CSSProperties = { color: 'var(--ac)', textDecoration: 'none', fontSize: 13 };
const ghostButton: React.CSSProperties = { border: '1px solid var(--bdr)', borderRadius: 6, background: 'transparent', color: 'var(--tx-0)', padding: '7px 12px', cursor: 'pointer' };
const smallButton: React.CSSProperties = { border: 'none', borderRadius: 6, background: 'var(--ac)', color: '#fff', padding: '7px 10px', cursor: 'pointer' };
const th: React.CSSProperties = { padding: '9px 8px', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '10px 8px', verticalAlign: 'top', whiteSpace: 'nowrap' };
