import crypto from 'crypto';

export function randomId(prefix = ''): string {
  return `${prefix}${crypto.randomBytes(16).toString('hex')}`;
}

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function hashRequestValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const salt = process.env.LOG_HASH_SALT || process.env.ADMIN_SESSION_SECRET || 'ziwei-log-salt';
  return crypto.createHmac('sha256', salt).update(value).digest('hex');
}

export function signJson(payload: object, secret: string): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySignedJson<T extends object>(token: string | undefined, secret: string): T | null {
  if (!token) return null;
  const [encoded, sig] = token.split('.');
  if (!encoded || !sig) return null;
  const expected = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  if (!timingSafeEqual(sig, expected)) return null;
  try {
    return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

export function timingSafeEqual(a: string, b: string): boolean {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

export function pbkdf2Hash(password: string, salt = crypto.randomBytes(16).toString('hex')): string {
  const iterations = 210_000;
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256').toString('hex');
  return `pbkdf2$${iterations}$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  if (stored.startsWith('pbkdf2$')) {
    const [, iterRaw, salt, hash] = stored.split('$');
    const iterations = Number(iterRaw);
    if (!iterations || !salt || !hash) return false;
    const candidate = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256').toString('hex');
    return timingSafeEqual(candidate, hash);
  }
  if (stored.startsWith('sha256:')) {
    return timingSafeEqual(sha256Hex(password), stored.slice('sha256:'.length));
  }
  return timingSafeEqual(password, stored);
}

export function getClientIp(req: Request): string | null {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || req.headers.get('x-real-ip') || null;
}
