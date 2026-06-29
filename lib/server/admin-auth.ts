import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nowSeconds, signJson, verifyPassword, verifySignedJson } from './security';

export const ADMIN_COOKIE = 'ziwei_admin_session';

export interface AdminSession {
  username: string;
  exp: number;
}

function adminSecret(): string {
  return process.env.ADMIN_SESSION_SECRET || process.env.NEXTAUTH_SECRET || 'change-me-admin-session-secret';
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const jar = await cookies();
  const payload = verifySignedJson<AdminSession>(jar.get(ADMIN_COOKIE)?.value, adminSecret());
  if (!payload || typeof payload.username !== 'string' || typeof payload.exp !== 'number') return null;
  if (payload.exp < nowSeconds()) return null;
  return payload;
}

export async function requireAdminSession(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) throw new Error('UNAUTHORIZED');
  return session;
}

export function validateAdminLogin(username: string, password: string): boolean {
  const expectedUser = process.env.ADMIN_USERNAME;
  const hash = process.env.ADMIN_PASSWORD_HASH || process.env.ADMIN_PASSWORD;
  if (!expectedUser || !hash) return false;
  return username === expectedUser && verifyPassword(password, hash);
}

export function setAdminCookie(res: NextResponse, username: string): void {
  const exp = nowSeconds() + 60 * 60 * 12;
  res.cookies.set(ADMIN_COOKIE, signJson({ username, exp }, adminSecret()), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12,
  });
}

export function clearAdminCookie(res: NextResponse): void {
  res.cookies.set(ADMIN_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}

export function adminUnauthorized() {
  return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
}
