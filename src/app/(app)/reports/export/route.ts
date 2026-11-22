import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { addisToday } from "@/lib/day";
import { ethMonthOf, ethMonthRange, formatMonthParam, parseMonthParam, toCsv } from "@/lib/report-month";
import { busReportRange, routeReportRange } from "@/server/dal/transport";
import { getSession } from "@/server/dal/session";

/** CSV of the month report: ?kind=routes|buses&month=YYYY-MM (Ethiopian month). Owners and managers only. */
export async function GET(request: Request) {
  const { profile } = await getSession();
  if (profile.role === "staff") redirect("/");

  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") === "buses" ? "buses" : "routes";
  const month = parseMonthParam(url.searchParams.get("month") ?? undefined, ethMonthOf(addisToday()));
  const { from, to } = ethMonthRange(month);
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
      "Content-Disposition": `attachment; filename="galmee-transport-${kind}-${formatMonthParam(month)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
