import { describe, expect, it } from "vitest";
import { parseWeekEnd, csvCell, daysInEthMonth, ethMonthOf, ethMonthRange, formatMonthParam, parseMonthParam, shiftEthMonth, toCsv } from "./report-month";

describe("ethMonthRange", () => {
  it("covers Hidar 2019 (10 Nov to 9 Dec 2026)", () => {
    expect(ethMonthRange({ year: 2019, month: 3 })).toEqual({ from: "2026-11-10", to: "2026-12-09" });
  });
  it("gives Pagume 5 days in a common year and 6 in a leap year", () => {
    expect(daysInEthMonth({ year: 2018, month: 13 })).toBe(5);
    expect(daysInEthMonth({ year: 2015, month: 13 })).toBe(6);
    expect(ethMonthRange({ year: 2015, month: 13 })).toEqual({ from: "2023-09-06", to: "2023-09-11" });
  });
});

describe("month navigation", () => {
  it("finds the month of a day", () => {
    expect(ethMonthOf("2026-11-22")).toEqual({ year: 2019, month: 3 });
    expect(ethMonthOf("2026-11-09")).toEqual({ year: 2019, month: 2 });
  });
  it("steps across Pagume and the new year", () => {
    expect(shiftEthMonth({ year: 2018, month: 12 }, 1)).toEqual({ year: 2018, month: 13 });
    expect(shiftEthMonth({ year: 2018, month: 13 }, 1)).toEqual({ year: 2019, month: 1 });
    expect(shiftEthMonth({ year: 2019, month: 1 }, -1)).toEqual({ year: 2018, month: 13 });
  });
  it("parses the month parameter and refuses future or broken values", () => {
    const now = { year: 2019, month: 3 };
    expect(parseMonthParam("2019-02", now)).toEqual({ year: 2019, month: 2 });
    expect(parseMonthParam("2019-04", now)).toEqual(now);
    expect(parseMonthParam("2019-14", now)).toEqual(now);
    expect(parseMonthParam("hello", now)).toEqual(now);
    expect(parseMonthParam(undefined, now)).toEqual(now);
    expect(formatMonthParam({ year: 2018, month: 13 })).toBe("2018-13");
  });
});

describe("csv", () => {
  it("quotes commas, quotes and new lines", () => {
    expect(csvCell('Bus "A", Hawassa')).toBe('"Bus ""A"", Hawassa"');
    expect(csvCell("line\nbreak")).toBe('"line\nbreak"');
    expect(csvCell(1250.5)).toBe("1250.5");
    expect(csvCell(null)).toBe("");
  });
  it("neutralises formulas in text cells", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell(-5)).toBe("-5");
  });
  it("starts with a byte order mark and uses CRLF", () => {
    expect(toCsv([["ሻሸመኔ", 2], ["a", "b"]])).toBe("﻿ሻሸመኔ,2\r\na,b\r\n");
  });
});

describe("parseWeekEnd", () => {
  it("keeps a past day and refuses future, broken or impossible days", () => {
    expect(parseWeekEnd("2026-11-15", "2026-11-22")).toBe("2026-11-15");
    expect(parseWeekEnd("2026-11-30", "2026-11-22")).toBe("2026-11-22");
    expect(parseWeekEnd("2026-02-30", "2026-11-22")).toBe("2026-11-22");
    expect(parseWeekEnd("x", "2026-11-22")).toBe("2026-11-22");
    expect(parseWeekEnd(undefined, "2026-11-22")).toBe("2026-11-22");
  });
});
