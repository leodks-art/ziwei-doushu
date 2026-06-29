import { NextResponse } from 'next/server';
import { setAdminCookie, validateAdminLogin } from '@/lib/server/admin-auth';
import { logAccess } from '@/lib/server/access-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const username = String(body.username || '');
  const password = String(body.password || '');
  if (!validateAdminLogin(username, password)) {
    await logAccess(req, 'admin_login_failed', { username }, 401);
    return NextResponse.json({ error: '账号或密码错误' }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  setAdminCookie(res, username);
  await logAccess(req, 'admin_login', { username });
  return res;
}
