import fs from 'fs';
import path from 'path';
import { query, safeQuery } from './db';
import { randomId } from './security';

export type OrderStatus = 'pending' | 'paid' | 'closed' | 'refunded' | 'failed';

export interface PaidProduct {
  id: string;
  slug: string;
  title: string;
  description: string;
  amountCents: number;
  currency: string;
  filePath: string | null;
  active: boolean;
}

export interface PaidOrder {
  id: string;
  orderNo: string;
  productId: string;
  userId: string | null;
  openid: string | null;
  contact: string;
  contactType: string;
  amountCents: number;
  currency: string;
  status: OrderStatus;
  wechatPrepayId: string | null;
  wechatTransactionId: string | null;
  downloadToken: string | null;
  downloadExpiresAt: string | null;
  downloadLimit: number;
  downloadCount: number;
  lastError: string | null;
  createdAt: string;
  paidAt: string | null;
  productTitle?: string;
  productSlug?: string;
  filePath?: string | null;
}

function mapProduct(row: Record<string, unknown>): PaidProduct {
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    description: String(row.description ?? ''),
    amountCents: Number(row.amount_cents),
    currency: String(row.currency || 'CNY'),
    filePath: row.file_path ? String(row.file_path) : null,
    active: Boolean(row.active),
  };
}

function mapOrder(row: Record<string, unknown>): PaidOrder {
  return {
    id: String(row.id),
    orderNo: String(row.order_no),
    productId: String(row.product_id),
    userId: row.user_id ? String(row.user_id) : null,
    openid: row.openid ? String(row.openid) : null,
    contact: String(row.contact ?? ''),
    contactType: String(row.contact_type ?? 'unknown'),
    amountCents: Number(row.amount_cents),
    currency: String(row.currency || 'CNY'),
    status: String(row.status) as OrderStatus,
    wechatPrepayId: row.wechat_prepay_id ? String(row.wechat_prepay_id) : null,
    wechatTransactionId: row.wechat_transaction_id ? String(row.wechat_transaction_id) : null,
    downloadToken: row.download_token ? String(row.download_token) : null,
    downloadExpiresAt: row.download_expires_at ? new Date(String(row.download_expires_at)).toISOString() : null,
    downloadLimit: Number(row.download_limit ?? 5),
    downloadCount: Number(row.download_count ?? 0),
    lastError: row.last_error ? String(row.last_error) : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
    paidAt: row.paid_at ? new Date(String(row.paid_at)).toISOString() : null,
    productTitle: row.product_title ? String(row.product_title) : undefined,
    productSlug: row.product_slug ? String(row.product_slug) : undefined,
    filePath: row.file_path ? String(row.file_path) : undefined,
  };
}

export async function getActiveProducts(): Promise<PaidProduct[]> {
  const res = await safeQuery(
    `select id, slug, title, description, amount_cents, currency, file_path, active
     from paid_products
     where active = true
     order by created_at asc`,
  );
  return res?.rows.map(mapProduct) ?? [];
}

export async function listProducts(): Promise<PaidProduct[]> {
  const res = await query(
    `select id, slug, title, description, amount_cents, currency, file_path, active
     from paid_products
     order by created_at desc`,
  );
  return res.rows.map(mapProduct);
}

export async function createProduct(input: {
  slug: string;
  title: string;
  description?: string;
  amountCents: number;
  filePath?: string | null;
  active?: boolean;
}): Promise<PaidProduct> {
  const res = await query(
    `insert into paid_products (id, slug, title, description, amount_cents, currency, file_path, active)
     values ($1,$2,$3,$4,$5,'CNY',$6,$7)
     returning id, slug, title, description, amount_cents, currency, file_path, active`,
    [randomId('prod_'), input.slug, input.title, input.description ?? '', input.amountCents, input.filePath ?? null, Boolean(input.active)],
  );
  return mapProduct(res.rows[0]);
}

