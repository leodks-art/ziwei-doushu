import { NextResponse } from 'next/server';
import { adminUnauthorized, requireAdminSession } from '@/lib/server/admin-auth';
import { updateProduct } from '@/lib/server/commerce';
import { logAccess } from '@/lib/server/access-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminSession();
    const { id } = await params;
    const body = await req.json();
    const product = await updateProduct(id, {
      slug: body.slug === undefined ? undefined : String(body.slug).trim(),
      title: body.title === undefined ? undefined : String(body.title).trim(),
      description: body.description === undefined ? undefined : String(body.description),
      amountCents: body.amountCents === undefined ? undefined : Number(body.amountCents),
      filePath: body.filePath === undefined ? undefined : body.filePath ? String(body.filePath) : null,
      active: body.active === undefined ? undefined : Boolean(body.active),
    });
    if (!product) return NextResponse.json({ error: '商品不存在' }, { status: 404 });
    await logAccess(req, 'admin_product_update', { productSlug: product.slug });
    return NextResponse.json({ product });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return adminUnauthorized();
    return NextResponse.json({ error: error instanceof Error ? error.message : '更新商品失败' }, { status: 400 });
  }
}
