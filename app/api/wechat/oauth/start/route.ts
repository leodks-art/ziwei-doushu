import { NextResponse } from 'next/server';
import { buildOAuthUrl } from '@/lib/server/wechat';
import { makeOAuthState, setOAuthStateCookie } from '@/lib/server/user-session';
import { randomId } from '@/lib/server/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const redirectTo = sanitizeRedirect(url.searchParams.get('redirect') || '/paid-downloads');
    const nonce = randomId('oauth_');
    const res = NextResponse.redirect(buildOAuthUrl(nonce, redirectTo));
    setOAuthStateCookie(res, makeOAuthState(nonce, redirectTo));
    return res;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '微信授权配置缺失' }, { status: 500 });
  }
}

function sanitizeRedirect(value: string): string {
  if (!value.startsWith('/')) return '/paid-downloads';
  if (value.startsWith('//')) return '/paid-downloads';
  return value;
}
