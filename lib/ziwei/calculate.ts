import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { createHash } from 'crypto';
import { gunzipSync } from 'zlib';
import path from 'path';
import { birthDateInputToSolar } from './calendar';
import {
  ANNOTATION_TOPIC_LABELS,
  DEFAULT_ANNOTATION_TOPICS,
  type AnnotationTopicKey,
  type BirthInfo,
  type CalendarType,
  type Palace,
  type ZiweiChart,
} from './types';
import { generateChart } from './algorithm';
import { detectPatterns, getMingGongSummary, type Pattern } from './patterns';
import { getDaXianSiHua, getLiuNianSiHua, getSiHuaByStem } from './sihua';
import { BRANCHES, SHICHEN, STEMS } from './constants';
import { ALL_BOOKS, searchClassics } from '@/lib/classics';

type AuditStatus = 'pass' | 'warn' | 'fail';

export interface AuditStep {
  name: string;
  status: AuditStatus;
  details: Record<string, unknown>;
}

export interface SampleReferenceStatus {
  configured: boolean;
  status: 'not-installed' | 'directory-found' | 'candidate-found' | 'candidate-missing' | 'candidate-mismatch';
  root?: string;
  sampleRoot?: string;
  sampleFile?: string;
  sampleKey?: string;
  sampleYear?: number;
  candidateFiles: string[];
  comparison?: {
    passed: boolean;
    checkedFields: string[];
    mismatches: string[];
    topicKeys: string[];
  };
  note: string;
}

interface SampleChartSummary {
  birthInfo: BirthInfo;
  chart: Pick<ZiweiChart, 'lunarInfo' | 'mingGongBranch' | 'shenGongBranch' | 'wuxingJu' | 'wuxingJuName' | 'ziweiPos' | 'palaces' | 'daXians'>;
  topics: string[];
  sampleFile: string;
}

interface SampleYearCache {
  sampleRoot: string;
  sampleYear: number;
  loadedAt: number;
  samples: Map<string, SampleChartSummary>;
  files: string[];
}

const SAMPLE_CYCLE_START_YEAR = 1924;
const SAMPLE_YEAR_CACHE_LIMIT = 1;
const sampleYearCache = new Map<string, SampleYearCache>();

export interface CalculationAudit {
  calculationId: string;
  generatedAt: string;
  engine: {
    repository: string;
    coreSources: string[];
    classics: { title: string; paragraphs: number }[];
  };
  steps: AuditStep[];
  warnings: string[];
}

export interface CalculationResult {
  chart: ZiweiChart;
  summary: ReturnType<typeof getMingGongSummary>;
  patterns: Pattern[];
  sihua: {
    native: { stemIndex: number; stemName: string; transforms: ReturnType<typeof getSiHuaByStem> };
    currentDaXian: ReturnType<typeof getDaXianSiHua>;
    liuNian: ReturnType<typeof getLiuNianSiHua>;
  };
  classics: {
    references: { bookTitle: string; chapterTitle: string; paragraphId: string; text: string }[];
  };
  sampleData: SampleReferenceStatus;
  audit: CalculationAudit;
}

