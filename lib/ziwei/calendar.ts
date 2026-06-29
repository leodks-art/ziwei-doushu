import { Lunar } from 'lunar-javascript';
import type { CalendarType } from './types';

export interface SolarDateParts {
  year: number;
  month: number;
  day: number;
}

export interface BirthDateInput {
  calendar: CalendarType;
  year: number;
  month: number;
  day: number;
  isLeapMonth?: boolean;
}

export function isValidSolarDate(year: number, month: number, day: number): boolean {
  if (!year || !month || !day) return false;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function lunarToSolarDate(year: number, month: number, day: number, isLeapMonth = false): SolarDateParts {
  const lunar = Lunar.fromYmd(year, isLeapMonth ? -month : month, day);
  const solar = lunar.getSolar();
  return {
    year: solar.getYear(),
    month: solar.getMonth(),
    day: solar.getDay(),
  };
}

export function birthDateInputToSolar(input: BirthDateInput): SolarDateParts {
  if (input.calendar === 'solar') {
    if (!isValidSolarDate(input.year, input.month, input.day)) {
      throw new Error('公历日期不存在');
    }
    return { year: input.year, month: input.month, day: input.day };
  }
  return lunarToSolarDate(input.year, input.month, input.day, input.isLeapMonth);
}

export function formatDateParts(date: SolarDateParts): string {
  return `${date.year}年${date.month}月${date.day}日`;
}
