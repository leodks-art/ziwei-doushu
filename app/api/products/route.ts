import { NextResponse } from 'next/server';
import { getActiveProducts, inspectPaidFile } from '@/lib/server/commerce';
import { hasDatabaseConfig } from '@/lib/server/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    if (!hasDatabaseConfig()) {
      return NextResponse.json({
        products: [],
        setupError: 'DATABASE_URL is not configured',
      });
    }
    const products = await getActiveProducts();
    return NextResponse.json({
      products: products.map(product => ({
        slug: product.slug,
        title: product.title,
        description: product.description,
        amountCents: product.amountCents,
        currency: product.currency,
        fileReady: inspectPaidFile(product.filePath).exists,
      })),
    });
  } catch (error) {
    return NextResponse.json({
      products: [],
      setupError: error instanceof Error ? error.message : '商品配置不可用',
    });
  }
}
