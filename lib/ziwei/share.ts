import type { BirthFormState } from '@/components/BirthForm';
import { birthDateInputToSolar } from './calendar';
import {
  DEFAULT_ANNOTATION_TOPICS,
  type AnnotationTopicKey,
  type BirthInfo,
  type CalendarType,
} from './types';

/** 根据北京时间 + 经度计算真太阳时时辰支 (0-11) */
export function calcTrueSolarBranch(clockHour: number, clockMinute: number, longitude: number): number {
  const clockMins = clockHour * 60 + clockMinute;
  const offset = (longitude - 120) * 4;
  const solar = ((clockMins + offset) % 1440 + 1440) % 1440;
  if (solar >= 1380 || solar < 60) return 0;
  return Math.floor((solar - 60) / 120) + 1;
}

/** BirthFormState → BirthInfo
 *
 * 子时规则（倪海厦体系/三合派标准）：
 * · 23:00-23:59 = 晚子时，**按次日**排盘（日期 +1）
 * · 00:00-00:59 = 早子时，按本日排盘
 * 这与「时辰支同为子(0)」并不冲突——子时分早晚两段，需要在日期上区分。
 */
export function formToBirthInfo(form: BirthFormState): BirthInfo {
  const inputYear = parseInt(form.year) || 0;
  const inputMonth = parseInt(form.month) || 0;
  const inputDay = parseInt(form.day) || 0;
  const inputCalendar = form.calendarType ?? 'lunar';
  const solar = birthDateInputToSolar({
    calendar: inputCalendar,
    year: inputYear,
    month: inputMonth,
    day: inputDay,
    isLeapMonth: form.isLeapMonth,
  });
  let y = solar.year;
  let m = solar.month;
  let d = solar.day;

  // 晚子时（23:00-23:59）按次日处理：用 Date 对象自动处理月末/年末进位
  if (!form.unknownTime) {
    const clockHour = parseInt(form.clockHour) || 0;
    if (clockHour === 23 && y > 0 && m > 0 && d > 0) {
      const next = new Date(y, m - 1, d + 1);
      y = next.getFullYear();
      m = next.getMonth() + 1;
      d = next.getDate();
    }
  }

  const hour = form.unknownTime
    ? 0
    : calcTrueSolarBranch(parseInt(form.clockHour) || 0, parseInt(form.clockMinute) || 0, form.longitude);
  return {
    year: y, month: m, day: d,
    hour,
    gender: form.gender,
    name: form.name || undefined,
    province: form.province || undefined,
    city: form.city || undefined,
    longitude: form.province ? form.longitude : undefined,
    inputCalendar,
    inputDate: {
      calendar: inputCalendar,
      year: inputYear,
      month: inputMonth,
      day: inputDay,
      isLeapMonth: inputCalendar === 'lunar' ? form.isLeapMonth : undefined,
    },
    annotationTopics: normalizeAnnotationTopics(form.annotationTopics),
  };
}

/** BirthFormState → URLSearchParams（用于分享链接） */
export function formToSearchParams(form: BirthFormState): URLSearchParams {
  const p = new URLSearchParams();
  if (form.name) p.set('n', form.name);
  p.set('cal', form.calendarType ?? 'lunar');
  p.set('y', form.year);
  p.set('m', form.month);
  p.set('d', form.day);
  if (form.calendarType === 'lunar' && form.isLeapMonth) p.set('leap', '1');
  if (form.unknownTime) {
    p.set('u', '1');
  } else {
    p.set('h', form.clockHour);
    p.set('mi', form.clockMinute);
  }
  if (form.province) p.set('p', form.province);
  if (form.city) p.set('c', form.city);
  if (form.longitude && form.longitude !== 120) p.set('lo', String(form.longitude));
  p.set('g', form.gender === 'male' ? 'm' : 'f');
  const topics = normalizeAnnotationTopics(form.annotationTopics);
  if (topics.length > 0) p.set('topics', topics.join(','));
  return p;
}

/** URLSearchParams → Partial<BirthFormState>，不完整时返回 null */
export function searchParamsToForm(params: URLSearchParams): Partial<BirthFormState> | null {
  const year = params.get('y');
  const month = params.get('m');
  const day = params.get('d');
  if (!year || !month || !day) return null;
  const calendarType: CalendarType = params.get('cal') === 'lunar'
    ? 'lunar'
    : params.get('cal') === 'solar'
      ? 'solar'
      : 'solar';
  return {
    name: params.get('n') || '',
    calendarType,
    year,
    month,
    day,
    isLeapMonth: params.get('leap') === '1',
    unknownTime: params.get('u') === '1',
    clockHour: params.get('h') || '8',
    clockMinute: params.get('mi') || '0',
    province: params.get('p') || '',
    city: params.get('c') || '',
    longitude: parseFloat(params.get('lo') || '120'),
    gender: params.get('g') === 'f' ? 'female' : 'male',
    annotationTopics: normalizeAnnotationTopics(params.get('topics')?.split(',') ?? undefined),
  };
}

function normalizeAnnotationTopics(topics?: string[] | null): AnnotationTopicKey[] {
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
  const picked = (topics ?? []).filter((topic): topic is AnnotationTopicKey => allowed.has(topic as AnnotationTopicKey));
  return picked.length > 0 ? picked : [...DEFAULT_ANNOTATION_TOPICS];
}