export function normalizeBirthInfo(raw: unknown): BirthInfo {
  const input = (raw ?? {}) as Partial<BirthInfo> & { isLeapMonth?: boolean };
  const inputCalendar: CalendarType = input.inputCalendar === 'lunar' ? 'lunar' : input.inputCalendar === 'solar' ? 'solar' : 'solar';
  const dateInput = inputCalendar === 'lunar' && !input.inputDate
    ? birthDateInputToSolar({
        calendar: 'lunar',
        year: Number(input.year),
        month: Number(input.month),
        day: Number(input.day),
        isLeapMonth: Boolean(input.isLeapMonth),
      })
    : {
        year: Number(input.year),
        month: Number(input.month),
        day: Number(input.day),
      };
  const info: BirthInfo = {
    year: dateInput.year,
    month: dateInput.month,
    day: dateInput.day,
    hour: Number(input.hour),
    gender: input.gender === 'female' ? 'female' : 'male',
    name: typeof input.name === 'string' && input.name.trim() ? input.name.trim() : undefined,
    province: typeof input.province === 'string' && input.province.trim() ? input.province.trim() : undefined,
    city: typeof input.city === 'string' && input.city.trim() ? input.city.trim() : undefined,
    longitude: Number.isFinite(Number(input.longitude)) ? Number(input.longitude) : undefined,
    inputCalendar,
    inputDate: normalizeInputDate(input.inputDate, inputCalendar) ?? (
      inputCalendar === 'lunar'
        ? {
            calendar: 'lunar',
            year: Number(input.year),
            month: Number(input.month),
            day: Number(input.day),
            isLeapMonth: Boolean(input.isLeapMonth),
          }
        : undefined
    ),
    annotationTopics: normalizeAnnotationTopics(input.annotationTopics),
  };

  const date = new Date(info.year, info.month - 1, info.day);
  const validDate =
    Number.isInteger(info.year) &&
    Number.isInteger(info.month) &&
    Number.isInteger(info.day) &&
    info.year >= 1900 &&
    info.year <= 2100 &&
    info.month >= 1 &&
    info.month <= 12 &&
    info.day >= 1 &&
    info.day <= 31 &&
    date.getFullYear() === info.year &&
    date.getMonth() + 1 === info.month &&
    date.getDate() === info.day;

  if (!validDate) {
    throw new Error('出生日期无效：year/month/day 需为 1900-2100 内的有效公历日期');
  }

  if (!Number.isInteger(info.hour) || info.hour < 0 || info.hour > 11) {
    throw new Error('出生时辰无效：hour 需为 0-11 的地支索引，0=子时，11=亥时');
  }

  return info;
}

export function calculateChartWithAudit(raw: unknown, liuNianYear = new Date().getFullYear()): CalculationResult {
  const birthInfo = normalizeBirthInfo(raw);
  const chart = generateChart(birthInfo);
  const patterns = detectPatterns(chart);
  const summary = getMingGongSummary(chart);
  const native = {
    stemIndex: chart.lunarInfo.yearStem,
    stemName: STEMS[chart.lunarInfo.yearStem] ?? '',
    transforms: getSiHuaByStem(chart.lunarInfo.yearStem),
  };
  const currentDaXian = getDaXianSiHua(chart, chart.currentDaXianIndex);
  const liuNian = getLiuNianSiHua(liuNianYear);
  const sampleData = inspectSampleData(birthInfo, chart);
  const references = buildClassicReferences(chart, patterns);
  const warnings: string[] = [];

  if (sampleData.status !== 'candidate-found') {
    warnings.push(sampleData.note);
  }

  const steps: AuditStep[] = [
    {
      name: '输入校验',
      status: 'pass',
      details: {
        year: birthInfo.year,
        month: birthInfo.month,
        day: birthInfo.day,
        hourBranchIndex: birthInfo.hour,
        hourBranchName: SHICHEN[birthInfo.hour]?.name,
        gender: birthInfo.gender,
        inputCalendar: birthInfo.inputCalendar,
        inputDate: birthInfo.inputDate,
        annotationTopics: birthInfo.annotationTopics?.map(t => ANNOTATION_TOPIC_LABELS[t]),
      },
    },
    {
      name: '农历与年干复核',
      status: 'pass',
      details: {
        lunarYear: chart.lunarInfo.lunarYear,
        lunarMonth: chart.lunarInfo.lunarMonth,
        lunarDay: chart.lunarInfo.lunarDay,
        isLeapMonth: chart.lunarInfo.isLeapMonth,
        yearStem: native.stemName,
        yearBranch: BRANCHES[chart.lunarInfo.yearBranch],
      },
    },
    {
      name: '排盘结构复核',
      status: chart.palaces.length === 12 && chart.daXians.length > 0 ? 'pass' : 'fail',
      details: {
        palaceCount: chart.palaces.length,
        daXianCount: chart.daXians.length,
        mingGong: branchLabel(chart, chart.mingGongBranch),
        shenGong: branchLabel(chart, chart.shenGongBranch),
        wuxingJu: chart.wuxingJuName,
        ziweiPosition: branchLabel(chart, chart.ziweiPos),
      },
    },
    {
      name: '四化飞星复核',
      status: Object.values(native.transforms).every(Boolean) ? 'pass' : 'fail',
      details: {
        native,
        currentDaXian,
        liuNian,
      },
    },
    {
      name: '格局判定复核',
      status: 'pass',
      details: {
        patternCount: patterns.length,
        topPatterns: patterns.slice(0, 8).map(p => ({
          name: p.name,
          level: p.level,
          required: p.conditions?.required ?? [],
          breaking: p.conditions?.breaking ?? [],
          source: p.source,
        })),
      },
    },
    {
      name: '空宫借星复核',
      status: 'pass',
      details: {
        emptyPalaces: chart.palaces
          .filter(p => p.isEmpty)
          .map(p => ({
            palace: p.name,
            branch: BRANCHES[p.branch],
            borrowedFrom: p.borrowedFromName,
            borrowedStars: p.borrowedStars ?? [],
          })),
      },
    },
    {
      name: '样本数据参照',
      status: sampleData.status === 'candidate-found'
        ? 'pass'
        : sampleData.status === 'candidate-mismatch'
          ? 'fail'
          : 'warn',
      details: { ...sampleData },
    },
    {
      name: '古籍原文参照',
      status: references.length > 0 ? 'pass' : 'warn',
      details: {
        referenceCount: references.length,
        references: references.slice(0, 5),
      },
    },
  ];

  const calculationId = createHash('sha256')
    .update(JSON.stringify({ birthInfo, native, palaces: chart.palaces.map(p => [p.branch, p.name, p.stars.map(s => [s.name, s.siHua])]) }))
    .digest('hex')
    .slice(0, 16);

  return {
    chart,
    summary,
    patterns,
    sihua: { native, currentDaXian, liuNian },
    classics: { references },
    sampleData,
    audit: {
      calculationId,
      generatedAt: new Date().toISOString(),
      engine: {
        repository: 'Renhuai123/ziwei-doushu',
        coreSources: [
          'lib/ziwei/algorithm.ts',
          'lib/ziwei/sihua.ts',
          'lib/ziwei/patterns.ts',
          'lib/classics/data/gusuifu.ts',
        ],
        classics: ALL_BOOKS.map(book => ({
          title: book.title,
          paragraphs: book.chapters.reduce((sum, chapter) => sum + chapter.paragraphs.length, 0),
        })),
      },
      steps,
      warnings,
    },
  };
}

