export type TvBoardInput = {
  id: string;
  origin: string;
  destination: string;
  departsAt: string;
  seats: number;
  sold: number;
  status: "scheduled" | "boarding" | "departed" | "arrived" | "cancelled";
};

export type TvBoardRow = TvBoardInput & { seatsLeft: number };

/**
 * What the office TV shows: buses still to leave (scheduled or boarding) and
 * cancellations that have not yet passed their departure time, in time order.
 * Buses already on the road or arrived are off the board.
 */
export function tvBoardRows(departures: TvBoardInput[], now: Date = new Date(), limit = 12): TvBoardRow[] {
  const nowMs = now.getTime();
  return departures
    .filter((d) =>
      d.status === "scheduled" || d.status === "boarding" || (d.status === "cancelled" && Date.parse(d.departsAt) >= nowMs),
    )
    .sort((a, b) => Date.parse(a.departsAt) - Date.parse(b.departsAt))
    .slice(0, limit)
    .map((d) => ({ ...d, seatsLeft: Math.max(d.seats - d.sold, 0) }));
}
