import { describe, expect, it } from "vitest";
import { tvBoardRows, type TvBoardInput } from "./tv-board";

const base = { origin: "Shashamane", seats: 45, sold: 10 };
const now = new Date("2026-11-12T06:00:00Z");
const rows: TvBoardInput[] = [
  { ...base, id: "late", destination: "Dodola", departsAt: "2026-11-12T09:00:00Z", status: "scheduled" },
  { ...base, id: "board", destination: "Hawassa", departsAt: "2026-11-12T06:30:00Z", status: "boarding", sold: 50 },
  { ...base, id: "gone", destination: "Addis Ababa", departsAt: "2026-11-12T05:00:00Z", status: "departed" },
  { ...base, id: "done", destination: "Addis Ababa", departsAt: "2026-11-12T03:00:00Z", status: "arrived" },
  { ...base, id: "cxl-future", destination: "Arsi Negele", departsAt: "2026-11-12T07:00:00Z", status: "cancelled" },
  { ...base, id: "cxl-past", destination: "Arsi Negele", departsAt: "2026-11-12T05:30:00Z", status: "cancelled" },
];

describe("tvBoardRows", () => {
  it("keeps buses still to leave and upcoming cancellations, in time order", () => {
    expect(tvBoardRows(rows, now).map((r) => r.id)).toEqual(["board", "cxl-future", "late"]);
  });

  it("never shows negative seats left", () => {
    expect(tvBoardRows(rows, now).find((r) => r.id === "board")?.seatsLeft).toBe(0);
    expect(tvBoardRows(rows, now).find((r) => r.id === "late")?.seatsLeft).toBe(35);
  });

  it("caps the number of rows", () => {
    expect(tvBoardRows(rows, now, 1)).toHaveLength(1);
  });
});
