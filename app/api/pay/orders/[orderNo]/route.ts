import { NextResponse } from 'next/server';
import { findOrderByOrderNo, publicOrder } from '@/lib/server/commerce';
import { getUserSession } from '@/lib/server/user-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ orderNo: string }> }) {
  const { orderNo } = await params;
  const order = await findOrderByOrderNo(orderNo);
  if (!order) return NextResponse.json({ error: '订单不存在' }, { status: 404 });
  const session = await getUserSession();
  if (session && order.openid && session.openid !== order.openid) {
    return NextResponse.json({ error: '订单不属于当前用户' }, { status: 403 });
  }
  return NextResponse.json({ order: publicOrder(order) });
}
