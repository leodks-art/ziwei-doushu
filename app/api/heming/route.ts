import { calculateChartWithAudit } from '@/lib/ziwei/calculate';
import { BRANCHES } from '@/lib/ziwei/constants';
import { SIHUA_IN_FUQI_GU, STAR_IN_FUQI_GU } from '@/lib/ziwei/heming-knowledge';
import type { Palace, ZiweiChart } from '@/lib/ziwei/types';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const chartA = normalizeChart(body.chartA ?? body.a, '甲方');
    const chartB = normalizeChart(body.chartB ?? body.b, '乙方');
    return streamText(buildHemingText(chartA, chartB, String(body.question ?? '')));
  } catch (error) {
    return streamText([
      '**【合盘失败】**',
      error instanceof Error ? error.message : '请求无法解析',
      '',
      '请确认双方出生年份、月份、日期、时辰和性别已经填写完整。',
    ].join('\n'));
  }
}

function normalizeChart(input: unknown, label: string): ZiweiChart {
  const source = input as { birthInfo?: unknown } | null;
  const birthInfo = source?.birthInfo ?? input;
  if (!birthInfo) throw new Error(`${label}出生信息缺失`);
  return calculateChartWithAudit(birthInfo).chart;
}

function buildHemingText(a: ZiweiChart, b: ZiweiChart, question: string): string {
  const aProfile = profile(a, '甲方');
  const bProfile = profile(b, '乙方');
  const score = compatibilityScore(aProfile, bProfile);
  const matches = mutualMatches(aProfile, bProfile);

  return [
    '**【复核推导】**',
    `已重新复核双方出生信息并生成两张命盘。甲方：${formatBirth(a)}，命宫${palaceLabel(aProfile.ming)}，夫妻宫${palaceLabel(aProfile.spouse)}。乙方：${formatBirth(b)}，命宫${palaceLabel(bProfile.ming)}，夫妻宫${palaceLabel(bProfile.spouse)}。`,
    `本次合盘以双方命宫、夫妻宫、福德宫、四化与三方星性互参，综合匹配度为 ${score} / 100。`,
    '',
    '**【双方命格】**',
    `甲方命宫主星：${starList(aProfile.ming)}；福德宫：${starList(aProfile.fude)}。${spouseAdvice('甲方', aProfile.spouse)}`,
    `乙方命宫主星：${starList(bProfile.ming)}；福德宫：${starList(bProfile.fude)}。${spouseAdvice('乙方', bProfile.spouse)}`,
    '',
    '**【夫妻宫互参】**',
    matches.length
      ? matches.map(item => `- ${item}`).join('\n')
      : '- 双方夫妻宫与对方命宫未形成明显主星直应，关系更依赖后天沟通、共同目标与现实经营。',
    '',
    '**【四化与相处重点】**',
    sihuaSummary('甲方', aProfile),
    sihuaSummary('乙方', bProfile),
    '',
    '**【合盘建议】**',
    score >= 75
      ? '双方星性有较强互补或呼应，适合把共同目标、财务计划和家庭边界提前讲清楚，关系会更稳。'
      : score >= 58
        ? '双方有缘分基础，但需要主动经营沟通节奏。遇到压力时，先看福德宫所代表的情绪承载，再谈现实分工。'
        : '双方关系容易出现期待落差。若要长期相处，建议放慢推进速度，先观察金钱观、家庭边界和冲突处理方式。',
    question ? questionReply(question, aProfile, bProfile) : '',
    '',
    '**【边界说明】**',
    '以上为传统术数文化学习与排盘规则解释，不构成婚姻、法律、医疗、投资或重大人生决策建议。',
  ].filter(Boolean).join('\n');
}

function profile(chart: ZiweiChart, label: string) {
  return {
    label,
    chart,
    ming: getPalace(chart, '命'),
    spouse: getPalace(chart, '夫妻'),
    fude: getPalace(chart, '福德'),
    career: getPalace(chart, '官禄'),
    wealth: getPalace(chart, '财帛'),
  };
}

function getPalace(chart: ZiweiChart, name: string): Palace {
  const found = chart.palaces.find(p => p.name.includes(name));
  if (!found) throw new Error(`命盘缺少${name}宫`);
  return found;
}

function formatBirth(chart: ZiweiChart): string {
  const birth = chart.birthInfo;
  const input = birth.inputDate;
  const inputText = input
    ? `${input.calendar === 'lunar' ? '农历' : '公历'}${input.isLeapMonth ? '闰' : ''}${input.year}年${input.month}月${input.day}日`
    : `公历${birth.year}年${birth.month}月${birth.day}日`;
  return `${inputText}，${birth.gender === 'male' ? '男命' : '女命'}，${BRANCHES[birth.hour] ?? birth.hour}时`;
}

function palaceLabel(palace: Palace): string {
  return `${palace.name}(${BRANCHES[palace.branch]})，主星${starList(palace)}`;
}

function majorStars(palace: Palace): string[] {
  return palace.stars.filter(star => star.type === 'major').map(star => star.name);
}