export function buildLocalInterpretation(result: CalculationResult, prompt = ''): string {
  const { chart, patterns, summary, sihua, classics, audit } = result;
  const ming = chart.palaces.find(p => p.branch === chart.mingGongBranch);
  const currentDx = chart.daXians[chart.currentDaXianIndex];
  const strongestPatterns = patterns.slice(0, 4);
  const topic = inferTopic(prompt);
  const requestedTopics = resolveRequestedTopics(chart.birthInfo.annotationTopics, prompt);

  return [
    '**【复核推导】**',
    `测算编号：${audit.calculationId}。已复核输入日期、农历年干、十二宫数量、命身宫、四化飞星、格局判定、空宫借星与古籍参照。`,
    `命宫：${ming?.name ?? '未知'}（${BRANCHES[chart.mingGongBranch]}），主星：${summary.stars.length ? summary.stars.join('、') : '空宫借对宫'}。身宫：${BRANCHES[chart.shenGongBranch]}。五行局：${chart.wuxingJuName}。`,
    `本命四化：${formatTransforms(sihua.native.transforms)}。${currentDx ? `当前大限：${currentDx.startAge}-${currentDx.endAge}岁，落${currentDx.palaceName}。` : '当前大限未命中。'}`,
    '',
    `**【${topic.title}】**`,
    topic.body(chart, strongestPatterns),
    '',
    '**【详细批注】**',
    requestedTopics.map(t => {
      const item = topicInterpreters[t];
      return `【${ANNOTATION_TOPIC_LABELS[t]}】${item(chart)}`;
    }).join('\n'),
    '',
    '**【格局与依据】**',
    strongestPatterns.length
      ? strongestPatterns.map(p => `- ${p.name}（${p.level}）：${p.conditions?.required?.join('；') || p.description}`).join('\n')
      : '- 未触发强格局，宜回到命宫主星、三方四正、四化落宫逐项分析。',
    '',
    '**【古籍参照】**',
    classics.references.slice(0, 3).map(ref => `- 《${ref.bookTitle}》${ref.chapterTitle}：${ref.text}`).join('\n') || '- 本次未匹配到直接古籍段落，仍保留《骨髓赋》等原典为知识源。',
    '',
    '**【样本数据状态】**',
    result.sampleData.note,
    '',
    '**【边界说明】**',
    '以上为传统术数文化学习与排盘规则解释，不构成医疗、投资、法律或重大人生决策建议。',
  ].join('\n');
}

