import { NextResponse } from 'next/server';
import { calculateChartWithAudit } from '@/lib/ziwei/calculate';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = calculateChartWithAudit(body);
    return NextResponse.json({
      ...result.chart,
      audit: result.audit,
      patterns: result.patterns,
      sihua: result.sihua,
      sampleData: result.sampleData,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '命盘生成失败' },
      { status: 400 },
    );
  }
}
