import { NextResponse } from 'next/server';
import { adminUnauthorized, requireAdminSession } from '@/lib/server/admin-auth';
import { publicOrder, refreshDownloadToken } from '@/lib/server/commerce';
import { logAccess } from '@/lib/server/access-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ orderNo: string }> }) {
  try {
    await requireAdminSession();
    const { orderNo } = await params;
    const order = await refreshDownloadToken(orderNo);
    if (!order) return NextResponse.json({ error: '订单未支付或不存在' }, { status: 404 });
    await logAccess(req, 'admin_refresh_download', { orderNo });
    return NextResponse.json({ order: publicOrder(order) });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return adminUnauthorized();
    return NextResponse.json({ error: error instanceof Error ? error.message : '补发失败' }, { status: 400 });
  }
}
