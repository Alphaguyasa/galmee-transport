import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Bus, CheckCircle2, Clock, DoorOpen, Navigation, Tv, XCircle } from "lucide-react";
import { EmptyState } from "@/components/galmee/empty-state";
import { ListSheet } from "@/components/galmee/list-row";
import { StatusBadge } from "@/components/galmee/status-badge";
import { DayNav } from "@/components/transport/day-nav";
import { Roll } from "@/components/transport/roll";
import { buttonVariants } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import { addisTime, addisToday } from "@/lib/day";
import { formatBirr } from "@/lib/money";
import { listBoard } from "@/server/dal/transport";
import { getSession } from "@/server/dal/session";
import { daySchema } from "@/server/validation";

const STATUS = {
  scheduled: { tone: "neutral", icon: Clock },
  boarding: { tone: "sync", icon: DoorOpen },
  departed: { tone: "warn", icon: Navigation },
  arrived: { tone: "ok", icon: CheckCircle2 },
  cancelled: { tone: "urgent", icon: XCircle },
} as const;

export default async function BoardPage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const { day: dayRaw } = await searchParams;
  const day = daySchema.safeParse(dayRaw).data ?? addisToday();
  const locale = (await getLocale()) as Locale;
  const [t, tStatus, tTv, departures, { profile }] = await Promise.all([getTranslations("board"), getTranslations("departureStatus"), getTranslations("tvBoard"), listBoard(day), getSession()]);
  const canManage = profile.role !== "staff";

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-[1.5625rem] leading-tight font-bold">{t("title")}</h1>
        {canManage ? (
          <div className="flex gap-2">
            <Link href="/board" className={buttonVariants({ variant: "outline", className: "hidden md:inline-flex" })}>
              <Tv aria-hidden />
              {tTv("open")}
            </Link>
            <Link href="/departures/new" className={buttonVariants({ variant: "outline" })}>{t("schedule")}</Link>
          </div>
        ) : null}
      </div>
      <DayNav path="/" day={day} />
      {departures.length === 0 ? (
        <EmptyState
          icon={Bus}
          message={canManage ? t("emptyManager") : t("empty")}
          action={canManage ? <Link href="/departures/new" className={buttonVariants()}>{t("schedule")}</Link> : undefined}
        />
      ) : (
        <ListSheet>
          {departures.map((d) => {
            const closed = d.status === "arrived" || d.status === "cancelled";
            const status = STATUS[d.status];
            return (
              <li key={d.id}>
                <Link
                  href={`/departures/${d.id}`}
                  className={`grid gap-2 p-3 focus-visible:bg-band focus-visible:outline-none active:bg-band ${closed ? "opacity-70" : ""}`}
                >
                  <Roll origin={d.origin} destination={d.destination} />
                  <div className="flex items-center justify-between gap-2">
                    <span className="num text-[1.5625rem] leading-tight font-bold">{addisTime(d.departsAt)}</span>
                    <StatusBadge tone={status.tone} icon={status.icon}>{tStatus(d.status)}</StatusBadge>
                  </div>
                  <div className="num flex items-baseline justify-between gap-2 text-sm text-muted-foreground">
                    <span className="min-w-0 truncate">{d.vehicle}{d.driver ? ` · ${d.driver}` : ""}</span>
                    <span className="shrink-0">{t("seatsSold", { sold: d.sold, seats: d.seats })}</span>
                  </div>
                  <span className="num text-sm font-semibold">{formatBirr(d.fare, locale)}</span>
                </Link>
              </li>
            );
          })}
        </ListSheet>
      )}
    </div>
  );
}
