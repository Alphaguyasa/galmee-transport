import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { addDays, addisToday } from "@/lib/day";
import { ethMonthOf, ethMonthRange, formatMonthParam, parseMonthParam, parseWeekEnd, toCsv } from "@/lib/report-month";
import { busReportRange, routeReportRange } from "@/server/dal/transport";
import { getSession } from "@/server/dal/session";

/** CSV of the period report: ?kind=routes|buses and month=YYYY-MM (Ethiopian month) or end=YYYY-MM-DD (7 days). Owners and managers only. */
export async function GET(request: Request) {
  const { profile } = await getSession();
  if (profile.role === "staff") redirect("/");

  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") === "buses" ? "buses" : "routes";
  const today = addisToday();
  const endParam = url.searchParams.get("end");
  let from: string, to: string, label: string;
  if (endParam) {
    to = parseWeekEnd(endParam, today);
    from = addDays(to, -6);
    label = `${from}-to-${to}`;
  } else {
    const month = parseMonthParam(url.searchParams.get("month") ?? undefined, ethMonthOf(today));
    ({ from, to } = ethMonthRange(month));
    label = formatMonthParam(month);
  }
  const t = await getTranslations("report");

  let rows: (string | number | null)[][];
  if (kind === "buses") {
    const buses = await busReportRange(from, to);
    rows = [
      [t("csvPlate"), t("csvBus"), t("departures"), t("csvSeats"), t("csvTickets"), t("csvTicketTotal"), t("csvOnboard")],
      ...buses.map((b) => [b.plate, b.name, b.departures, b.seats, b.tickets, b.ticketTotal, b.onboardCash]),
    ];
  } else {
    const routes = await routeReportRange(from, to);
    rows = [
      [t("csvFrom"), t("csvTo"), t("departures"), t("csvSeats"), t("csvTickets"), t("csvTicketTotal"), t("csvParcels"), t("csvParcelTotal")],
      ...routes.map((r) => [r.origin, r.destination, r.departures, r.seats, r.tickets, r.ticketTotal, r.parcels, r.parcelTotal]),
    ];
  }

  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="galmee-transport-${kind}-${label}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
