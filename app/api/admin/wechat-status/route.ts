import { NextResponse } from 'next/server';
import { adminUnauthorized, requireAdminSession } from '@/lib/server/admin-auth';
import { hasDatabaseConfig } from '@/lib/server/db';
import { wechatCallbackVerifyConfigured, wechatOfficialConfigured, wechatPayConfigured } from '@/lib/server/wechat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAdminSession();
    return NextResponse.json({
      database: hasDatabaseConfig(),
      officialAccount: wechatOfficialConfigured(),
      pay: wechatPayConfigured(),
      callbackVerify: wechatCallbackVerifyConfigured(),
      paidFileRoot: Boolean(process.env.PAID_FILE_ROOT),
      notifyUrl: process.env.WECHAT_PAY_NOTIFY_URL || null,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return adminUnauthorized();
    return NextResponse.json({ error: '状态读取失败' }, { status: 500 });
  }
}
