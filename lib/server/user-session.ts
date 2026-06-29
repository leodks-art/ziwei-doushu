import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nowSeconds, signJson, verifySignedJson } from './security';

export const USER_COOKIE = 'ziwei_user_session';
export const OAUTH_STATE_COOKIE = 'ziwei_oauth_state';

export interface UserSession {
  userId: string;
  openid: string;
  exp: number;
}

export interface OAuthState {
  nonce: string;
  redirectTo: string;
  exp: number;
}

function userSecret(): string {
  return process.env.USER_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET || 'change-me-user-session-secret';
}

export async function getUserSession(): Promise<UserSession | null> {
  const jar = await cookies();
  const payload = verifySignedJson<UserSession>(jar.get(USER_COOKIE)?.value, userSecret());
  if (!payload || typeof payload.userId !== 'string' || typeof payload.openid !== 'string' || typeof payload.exp !== 'number') {
    return null;
  }
  if (payload.exp < nowSeconds()) return null;
  return payload;
}

export function setUserCookie(res: NextResponse, session: Omit<UserSession, 'exp'>): void {
  const exp = nowSeconds() + 60 * 60 * 24 * 30;
  res.cookies.set(USER_COOKIE, signJson({ ...session, exp }, userSecret()), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function makeOAuthState(nonce: string, redirectTo: string): OAuthState {
  return { nonce, redirectTo, exp: nowSeconds() + 10 * 60 };
}

export function setOAuthStateCookie(res: NextResponse, state: OAuthState): void {
  res.cookies.set(OAUTH_STATE_COOKIE, signJson(state, userSecret()), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 10 * 60,
  });
}

export async function readOAuthStateCookie(): Promise<OAuthState | null> {
  const jar = await cookies();
  const state = verifySignedJson<OAuthState>(jar.get(OAUTH_STATE_COOKIE)?.value, userSecret());
  if (!state || typeof state.nonce !== 'string' || typeof state.redirectTo !== 'string' || typeof state.exp !== 'number') return null;
  if (state.exp < nowSeconds()) return null;
  return state;
}

export function clearOAuthStateCookie(res: NextResponse): void {
  res.cookies.set(OAUTH_STATE_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}
