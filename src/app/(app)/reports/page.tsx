import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { DayNav } from "@/components/transport/day-nav";
import type { Locale } from "@/i18n/config";
import { addisToday } from "@/lib/day";
import { formatBirr } from "@/lib/money";
import { routeReport } from "@/server/dal/transport";
import { getSession } from "@/server/dal/session";
import { daySchema } from "@/server/validation";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const { profile } = await getSession();
  if (profile.role === "staff") redirect("/");
  const { day: dayRaw } = await searchParams;
  const today = addisToday();
  const day = daySchema.safeParse(dayRaw).data && dayRaw! <= today ? dayRaw! : today;
  const [t, rows, locale] = await Promise.all([getTranslations("report"), routeReport(day), getLocale() as Promise<Locale>]);

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <DayNav path="/reports" day={day} maxToday />
      {rows.length === 0 ? <p className="text-muted-foreground">{t("empty")}</p> : (
        <ul className="grid gap-3 md:grid-cols-2">
          {rows.map((r) => (
            <li key={r.routeId} className="grid gap-2 rounded-md border bg-card p-3">
              <p className="num font-bold">{r.origin} → {r.destination}</p>
              <dl className="num grid grid-cols-2 gap-2 text-sm">
                <div><dt className="text-muted-foreground">{t("departures")}</dt><dd className="font-semibold">{r.departures}</dd></div>
                <div><dt className="text-muted-foreground">{t("seats")}</dt><dd className="font-semibold">{t("seatsSold", { tickets: r.tickets, seats: r.seats })}</dd></div>
                <div><dt className="text-muted-foreground">{t("ticketTotal")}</dt><dd className="font-semibold">{formatBirr(r.ticketTotal, locale)}</dd></div>
                <div><dt className="text-muted-foreground">{t("parcels")}</dt><dd className="font-semibold">{r.parcels} · {formatBirr(r.parcelTotal, locale)}</dd></div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
