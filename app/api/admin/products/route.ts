import { NextResponse } from 'next/server';
import { adminUnauthorized, requireAdminSession } from '@/lib/server/admin-auth';
import { createProduct, inspectPaidFile, listProducts } from '@/lib/server/commerce';
import { logAccess } from '@/lib/server/access-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAdminSession();
    const products = await listProducts();
    return NextResponse.json({
      products: products.map(p => ({ ...p, file: inspectPaidFile(p.filePath) })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return adminUnauthorized();
    return NextResponse.json({ error: error instanceof Error ? error.message : '读取商品失败' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await requireAdminSession();
    const body = await req.json();
    const product = await createProduct({
      slug: String(body.slug || '').trim(),
      title: String(body.title || '').trim(),
      description: String(body.description || ''),
      amountCents: Number(body.amountCents || 0),
      filePath: body.filePath ? String(body.filePath) : null,
      active: Boolean(body.active),
    });
    await logAccess(req, 'admin_product_create', { productSlug: product.slug });
    return NextResponse.json({ product });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return adminUnauthorized();
    return NextResponse.json({ error: error instanceof Error ? error.message : '创建商品失败' }, { status: 400 });
  }
}
