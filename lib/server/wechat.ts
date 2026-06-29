import crypto from 'crypto';
import fs from 'fs';
import { SITE_URL } from '@/lib/site';

export interface WechatOAuthResult {
  openid: string;
  unionid?: string;
  scope?: string;
}

export interface WechatPaymentParams {
  appId: string;
  timeStamp: string;
  nonceStr: string;
  package: string;
  signType: 'RSA';
  paySign: string;
}

function mustEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export function wechatOfficialConfigured(): boolean {
  return Boolean(process.env.WECHAT_OFFICIAL_APPID && process.env.WECHAT_OFFICIAL_SECRET);
}

export function wechatPayConfigured(): boolean {
  return Boolean(
    (process.env.WECHAT_PAY_APPID || process.env.WECHAT_OFFICIAL_APPID)
    && process.env.WECHAT_PAY_MCHID
    && process.env.WECHAT_PAY_MERCHANT_SERIAL_NO
    && (process.env.WECHAT_PAY_PRIVATE_KEY || process.env.WECHAT_PAY_PRIVATE_KEY_PATH)
    && process.env.WECHAT_PAY_API_V3_KEY,
  );
}

export function wechatCallbackVerifyConfigured(): boolean {
  return Boolean(process.env.WECHAT_PAY_PUBLIC_KEY || process.env.WECHAT_PAY_PUBLIC_KEY_PATH || process.env.WECHAT_PAY_PLATFORM_CERT_PATH);
}

export function buildOAuthUrl(state: string, redirectTo = '/paid-downloads'): string {
  const appid = mustEnv('WECHAT_OFFICIAL_APPID');
  const redirectUri = encodeURIComponent(`${SITE_URL}/api/wechat/oauth/callback?next=${encodeURIComponent(redirectTo)}`);
  return `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${appid}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_base&state=${encodeURIComponent(state)}#wechat_redirect`;
}

export async function exchangeOAuthCode(code: string): Promise<WechatOAuthResult> {
  const appid = mustEnv('WECHAT_OFFICIAL_APPID');
  const secret = mustEnv('WECHAT_OFFICIAL_SECRET');
  const url = new URL('https://api.weixin.qq.com/sns/oauth2/access_token');
  url.searchParams.set('appid', appid);
  url.searchParams.set('secret', secret);
  url.searchParams.set('code', code);
  url.searchParams.set('grant_type', 'authorization_code');
  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.json() as { openid?: string; unionid?: string; scope?: string; errmsg?: string; errcode?: number };
  if (!res.ok || !data.openid) {
    throw new Error(data.errmsg || `微信授权失败：${data.errcode ?? res.status}`);
  }
  return { openid: data.openid, unionid: data.unionid, scope: data.scope };
}

function readPrivateKey(): string {
  if (process.env.WECHAT_PAY_PRIVATE_KEY) {
    return process.env.WECHAT_PAY_PRIVATE_KEY.replace(/\\n/g, '\n');
  }
  return fs.readFileSync(mustEnv('WECHAT_PAY_PRIVATE_KEY_PATH'), 'utf8');
}

function readWechatPublicKey(): string | null {
  if (process.env.WECHAT_PAY_PUBLIC_KEY) return process.env.WECHAT_PAY_PUBLIC_KEY.replace(/\\n/g, '\n');
  const keyPath = process.env.WECHAT_PAY_PUBLIC_KEY_PATH || process.env.WECHAT_PAY_PLATFORM_CERT_PATH;
  if (!keyPath) return null;
  return fs.readFileSync(keyPath, 'utf8');
}

function nonce(): string {
  return crypto.randomBytes(16).toString('hex');
}

function signWithMerchantPrivateKey(message: string): string {
  return crypto.createSign('RSA-SHA256').update(message).sign(readPrivateKey(), 'base64');
}

function authorizationHeader(method: string, urlPath: string, body: string): string {
  const mchid = mustEnv('WECHAT_PAY_MCHID');
  const serialNo = mustEnv('WECHAT_PAY_MERCHANT_SERIAL_NO');
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonceStr = nonce();
  const message = `${method}\n${urlPath}\n${timestamp}\n${nonceStr}\n${body}\n`;
  const signature = signWithMerchantPrivateKey(message);
  return `WECHATPAY2-SHA256-RSA2048 mchid="${mchid}",nonce_str="${nonceStr}",signature="${signature}",timestamp="${timestamp}",serial_no="${serialNo}"`;
}

