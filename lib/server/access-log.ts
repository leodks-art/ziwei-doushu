import { query } from './db';
import { getClientIp, hashRequestValue, randomId } from './security';

export async function logAccess(req: Request, eventType: string, metadata: Record<string, unknown> = {}, statusCode = 200) {
  if (!process.env.DATABASE_URL) return;
  try {
    const url = new URL(req.url);
    await query(
      `insert into access_logs
        (id, event_type, method, path, status_code, order_no, openid_hash, ip_hash, user_agent, metadata)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
      [
        randomId('log_'),
        eventType,
        req.method,
        url.pathname,
        statusCode,
        typeof metadata.orderNo === 'string' ? metadata.orderNo : null,
        typeof metadata.openid === 'string' ? hashRequestValue(metadata.openid) : null,
        hashRequestValue(getClientIp(req)),
        req.headers.get('user-agent'),
        JSON.stringify(metadata),
      ],
    );
  } catch {
    // Logging should never break the user-facing flow.
  }
}