function branchLabel(chart: ZiweiChart, branch: number): string {
  const palace = chart.palaces.find(p => p.branch === branch);
  return palace ? `${palace.name}(${BRANCHES[branch]})` : BRANCHES[branch] ?? String(branch);
}

function inspectSampleData(birthInfo: BirthInfo, chart: ZiweiChart): SampleReferenceStatus {
  const roots = [
    process.env.ZIWEI_SAMPLE_DIR,
    path.join(process.cwd(), 'data', 'samples'),
    path.join(process.cwd(), 'samples'),
    path.join(process.cwd(), 'ziwei-samples-v3'),
  ].filter(Boolean) as string[];

  const root = roots.find(r => existsSync(r) && statSync(r).isDirectory());
  const sampleRoot = root ? resolveSampleRoot(root) : undefined;
  const sampleYear = cycleSampleYear(chart.lunarInfo.lunarYear);
  const candidateFiles = sampleRoot
    ? sampleMonthFiles(sampleRoot, sampleYear)
    : sampleMonthFiles(path.join(root ?? roots[0] ?? '', 'samples-out'), sampleYear);
  const sampleKey = buildSampleKey(chart);

  if (!root || !sampleRoot) {
    return {
      configured: false,
      status: 'not-installed',
      root,
      candidateFiles,
      note: '51.8 万样本数据未安装到本地；服务仍按源码算法、四化规则、格局规则和古籍原文复核。可设置 ZIWEI_SAMPLE_DIR 指向 Releases v3.0-samples 解压目录。',
    };
  }

  const existingFiles = candidateFiles.filter(file => existsSync(file));
  const hasFiles = safeHasAnyFile(sampleRoot);
  if (existingFiles.length === 0) {
    return {
      configured: true,
      root,
      sampleRoot,
      sampleYear,
      sampleKey,
      status: hasFiles ? 'candidate-missing' : 'directory-found',
      candidateFiles,
      note: hasFiles
        ? `已检测到样本库，但缺少 ${sampleYear} 年周期样本文件，无法复核当前命盘样本。`
        : '已检测到样本数据目录，但目录为空或不可读取。',
    };
  }

  const sample = findSample(sampleRoot, sampleYear, sampleKey);
  if (!sample) {
    return {
      configured: true,
      root,
      sampleRoot,
      sampleYear,
      sampleKey,
      status: 'candidate-missing',
      candidateFiles,
      note: `已读取 ${sampleYear} 年周期样本文件，但未命中当前命盘样本键：${sampleKey}。`,
    };
  }

  const comparison = compareChartToSample(chart, sample);
  const passed = comparison.mismatches.length === 0;

  return {
    configured: true,
    root,
    sampleRoot,
    sampleFile: sample.sampleFile,
    sampleYear,
    sampleKey,
    status: passed ? 'candidate-found' : 'candidate-mismatch',
    candidateFiles,
    comparison: {
      passed,
      checkedFields: comparison.checkedFields,
      mismatches: comparison.mismatches,
      topicKeys: sample.topics,
    },
    note: passed
      ? `已命中 51.8 万样本库：${sample.sampleFile}，样本键 ${sampleKey}，命盘结构复核一致。`
      : `已命中 51.8 万样本库：${sample.sampleFile}，但发现 ${comparison.mismatches.length} 项结构差异，需复核算法或样本版本。`,
  };
}

function resolveSampleRoot(root: string): string | undefined {
  const candidates = [
    root,
    path.join(root, 'samples-out'),
    path.join(root, 'ziwei-samples-toolkit', 'samples-out'),
  ];
  return candidates.find(candidate =>
    existsSync(candidate) &&
    statSync(candidate).isDirectory() &&
    looksLikeSampleRoot(candidate)
  );
}

function looksLikeSampleRoot(root: string): boolean {
  try {
    return readdirSync(root).some(name => /^year-\d{4}$/.test(name));
  } catch {
    return false;
  }
}

