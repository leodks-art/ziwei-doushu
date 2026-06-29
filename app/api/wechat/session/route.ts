import { NextResponse } from 'next/server';
import { getUserSession } from '@/lib/server/user-session';
import { wechatOfficialConfigured } from '@/lib/server/wechat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await getUserSession();
  const url = new URL(req.url);
  const redirectTo = url.searchParams.get('redirect') || '/paid-downloads';
  return NextResponse.json({
    loggedIn: Boolean(session),
    user: session ? { userId: session.userId, openidTail: session.openid.slice(-6) } : null,
    wechatConfigured: wechatOfficialConfigured(),
    authUrl: wechatOfficialConfigured() ? `/api/wechat/oauth/start?redirect=${encodeURIComponent(redirectTo)}` : null,
  });
}