function starList(palace: Palace): string {
  const stars = majorStars(palace);
  if (stars.length) return stars.join('、');
  return palace.borrowedStars?.length ? `空宫借${palace.borrowedFromName ?? '对宫'}：${palace.borrowedStars.join('、')}` : '无主星';
}

function spouseAdvice(label: string, spouse: Palace): string {
  const star = majorStars(spouse)[0];
  if (!star) return `${label}夫妻宫无主星，需借对宫星性判断，感情重在现实经营。`;
  const rule = STAR_IN_FUQI_GU[star];
  if (!rule) return `${label}夫妻宫见${star}，宜结合福德宫看长久承受力。`;
  return `${label}夫妻宫见${star}：${rule.summary}；${rule.timing}`;
}

function mutualMatches(a: ReturnType<typeof profile>, b: ReturnType<typeof profile>): string[] {
  const aSpouse = new Set(majorStars(a.spouse));
  const bSpouse = new Set(majorStars(b.spouse));
  const aMing = majorStars(a.ming);
  const bMing = majorStars(b.ming);
  const lines: string[] = [];

  const aToB = bMing.filter(star => aSpouse.has(star));
  if (aToB.length) lines.push(`甲方夫妻宫主星对应乙方命宫主星：${aToB.join('、')}，甲方对乙方容易有“配偶感”。`);

  const bToA = aMing.filter(star => bSpouse.has(star));
  if (bToA.length) lines.push(`乙方夫妻宫主星对应甲方命宫主星：${bToA.join('、')}，乙方对甲方也容易产生关系投射。`);

  const sharedFude = majorStars(a.fude).filter(star => majorStars(b.fude).includes(star));
  if (sharedFude.length) lines.push(`双方福德宫有共同主星：${sharedFude.join('、')}，情绪节奏与内在需求较容易互相理解。`);

  return lines;
}

function compatibilityScore(a: ReturnType<typeof profile>, b: ReturnType<typeof profile>): number {
  let score = 56;
  score += mutualMatches(a, b).length * 12;
  if (hasGoodSihua(a.spouse)) score += 7;
  if (hasGoodSihua(b.spouse)) score += 7;
  if (hasBadSihua(a.spouse)) score -= 8;
  if (hasBadSihua(b.spouse)) score -= 8;
  score -= hardShaCount(a.spouse) * 4;
  score -= hardShaCount(b.spouse) * 4;
  return Math.max(35, Math.min(92, score));
}

function hasGoodSihua(palace: Palace): boolean {
  return palace.stars.some(star => star.siHua === '禄' || star.siHua === '科');
}

function hasBadSihua(palace: Palace): boolean {
  return palace.stars.some(star => star.siHua === '忌');
}

function hardShaCount(palace: Palace): number {
  const hard = new Set(['火星', '铃星', '擎羊', '陀罗', '地空', '地劫']);
  return palace.stars.filter(star => hard.has(star.name)).length;
}

function sihuaSummary(label: string, item: ReturnType<typeof profile>): string {
  const marks = item.spouse.stars.filter(star => star.siHua);
  if (!marks.length) return `- ${label}夫妻宫未见本命四化主星，关系重点落在主星性格与福德宫承受力。`;
  return marks.map(star => {
    const text = SIHUA_IN_FUQI_GU[`化${star.siHua}` as keyof typeof SIHUA_IN_FUQI_GU] ?? '需结合星性与三方四正判断。';
    return `- ${label}夫妻宫${star.name}化${star.siHua}：${text}`;
  }).join('\n');
}

function questionReply(question: string, a: ReturnType<typeof profile>, b: ReturnType<typeof profile>): string {
  if (/合伙|创业|事业|工作/.test(question)) {
    return `\n**【追问回应】**\n合伙先看官禄与财帛。甲方官禄宫：${starList(a.career)}，财帛宫：${starList(a.wealth)}；乙方官禄宫：${starList(b.career)}，财帛宫：${starList(b.wealth)}。若要合作，建议先定权责与分账规则，再谈感情或信任。`;
  }
  if (/财|钱|收入|投资/.test(question)) {
    return `\n**【追问回应】**\n财务互补要看财帛宫与夫妻宫四化。甲方财帛宫${starList(a.wealth)}，乙方财帛宫${starList(b.wealth)}。关系中不宜混同个人账户与共同支出。`;
  }
  if (/矛盾|冲突|吵|不合/.test(question)) {
    return `\n**【追问回应】**\n矛盾点优先看夫妻宫与福德宫。甲方福德宫${starList(a.fude)}，乙方福德宫${starList(b.fude)}。双方压力大时，应先处理情绪承载，再处理对错。`;
  }
  return `\n**【追问回应】**\n针对“${question}”，建议回到双方命宫、夫妻宫、福德宫三处互参：命宫看本性，夫妻宫看关系投射，福德宫看能否长久承受。`;
}

function streamText(text: string) {
  const encoder = new TextEncoder();
  const chunks = chunkText(text, 72);
  const stream = new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: { text: chunk } })}\n\n`));
        await new Promise(resolve => setTimeout(resolve, 8));
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

function chunkText(text: string, size: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) chunks.push(text.slice(i, i + size));
  return chunks;
}