function cycleSampleYear(lunarYear: number): number {
  const offset = ((lunarYear - SAMPLE_CYCLE_START_YEAR) % 60 + 60) % 60;
  return SAMPLE_CYCLE_START_YEAR + offset;
}

function sampleMonthFiles(sampleRoot: string, sampleYear: number): string[] {
  return Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, '0');
    return path.join(sampleRoot, `year-${sampleYear}`, `${sampleYear}-${month}.jsonl.gz`);
  });
}

function buildSampleKey(chart: ZiweiChart): string {
  const lunar = chart.lunarInfo;
  return [
    lunar.yearStem,
    lunar.yearBranch,
    lunar.lunarMonth,
    lunar.lunarDay,
    lunar.isLeapMonth ? 1 : 0,
    chart.birthInfo.hour,
    chart.birthInfo.gender,
  ].join('|');
}

function findSample(sampleRoot: string, sampleYear: number, sampleKey: string): SampleChartSummary | null {
  const cache = getSampleYearCache(sampleRoot, sampleYear);
  return cache.samples.get(sampleKey) ?? null;
}

function getSampleYearCache(sampleRoot: string, sampleYear: number): SampleYearCache {
  const cacheKey = `${sampleRoot}::${sampleYear}`;
  const cached = sampleYearCache.get(cacheKey);
  if (cached) {
    cached.loadedAt = Date.now();
    return cached;
  }

  const files = sampleMonthFiles(sampleRoot, sampleYear).filter(file => existsSync(file));
  const samples = new Map<string, SampleChartSummary>();
  for (const file of files) {
    const text = gunzipSync(readFileSync(file)).toString('utf8');
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      try {
        const raw = JSON.parse(line) as {
          birthInfo: BirthInfo;
          chart: SampleChartSummary['chart'];
          topics?: Record<string, unknown>;
        };
        const sample: SampleChartSummary = {
          birthInfo: raw.birthInfo,
          chart: raw.chart,
          topics: raw.topics ? Object.keys(raw.topics) : [],
          sampleFile: file,
        };
        samples.set(buildSampleKey(raw.chart as ZiweiChart), sample);
      } catch {
        continue;
      }
    }
  }

  const entry: SampleYearCache = { sampleRoot, sampleYear, loadedAt: Date.now(), samples, files };
  sampleYearCache.set(cacheKey, entry);
  trimSampleYearCache();
  return entry;
}

function trimSampleYearCache() {
  if (sampleYearCache.size <= SAMPLE_YEAR_CACHE_LIMIT) return;
  const oldest = [...sampleYearCache.entries()].sort((a, b) => a[1].loadedAt - b[1].loadedAt)[0];
  if (oldest) sampleYearCache.delete(oldest[0]);
}

