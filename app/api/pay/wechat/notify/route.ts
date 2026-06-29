import { NextResponse } from 'next/server';
import { markOrderFailed, markOrderPaid } from '@/lib/server/commerce';
import { decryptWechatResource, verifyWechatPaySignature } from '@/lib/server/wechat';
import { logAccess } from '@/lib/server/access-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const rawBody = await req.text();
  try {
    if (!verifyWechatPaySignature(req, rawBody)) {
      await logAccess(req, 'wechat_notify_verify_failed', {}, 401);
      return NextResponse.json({ code: 'FAIL', message: '验签失败' }, { status: 401 });
    }
    const payload = JSON.parse(rawBody) as {
      resource?: {
        algorithm?: string;
        ciphertext: string;
        nonce: string;
        associated_data?: string;
      };
    };
    if (!payload.resource) throw new Error('微信回调缺少 resource');
    const data = decryptWechatResource(payload.resource);
    const orderNo = String(data.out_trade_no || '');
    const tradeState = String(data.trade_state || '');
    if (!orderNo) throw new Error('微信回调缺少商户订单号');
    if (tradeState === 'SUCCESS') {
      await markOrderPaid({
        orderNo,
        transactionId: data.transaction_id ? String(data.transaction_id) : null,
        tradeState,
        raw: data,
      });
    } else {
      await markOrderFailed(orderNo, tradeState || '支付未成功');
    }
    await logAccess(req, 'wechat_notify', { orderNo, tradeState }, 200);
    return NextResponse.json({ code: 'SUCCESS', message: '成功' });
  } catch (error) {
    await logAccess(req, 'wechat_notify_error', { error: error instanceof Error ? error.message : 'unknown' }, 500);
    return NextResponse.json({ code: 'FAIL', message: error instanceof Error ? error.message : '处理失败' }, { status: 500 });
  }
}
