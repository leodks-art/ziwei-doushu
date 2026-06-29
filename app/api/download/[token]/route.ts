import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { NextResponse } from 'next/server';
import { findDownloadByToken, inspectPaidFile, recordDownload } from '@/lib/server/commerce';
import { getClientIp, hashRequestValue } from '@/lib/server/security';
import { logAccess } from '@/lib/server/access-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const order = await findDownloadByToken(token);
  if (!order) return NextResponse.json({ error: '下载链接无效' }, { status: 404 });
  if (!order.downloadExpiresAt || new Date(order.downloadExpiresAt).getTime() < Date.now()) {
    return NextResponse.json({ error: '下载链接已过期' }, { status: 410 });
  }
  if (order.downloadCount >= order.downloadLimit) {
    return NextResponse.json({ error: '下载次数已用完' }, { status: 429 });
  }
  const file = inspectPaidFile(order.filePath);
  if (!file.exists || !file.fullPath) {
    return NextResponse.json({ error: '付费文件未配置或不存在' }, { status: 404 });
  }
  await recordDownload(order, {
    ipHash: hashRequestValue(getClientIp(req)),
    userAgent: req.headers.get('user-agent'),
  });
  await logAccess(req, 'paid_download', { orderNo: order.orderNo }, 200);
  const stream = fs.createReadStream(file.fullPath);
  const filename = path.basename(file.fullPath);
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(file.size ?? ''),
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'private, no-store',
    },
  });
}
