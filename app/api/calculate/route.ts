import { NextResponse } from 'next/server';
import { calculateChartWithAudit } from '@/lib/ziwei/calculate';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const birthInfo = {
    year: url.searchParams.get('year') ?? url.searchParams.get('y'),
    month: url.searchParams.get('month') ?? url.searchParams.get('m'),
    day: url.searchParams.get('day') ?? url.searchParams.get('d'),
    hour: url.searchParams.get('hour') ?? url.searchParams.get('h') ?? '0',
    gender: normalizeGender(url.searchParams.get('gender') ?? url.searchParams.get('g')),
    name: url.searchParams.get('name') ?? undefined,
    province: url.searchParams.get('province') ?? undefined,
    city: url.searchParams.get('city') ?? undefined,
    longitude: url.searchParams.get('longitude') ?? undefined,
    inputCalendar: url.searchParams.get('inputCalendar') ?? url.searchParams.get('cal') ?? undefined,
    isLeapMonth: url.searchParams.get('leap') === '1',
    annotationTopics: url.searchParams.get('topics')?.split(','),
  };
  return respond(birthInfo);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  return respond(body.birthInfo ?? body);
}

function respond(input: unknown) {
  try {
    return NextResponse.json(calculateChartWithAudit(input));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '命盘测算失败' },
      { status: 400 },
    );
  }
}

function normalizeGender(value: string | null): 'male' | 'female' {
  return value === 'female' || value === 'f' ? 'female' : 'male';
}