export async function updateProduct(id: string, input: Partial<{
  slug: string;
  title: string;
  description: string;
  amountCents: number;
  filePath: string | null;
  active: boolean;
}>): Promise<PaidProduct | null> {
  const current = await query(`select * from paid_products where id=$1`, [id]);
  if (!current.rowCount) return null;
  const product = mapProduct(current.rows[0]);
  const res = await query(
    `update paid_products
     set slug=$2, title=$3, description=$4, amount_cents=$5, file_path=$6, active=$7, updated_at=now()
     where id=$1
     returning id, slug, title, description, amount_cents, currency, file_path, active`,
    [
      id,
      input.slug ?? product.slug,
      input.title ?? product.title,
      input.description ?? product.description,
      input.amountCents ?? product.amountCents,
      input.filePath === undefined ? product.filePath : input.filePath,
      input.active ?? product.active,
    ],
  );
  return mapProduct(res.rows[0]);
}

export async function getActiveProductBySlug(slug: string): Promise<PaidProduct | null> {
  const res = await query(
    `select id, slug, title, description, amount_cents, currency, file_path, active
     from paid_products where slug=$1 and active=true`,
    [slug],
  );
  return res.rowCount ? mapProduct(res.rows[0]) : null;
}

export async function ensureUserByOpenid(openid: string): Promise<{ id: string; openid: string }> {
  const existing = await query(`select id, openid from app_users where openid=$1`, [openid]);
  if (existing.rowCount) return { id: String(existing.rows[0].id), openid: String(existing.rows[0].openid) };
  const res = await query(
    `insert into app_users (id, openid) values ($1,$2) returning id, openid`,
    [randomId('user_'), openid],
  );
  return { id: String(res.rows[0].id), openid: String(res.rows[0].openid) };
}

export function normalizeContact(raw: unknown): { contact: string; contactType: 'phone' | 'email' } {
  const contact = String(raw ?? '').trim();
  if (/^1[3-9]\d{9}$/.test(contact)) return { contact, contactType: 'phone' };
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) return { contact, contactType: 'email' };
  throw new Error('请输入有效手机号或邮箱');
}

