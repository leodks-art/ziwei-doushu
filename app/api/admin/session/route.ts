import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/server/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getAdminSession();
  return NextResponse.json({ loggedIn: Boolean(session), username: session?.username ?? null });
}
