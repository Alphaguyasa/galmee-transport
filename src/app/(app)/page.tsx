import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { DayNav } from "@/components/transport/day-nav";
import { Roll } from "@/components/transport/roll";
import { buttonVariants } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import { addisTime, addisToday } from "@/lib/day";
import { formatBirr } from "@/lib/money";
import { listBoard } from "@/server/dal/transport";
import { getSession } from "@/server/dal/session";
import { daySchema } from "@/server/validation";

export default async function BoardPage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const { day: dayRaw } = await searchParams;
  const day = daySchema.safeParse(dayRaw).data ?? addisToday();
  const locale = (await getLocale()) as Locale;
  const [t, tStatus, departures, { profile }] = await Promise.all([getTranslations("board"), getTranslations("departureStatus"), listBoard(day), getSession()]);
  const canManage = profile.role !== "staff";

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        {canManage ? (
          <Link href="/departures/new" className={buttonVariants({ variant: "outline" })}>{t("schedule")}</Link>
        ) : null}
      </div>
      <DayNav path="/" day={day} />
      {departures.length === 0 ? (
        <p className="text-muted-foreground">{canManage ? t("emptyManager") : t("empty")}</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {departures.map((d) => {
            const closed = d.status === "arrived" || d.status === "cancelled";
            return (
              <li key={d.id}>
                <Link href={`/departures/${d.id}`} className={`grid gap-2 rounded-md border bg-card p-3 ${closed ? "opacity-70" : ""}`}>
                  <Roll origin={d.origin} destination={d.destination} />
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="num text-2xl font-bold">{addisTime(d.departsAt)}</span>
                    <span className="text-sm font-semibold">{tStatus(d.status)}</span>
                  </div>
                  <div className="num flex items-baseline justify-between gap-2 text-sm text-muted-foreground">
                    <span>{d.vehicle}{d.driver ? ` · ${d.driver}` : ""}</span>
                    <span>{t("seatsSold", { sold: d.sold, seats: d.seats })}</span>
                  </div>
                  <span className="num text-sm">{formatBirr(d.fare, locale)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
