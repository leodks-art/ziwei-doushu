import { NextResponse } from 'next/server';
import { logAccess } from '@/lib/server/access-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  await logAccess(req, 'page_view', { page: String(body.page || '') });
  return NextResponse.json({ ok: true });
}
