import { NextResponse } from 'next/server';
import {
  attachPrepay,
  createPendingOrder,
  ensureUserByOpenid,
  getActiveProductBySlug,
  normalizeContact,
  publicOrder,
} from '@/lib/server/commerce';
import { getUserSession } from '@/lib/server/user-session';
import { createJsapiPrepay, wechatPayConfigured } from '@/lib/server/wechat';
import { logAccess } from '@/lib/server/access-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    if (!wechatPayConfigured()) throw new Error('微信支付配置未完成');
    const session = await getUserSession();
    if (!session) {
      return NextResponse.json({ error: 'WECHAT_LOGIN_REQUIRED' }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    const productSlug = String(body.productSlug || '');
    const product = await getActiveProductBySlug(productSlug);
    if (!product) return NextResponse.json({ error: '商品不存在或未上架' }, { status: 404 });
    const { contact, contactType } = normalizeContact(body.contact);
    const user = await ensureUserByOpenid(session.openid);
    const order = await createPendingOrder({
      product,
      userId: user.id,
      openid: session.openid,
      contact,
      contactType,
    });
    const prepay = await createJsapiPrepay({
      orderNo: order.orderNo,
      description: product.title,
      amountCents: product.amountCents,
      openid: session.openid,
      attach: product.slug,
    });
    await attachPrepay(order.orderNo, prepay.prepayId);
    await logAccess(req, 'wechat_jsapi_order', { orderNo: order.orderNo, openid: session.openid, productSlug });
    return NextResponse.json({ order: publicOrder(order), payment: prepay.payment });
  } catch (error) {
    await logAccess(req, 'wechat_jsapi_order_error', { error: error instanceof Error ? error.message : 'unknown' }, 400);
    return NextResponse.json({ error: error instanceof Error ? error.message : '下单失败' }, { status: 400 });
  }
}
