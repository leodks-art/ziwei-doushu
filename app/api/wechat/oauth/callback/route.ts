import { NextResponse } from 'next/server';
import { ensureUserByOpenid } from '@/lib/server/commerce';
import { exchangeOAuthCode } from '@/lib/server/wechat';
import { clearOAuthStateCookie, readOAuthStateCookie, setUserCookie } from '@/lib/server/user-session';
import { SITE_URL } from '@/lib/site';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieState = await readOAuthStateCookie();
  const redirectTo = cookieState?.redirectTo || sanitizeRedirect(url.searchParams.get('next') || '/paid-downloads');

  try {
    if (!code) throw new Error('微信授权缺少 code');
    if (!cookieState || cookieState.nonce !== state) throw new Error('微信授权 state 校验失败');
    const wx = await exchangeOAuthCode(code);
    const user = await ensureUserByOpenid(wx.openid);
    const res = NextResponse.redirect(`${SITE_URL}${redirectTo}`);
    setUserCookie(res, { userId: user.id, openid: wx.openid });
    clearOAuthStateCookie(res);
    return res;
  } catch (error) {
    const res = NextResponse.redirect(`${SITE_URL}${redirectTo}?wechat_error=${encodeURIComponent(error instanceof Error ? error.message : '微信授权失败')}`);
    clearOAuthStateCookie(res);
    return res;
  }
}

function sanitizeRedirect(value: string): string {
  if (!value.startsWith('/') || value.startsWith('//')) return '/paid-downloads';
  return value;
}
