import { isEthiopianLeapYear, parseGregorian, toEthiopian, toGregorian, type GregorianDate } from "@/lib/ethiopian-date";

/** An Ethiopian calendar month, e.g. { year: 2019, month: 3 } for Hidar 2019. Month 13 is Pagume. */
export type EthMonth = { year: number; month: number };

const MONTH_PARAM = /^(\d{4})-(\d{2})$/;

function iso({ year, month, day }: GregorianDate): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function daysInEthMonth({ year, month }: EthMonth): number {
  if (month < 13) return 30;
  return isEthiopianLeapYear(year) ? 6 : 5;
}

/** First and last Gregorian day (YYYY-MM-DD, inclusive) of an Ethiopian month. */
export function ethMonthRange(m: EthMonth): { from: string; to: string } {
  return {
    from: iso(toGregorian({ year: m.year, month: m.month, day: 1 })),
    to: iso(toGregorian({ year: m.year, month: m.month, day: daysInEthMonth(m) })),
  };
}

/** The Ethiopian month that contains a Gregorian YYYY-MM-DD day. */
export function ethMonthOf(day: string): EthMonth {
  const { year, month } = toEthiopian(parseGregorian(day));
  return { year, month };
}

export function shiftEthMonth({ year, month }: EthMonth, by: number): EthMonth {
  const index = year * 13 + (month - 1) + by;
  return { year: Math.floor(index / 13), month: (index % 13) + 1 };
}

export function compareEthMonth(a: EthMonth, b: EthMonth): number {
  return a.year * 13 + a.month - (b.year * 13 + b.month);
}

/** "2019-03" for Hidar 2019; used in links and the CSV file name. */
export function formatMonthParam({ year, month }: EthMonth): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Reads a "YYYY-MM" Ethiopian month; anything invalid or in the future gives `fallback`. */
export function parseMonthParam(raw: string | undefined, fallback: EthMonth): EthMonth {
  const match = raw ? MONTH_PARAM.exec(raw) : null;
  if (!match) return fallback;
  const m = { year: Number(match[1]), month: Number(match[2]) };
  if (m.month < 1 || m.month > 13 || m.year < 1990) return fallback;
  return compareEthMonth(m, fallback) > 0 ? fallback : m;
}

/** The last day of a 7-day report: a valid YYYY-MM-DD not after today, else today. */
export function parseWeekEnd(raw: string | undefined | null, today: string): string {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(`${raw}T00:00:00Z`))) return today;
  if (new Date(`${raw}T00:00:00Z`).toISOString().slice(0, 10) !== raw) return today;
  return raw > today ? today : raw;
}

/** One CSV cell: quoted when needed, and a leading = + - @ is neutralised so spreadsheets do not run it. */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV text with a UTF-8 byte order mark so Excel shows Amharic correctly. */
export function toCsv(rows: ReadonlyArray<ReadonlyArray<string | number | null | undefined>>): string {
  return "﻿" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