export async function createJsapiPrepay(input: {
  orderNo: string;
  description: string;
  amountCents: number;
  openid: string;
  attach?: string;
}): Promise<{ prepayId: string; payment: WechatPaymentParams }> {
  const appid = process.env.WECHAT_PAY_APPID || mustEnv('WECHAT_OFFICIAL_APPID');
  const mchid = mustEnv('WECHAT_PAY_MCHID');
  const notifyUrl = process.env.WECHAT_PAY_NOTIFY_URL || `${SITE_URL}/api/pay/wechat/notify`;
  const body = JSON.stringify({
    appid,
    mchid,
    description: input.description.slice(0, 127),
    out_trade_no: input.orderNo,
    notify_url: notifyUrl,
    amount: { total: input.amountCents, currency: 'CNY' },
    payer: { openid: input.openid },
    attach: input.attach?.slice(0, 128),
  });
  const urlPath = '/v3/pay/transactions/jsapi';
  const res = await fetch(`https://api.mch.weixin.qq.com${urlPath}`, {
    method: 'POST',
    headers: {
      Authorization: authorizationHeader('POST', urlPath, body),
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'ziwei-doushu-luchengdr/1.0',
    },
    body,
  });
  const data = await res.json().catch(() => ({})) as { prepay_id?: string; message?: string; code?: string };
  if (!res.ok || !data.prepay_id) {
    throw new Error(data.message || data.code || `微信下单失败：${res.status}`);
  }
  const payment = buildJsapiPaymentParams(appid, data.prepay_id);
  return { prepayId: data.prepay_id, payment };
}

function buildJsapiPaymentParams(appId: string, prepayId: string): WechatPaymentParams {
  const timeStamp = Math.floor(Date.now() / 1000).toString();
  const nonceStr = nonce();
  const pkg = `prepay_id=${prepayId}`;
  const message = `${appId}\n${timeStamp}\n${nonceStr}\n${pkg}\n`;
  return {
    appId,
    timeStamp,
    nonceStr,
    package: pkg,
    signType: 'RSA',
    paySign: signWithMerchantPrivateKey(message),
  };
}

export function verifyWechatPaySignature(req: Request, rawBody: string): boolean {
  if (process.env.WECHAT_PAY_SKIP_VERIFY === '1' && process.env.NODE_ENV !== 'production') return true;
  const publicKey = readWechatPublicKey();
  if (!publicKey) return false;
  const timestamp = req.headers.get('wechatpay-timestamp');
  const nonceStr = req.headers.get('wechatpay-nonce');
  const signature = req.headers.get('wechatpay-signature');
  if (!timestamp || !nonceStr || !signature) return false;
  const message = `${timestamp}\n${nonceStr}\n${rawBody}\n`;
  return crypto.createVerify('RSA-SHA256').update(message).verify(publicKey, signature, 'base64');
}

export function decryptWechatResource(resource: {
  algorithm?: string;
  ciphertext: string;
  nonce: string;
  associated_data?: string;
}): Record<string, unknown> {
  if (resource.algorithm && resource.algorithm !== 'AEAD_AES_256_GCM') {
    throw new Error(`不支持的微信回调加密算法：${resource.algorithm}`);
  }
  const key = Buffer.from(mustEnv('WECHAT_PAY_API_V3_KEY'), 'utf8');
  if (key.length !== 32) throw new Error('WECHAT_PAY_API_V3_KEY must be 32 bytes');
  const encrypted = Buffer.from(resource.ciphertext, 'base64');
  const authTag = encrypted.subarray(encrypted.length - 16);
  const ciphertext = encrypted.subarray(0, encrypted.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(resource.nonce, 'utf8'));
  decipher.setAuthTag(authTag);
  if (resource.associated_data) decipher.setAAD(Buffer.from(resource.associated_data, 'utf8'));
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  return JSON.parse(plain) as Record<string, unknown>;
}
