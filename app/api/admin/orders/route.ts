import { NextResponse } from 'next/server';
import { adminUnauthorized, requireAdminSession } from '@/lib/server/admin-auth';
import { listOrders } from '@/lib/server/commerce';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    await requireAdminSession();
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get('limit') || 100), 300);
    const orders = await listOrders(limit);
    return NextResponse.json({ orders });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return adminUnauthorized();
    return NextResponse.json({ error: error instanceof Error ? error.message : '读取订单失败' }, { status: 500 });
  }
}