export async function createPendingOrder(input: {
  product: PaidProduct;
  userId: string;
  openid: string;
  contact: string;
  contactType: string;
}): Promise<PaidOrder> {
  const orderNo = `ZW${Date.now()}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const res = await query(
    `insert into paid_orders
      (id, order_no, product_id, user_id, openid, contact, contact_type, amount_cents, currency, status)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending')
     returning *`,
    [
      randomId('ord_'),
      orderNo,
      input.product.id,
      input.userId,
      input.openid,
      input.contact,
      input.contactType,
      input.product.amountCents,
      input.product.currency,
    ],
  );
  return mapOrder(res.rows[0]);
}

export async function attachPrepay(orderNo: string, prepayId: string): Promise<void> {
  await query(`update paid_orders set wechat_prepay_id=$2, updated_at=now() where order_no=$1`, [orderNo, prepayId]);
}

export async function markOrderPaid(input: {
  orderNo: string;
  transactionId?: string | null;
  tradeState?: string;
  raw?: unknown;
}): Promise<PaidOrder | null> {
  const existing = await findOrderByOrderNo(input.orderNo);
  if (!existing) return null;
  if (existing.status === 'paid') return existing;
  const token = randomId('dl_');
  const res = await query(
    `update paid_orders
     set status='paid',
         wechat_transaction_id=$2,
         download_token=$3,
         download_expires_at=now() + interval '7 days',
         paid_at=now(),
         updated_at=now()
     where order_no=$1
     returning *`,
    [input.orderNo, input.transactionId ?? null, token],
  );
  await query(
    `insert into access_logs (id, event_type, method, path, status_code, order_no, metadata)
     values ($1,'wechat_paid','POST','/api/pay/wechat/notify',200,$2,$3::jsonb)`,
    [randomId('log_'), input.orderNo, JSON.stringify({ tradeState: input.tradeState, raw: input.raw })],
  );
  return mapOrder(res.rows[0]);
}

export async function markOrderFailed(orderNo: string, message: string): Promise<void> {
  await query(
    `update paid_orders set status='failed', last_error=$2, updated_at=now()
     where order_no=$1 and status <> 'paid'`,
    [orderNo, message.slice(0, 500)],
  );
}

export async function refreshDownloadToken(orderNo: string): Promise<PaidOrder | null> {
  const res = await query(
    `update paid_orders
     set download_token=$2, download_expires_at=now() + interval '7 days', download_count=0, updated_at=now()
     where order_no=$1 and status='paid'
     returning *`,
    [orderNo, randomId('dl_')],
  );
  return res.rowCount ? mapOrder(res.rows[0]) : null;
}

export async function findOrderByOrderNo(orderNo: string): Promise<PaidOrder | null> {
  const res = await query(
    `select o.*, p.title as product_title, p.slug as product_slug, p.file_path
     from paid_orders o
     join paid_products p on p.id=o.product_id
     where o.order_no=$1`,
    [orderNo],
  );
  return res.rowCount ? mapOrder(res.rows[0]) : null;
}

export async function listOrders(limit = 100): Promise<PaidOrder[]> {
  const res = await query(
    `select o.*, p.title as product_title, p.slug as product_slug, p.file_path
     from paid_orders o
     join paid_products p on p.id=o.product_id
     order by o.created_at desc
     limit $1`,
    [limit],
  );
  return res.rows.map(mapOrder);
}

export async function findDownloadByToken(token: string): Promise<PaidOrder | null> {
  const res = await query(
    `select o.*, p.title as product_title, p.slug as product_slug, p.file_path
     from paid_orders o
     join paid_products p on p.id=o.product_id
     where o.download_token=$1 and o.status='paid'`,
    [token],
  );
  return res.rowCount ? mapOrder(res.rows[0]) : null;
}

export async function recordDownload(order: PaidOrder, reqMeta: { ipHash: string | null; userAgent: string | null }): Promise<void> {
  await query('begin');
  try {
    await query(
      `update paid_orders set download_count=download_count+1, updated_at=now()
       where id=$1 and download_count < download_limit`,
      [order.id],
    );
    await query(
      `insert into download_events (id, order_id, ip_hash, user_agent)
       values ($1,$2,$3,$4)`,
      [randomId('de_'), order.id, reqMeta.ipHash, reqMeta.userAgent],
    );
    await query('commit');
  } catch (error) {
    await query('rollback');
    throw error;
  }
}

export function resolvePaidFile(filePath: string | null | undefined): string | null {
  if (!filePath) return null;
  if (path.isAbsolute(filePath)) return filePath;
  const root = process.env.PAID_FILE_ROOT;
  if (!root) return null;
  return path.join(root, filePath);
}

export function inspectPaidFile(filePath: string | null | undefined): { exists: boolean; fullPath: string | null; size: number | null } {
  const fullPath = resolvePaidFile(filePath);
  if (!fullPath) return { exists: false, fullPath: null, size: null };
  try {
    const stat = fs.statSync(fullPath);
    return { exists: stat.isFile(), fullPath, size: stat.isFile() ? stat.size : null };
  } catch {
    return { exists: false, fullPath, size: null };
  }
}

export function publicOrder(order: PaidOrder) {
  return {
    orderNo: order.orderNo,
    status: order.status,
    amountCents: order.amountCents,
    currency: order.currency,
    productTitle: order.productTitle,
    productSlug: order.productSlug,
    paidAt: order.paidAt,
    downloadExpiresAt: order.downloadExpiresAt,
    downloadLimit: order.downloadLimit,
    downloadCount: order.downloadCount,
    downloadUrl: order.status === 'paid' && order.downloadToken ? `/api/download/${order.downloadToken}` : null,
  };
}
