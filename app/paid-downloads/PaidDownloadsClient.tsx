'use client';

import { useEffect, useMemo, useState } from 'react';

declare global {
  interface Window {
    WeixinJSBridge?: {
      invoke: (name: string, params: Record<string, string>, cb: (res: { err_msg?: string }) => void) => void;
    };
  }
}

interface Product {
  slug: string;
  title: string;
  description: string;
  amountCents: number;
  currency: string;
  fileReady: boolean;
}

interface PublicOrder {
  orderNo: string;
  status: string;
  amountCents: number;
  productTitle?: string;
  downloadUrl: string | null;
}

export default function PaidDownloadsClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [contact, setContact] = useState('');
  const [selected, setSelected] = useState('');
  const [message, setMessage] = useState('');
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [setupError, setSetupError] = useState('');

  const isWechat = useMemo(() => /MicroMessenger/i.test(typeof navigator !== 'undefined' ? navigator.userAgent : ''), []);
  const product = products.find(p => p.slug === selected) || products[0];

  useEffect(() => {
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: '/paid-downloads' }),
    }).catch(() => {});

    fetch('/api/products')
      .then(r => r.json())
      .then(data => {
        setProducts(data.products || []);
        setSelected(data.products?.[0]?.slug || '');
        setSetupError(data.setupError || '');
      })
      .catch(() => setSetupError('商品读取失败'));

    if (isWechat) {
      fetch(`/api/wechat/session?redirect=${encodeURIComponent('/paid-downloads')}`)
        .then(r => r.json())
        .then(data => {
          if (!data.loggedIn && data.wechatConfigured) {
            window.location.href = `/api/wechat/oauth/start?redirect=${encodeURIComponent('/paid-downloads')}`;
          }
        })
        .catch(() => {});
    }
  }, [isWechat]);

  async function buy() {
    if (!product || loading) return;
    setLoading(true);
    setMessage('');
    setOrder(null);
    try {
      const res = await fetch('/api/pay/wechat/jsapi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productSlug: product.slug, contact }),
      });
      const data = await res.json();
      if (res.status === 401 && data.error === 'WECHAT_LOGIN_REQUIRED') {
        window.location.href = `/api/wechat/oauth/start?redirect=${encodeURIComponent('/paid-downloads')}`;
        return;
      }
      if (!res.ok) throw new Error(data.error || '下单失败');
      setOrder(data.order);
      await invokeWechatPay(data.payment);
      setMessage('已提交支付，请稍候确认订单状态。');
      pollOrder(data.order.orderNo);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '支付失败');
    } finally {
      setLoading(false);
    }
  }

  function invokeWechatPay(payment: Record<string, string>): Promise<void> {
    return new Promise((resolve, reject) => {
      const run = () => {
        if (!window.WeixinJSBridge) {
          reject(new Error('请在微信内打开本页完成支付'));
          return;
        }
        window.WeixinJSBridge.invoke('getBrandWCPayRequest', payment, res => {
          if (res.err_msg === 'get_brand_wcpay_request:ok') resolve();
          else reject(new Error(res.err_msg || '微信支付未完成'));
        });
      };
      if (typeof window.WeixinJSBridge === 'undefined') {
        document.addEventListener('WeixinJSBridgeReady', run, { once: true });
        setTimeout(run, 1800);
      } else {
        run();
      }
    });
  }

  function pollOrder(orderNo: string) {
    let count = 0;
    const timer = window.setInterval(async () => {
      count += 1;
      const res = await fetch(`/api/pay/orders/${orderNo}`).catch(() => null);
      const data = await res?.json().catch(() => null);
      if (data?.order) setOrder(data.order);
      if (data?.order?.status === 'paid' || count > 30) window.clearInterval(timer);
    }, 2000);
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '28px 20px 72px' }}>
      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(280px, 0.8fr)', gap: 24, alignItems: 'start' }}>
        <div>
          <div style={{ color: 'var(--ac)', fontSize: 12, letterSpacing: '0.24em', marginBottom: 10 }}>PAID DOWNLOAD</div>
          <h1 style={{ color: 'var(--tx-0)', fontSize: 'clamp(28px,4vw,44px)', margin: '0 0 12px', letterSpacing: '0.08em' }}>
            完整文档下载
          </h1>
          <p style={{ color: 'var(--tx-2)', lineHeight: 1.8, maxWidth: 680 }}>
            付费后可下载完整整理文档。文档文件由后台配置，支付成功后生成限时下载链接，可在有效期内重复下载。
          </p>
          {!isWechat && (
            <div style={noticeStyle}>
              当前第一版仅支持微信内网页支付。请用微信扫描或转发本页链接后打开。
            </div>
          )}
          {setupError && <div style={errorStyle}>{setupError}</div>}
          {!products.length && !setupError && <div style={noticeStyle}>暂无上架商品，请在后台配置商品并确认文件路径。</div>}
          <div style={{ display: 'grid', gap: 12, marginTop: 22 }}>
            {products.map(item => (
              <button
                key={item.slug}
                onClick={() => setSelected(item.slug)}
                style={{
                  ...productButton,
                  borderColor: selected === item.slug ? 'var(--ac-bdr)' : 'var(--bdr)',
                  background: selected === item.slug ? 'rgba(184,146,42,0.08)' : 'var(--bg-card)',
                }}
              >
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.description}</small>
                  <small style={{ color: item.fileReady ? '#16803c' : '#b42318' }}>{item.fileReady ? '文件已就绪' : '文件未就绪，请联系管理员'}</small>
                </span>
                <b>¥{(item.amountCents / 100).toFixed(2)}</b>
              </button>
            ))}
          </div>
        </div>

        <aside style={{ background: 'var(--bg-card)', border: '1px solid var(--bdr)', borderRadius: 8, padding: 18 }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 18, color: 'var(--tx-0)' }}>购买信息</h2>
          <label style={labelStyle}>手机号或邮箱</label>
          <input
            value={contact}
            onChange={e => setContact(e.target.value)}
            placeholder="用于找回订单"
            style={inputStyle}
          />
          <button disabled={!product || !isWechat || loading} onClick={buy} style={payButton}>
            {loading ? '处理中...' : product ? `微信支付 ¥${(product.amountCents / 100).toFixed(2)}` : '暂无商品'}
          </button>
          {message && <div style={message.includes('失败') || message.includes('未完成') ? errorStyle : noticeStyle}>{message}</div>}
          {order && (
            <div style={{ marginTop: 14, borderTop: '1px solid var(--bdr)', paddingTop: 14, display: 'grid', gap: 8, fontSize: 13 }}>
              <div>订单号：<strong>{order.orderNo}</strong></div>
              <div>状态：<strong style={{ color: order.status === 'paid' ? '#16803c' : '#9a6700' }}>{order.status}</strong></div>
              {order.downloadUrl && (
                <a href={order.downloadUrl} style={{ ...payButton, textAlign: 'center', textDecoration: 'none', display: 'block' }}>
                  下载文档
                </a>
              )}
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, color: 'var(--tx-3)', marginBottom: 6 };
const inputStyle: React.CSSProperties = { width: '100%', height: 42, border: '1px solid var(--bdr)', borderRadius: 6, background: 'var(--bg-page)', color: 'var(--tx-0)', padding: '0 10px' };
const payButton: React.CSSProperties = { width: '100%', marginTop: 12, border: 'none', borderRadius: 6, background: 'var(--ac)', color: '#fff', padding: '12px 14px', fontWeight: 700, cursor: 'pointer' };
const noticeStyle: React.CSSProperties = { marginTop: 14, padding: 12, borderRadius: 8, border: '1px solid rgba(184,146,42,0.25)', color: 'var(--tx-2)', background: 'rgba(184,146,42,0.06)', fontSize: 13, lineHeight: 1.6 };
const errorStyle: React.CSSProperties = { marginTop: 14, padding: 12, borderRadius: 8, border: '1px solid rgba(180,35,24,0.25)', color: '#b42318', background: 'rgba(180,35,24,0.06)', fontSize: 13, lineHeight: 1.6 };
const productButton: React.CSSProperties = { width: '100%', border: '1px solid var(--bdr)', borderRadius: 8, padding: 16, display: 'flex', justifyContent: 'space-between', gap: 16, textAlign: 'left', color: 'var(--tx-0)', cursor: 'pointer' };