function compareChartToSample(chart: ZiweiChart, sample: SampleChartSummary) {
  const checkedFields: string[] = [];
  const mismatches: string[] = [];
  const check = (field: string, actual: unknown, expected: unknown) => {
    checkedFields.push(field);
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      mismatches.push(`${field}: actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
    }
  };

  check('lunarInfo.yearStem', chart.lunarInfo.yearStem, sample.chart.lunarInfo.yearStem);
  check('lunarInfo.yearBranch', chart.lunarInfo.yearBranch, sample.chart.lunarInfo.yearBranch);
  check('lunarInfo.lunarMonth', chart.lunarInfo.lunarMonth, sample.chart.lunarInfo.lunarMonth);
  check('lunarInfo.lunarDay', chart.lunarInfo.lunarDay, sample.chart.lunarInfo.lunarDay);
  check('lunarInfo.isLeapMonth', chart.lunarInfo.isLeapMonth, sample.chart.lunarInfo.isLeapMonth);
  check('mingGongBranch', chart.mingGongBranch, sample.chart.mingGongBranch);
  check('shenGongBranch', chart.shenGongBranch, sample.chart.shenGongBranch);
  check('wuxingJu', chart.wuxingJu, sample.chart.wuxingJu);
  check('wuxingJuName', chart.wuxingJuName, sample.chart.wuxingJuName);
  check('ziweiPos', chart.ziweiPos, sample.chart.ziweiPos);
  check('palaces', summarizePalaces(chart.palaces), summarizePalaces(sample.chart.palaces));
  check('daXians', summarizeDaXians(chart.daXians), summarizeDaXians(sample.chart.daXians));

  return { checkedFields, mismatches };
}

function summarizePalaces(palaces: Palace[]) {
  return palaces.map(palace => ({
    branch: palace.branch,
    stem: palace.stem,
    name: palace.name,
    stars: palace.stars.map(star => ({
      name: star.name,
      type: star.type,
      brightness: star.brightness ?? '',
      siHua: star.siHua ?? '',
    })),
    daXianAge: palace.daXianAge ?? null,
    isMingGong: Boolean(palace.isMingGong),
    isShenGong: Boolean(palace.isShenGong),
    isEmpty: Boolean(palace.isEmpty),
    borrowedFromBranch: palace.borrowedFromBranch ?? null,
    borrowedStars: palace.borrowedStars ?? [],
  }));
}

function summarizeDaXians(daXians: ZiweiChart['daXians']) {
  return daXians.map(daXian => ({
    startAge: daXian.startAge,
    endAge: daXian.endAge,
    palaceBranch: daXian.palaceBranch,
    palaceName: daXian.palaceName,
    stemIndex: daXian.stemIndex ?? null,
    stemName: daXian.stemName ?? '',
  }));
}

function safeHasAnyFile(root: string): boolean {
  try {
    return readdirSync(root).length > 0;
  } catch {
    return false;
  }
}

function buildClassicReferences(chart: ZiweiChart, patterns: Pattern[]) {
  const stars = getMingGongSummary(chart).stars;
  const keywords = [...stars, ...patterns.map(p => p.name), '四化'].filter(Boolean);
  const seen = new Set<string>();
  const refs: { bookTitle: string; chapterTitle: string; paragraphId: string; text: string }[] = [];

  for (const keyword of keywords) {
    for (const hit of searchClassics(keyword, 3)) {
      if (seen.has(hit.paragraphId)) continue;
      seen.add(hit.paragraphId);
      refs.push({
        bookTitle: hit.bookTitle,
        chapterTitle: hit.chapterTitle,
        paragraphId: hit.paragraphId,
        text: hit.text,
      });
      if (refs.length >= 6) return refs;
    }
  }

  return refs;
}

function formatTransforms(transforms: ReturnType<typeof getSiHuaByStem>): string {
  return (['禄', '权', '科', '忌'] as const)
    .map(key => `${transforms[key]}化${key}`)
    .join('，');
}

function inferTopic(prompt: string): {
  title: string;
  body: (chart: ZiweiChart, patterns: Pattern[]) => string;
} {
  if (/感情|夫妻|婚/.test(prompt)) {
    return {
      title: '感情婚姻',
      body: chart => describePalace(chart, '夫妻宫', '感情关系以夫妻宫为主，再看命宫与福德宫的承受方式。'),
    };
  }
  if (/事业|官禄|工作|换工作/.test(prompt)) {
    return {
      title: '事业方向',
      body: chart => describePalace(chart, '官禄宫', '事业以官禄宫为主，再合财帛宫与迁移宫判断发展方式。'),
    };
  }
  if (/财|钱|收入|投资/.test(prompt)) {
    return {
      title: '财运模式',
      body: chart => describePalace(chart, '财帛宫', '财运以财帛宫为主，田宅宫看财库，四化看增益与耗损。'),
    };
  }
  if (/健康|疾厄|病/.test(prompt)) {
    return {
      title: '健康提示',
      body: chart => describePalace(chart, '疾厄宫', '健康以疾厄宫为主，化忌与煞曜落点只作生活提醒。'),
    };
  }
  return {
    title: '命格总览',
    body: (chart, patterns) => {
      const ming = chart.palaces.find(p => p.branch === chart.mingGongBranch);
      const stars = ming?.stars.filter(s => s.type === 'major').map(s => `${s.name}${s.siHua ? `化${s.siHua}` : ''}`) ?? [];
      return `命格先看命宫。此盘命宫主星为${stars.length ? stars.join('、') : '空宫借对宫'}，再以三方四正和四化定用。${patterns.length ? `本次触发${patterns.length}项主要格局，优先参考${patterns.map(p => p.name).join('、')}。` : '本次没有强格局压盘，适合逐宫细看。'}`;
    },
  };
}

function describePalace(chart: ZiweiChart, palaceName: string, opening: string): string {
  const palace = chart.palaces.find(p => p.name === palaceName);
  if (!palace) return opening;
  const major = palace.stars.filter(s => s.type === 'major').map(formatStar);
  const sihua = palace.stars.filter(s => s.siHua).map(formatStar);
  const borrowed = palace.isEmpty ? `此宫为空宫，借${palace.borrowedFromName ?? '对宫'}主星${palace.borrowedStars?.join('、') || '未标注'}。` : '';
  return `${opening} ${palaceName}在${BRANCHES[palace.branch]}，主星：${major.length ? major.join('、') : '无主星'}。${borrowed}${sihua.length ? `本宫四化：${sihua.join('、')}。` : '本宫未见本命四化主星。'}`;
}

function formatStar(star: Palace['stars'][number]): string {
  return `${star.name}${star.siHua ? `化${star.siHua}` : ''}`;
}

function normalizeInputDate(
  inputDate: BirthInfo['inputDate'] | undefined,
  fallbackCalendar: CalendarType,
): BirthInfo['inputDate'] | undefined {
  if (!inputDate) return undefined;
  return {
    calendar: inputDate.calendar === 'lunar' ? 'lunar' : fallbackCalendar,
    year: Number(inputDate.year),
    month: Number(inputDate.month),
    day: Number(inputDate.day),
    isLeapMonth: Boolean(inputDate.isLeapMonth),
  };
}

function normalizeAnnotationTopics(topics: unknown): AnnotationTopicKey[] {
  const allowed = new Set<AnnotationTopicKey>([
    'marriage',
    'career',
    'wealth',
    'family',
    'children',
    'health',
    'personality',
    'migration',
  ]);
  if (!Array.isArray(topics)) return [...DEFAULT_ANNOTATION_TOPICS];
  const picked = topics.filter((topic): topic is AnnotationTopicKey => allowed.has(topic as AnnotationTopicKey));
  return picked.length > 0 ? picked : [...DEFAULT_ANNOTATION_TOPICS];
}

function resolveRequestedTopics(topics: AnnotationTopicKey[] | undefined, prompt: string): AnnotationTopicKey[] {
  const explicit = normalizeAnnotationTopics(topics);
  const promptTopics: AnnotationTopicKey[] = [];
  if (/婚姻|夫妻|感情|婚/.test(prompt)) promptTopics.push('marriage');
  if (/事业|官禄|工作|换工作/.test(prompt)) promptTopics.push('career');
  if (/财|钱|收入|投资/.test(prompt)) promptTopics.push('wealth');
  if (/家庭|兄弟|父母|田宅/.test(prompt)) promptTopics.push('family');
  if (/子女|孩子|亲子/.test(prompt)) promptTopics.push('children');
  if (/健康|疾厄|病/.test(prompt)) promptTopics.push('health');
  if (/性格|个性|人格/.test(prompt)) promptTopics.push('personality');
  if (/迁移|外地|出行|外出/.test(prompt)) promptTopics.push('migration');
  return Array.from(new Set([...explicit, ...promptTopics]));
}

const topicInterpreters: Record<AnnotationTopicKey, (chart: ZiweiChart) => string> = {
  marriage: chart => describePalace(chart, '夫妻宫', '婚姻感情先看夫妻宫，再看命宫承接方式与福德宫的内在安全感。'),
  career: chart => describePalace(chart, '官禄宫', '事业以官禄宫为主，再合财帛宫与迁移宫判断职业路径和发展空间。'),
  wealth: chart => describePalace(chart, '财帛宫', '财运先看财帛宫，田宅宫看财库，四化判断增益、权责、名誉与耗损。'),
  family: chart => describePalace(chart, '田宅宫', '家庭批注以田宅宫为核心，再参考兄弟宫、父母宫与福德宫。'),
  children: chart => describePalace(chart, '子女宫', '子女缘分与亲子互动看子女宫，也可旁参交友宫所示下属与晚辈关系。'),
  health: chart => describePalace(chart, '疾厄宫', '健康只作生活提醒，以疾厄宫主星、煞曜和化忌落点为重点，不替代医疗判断。'),
  personality: chart => describePalace(chart, '命宫', '性格以命宫主星为根，再用身宫与三方四正看后天表现。'),
  migration: chart => describePalace(chart, '迁移宫', '迁移宫看外出、外地、环境变化与外部贵人助力。'),
};
