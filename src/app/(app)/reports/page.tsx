import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { DayNav } from "@/components/transport/day-nav";
import type { Locale } from "@/i18n/config";
import { addDays, addisToday } from "@/lib/day";
import { ETHIOPIAN_MONTHS, formatEthiopianDate } from "@/lib/ethiopian-date";
import { formatBirr } from "@/lib/money";
import { compareEthMonth, ethMonthOf, ethMonthRange, formatMonthParam, parseMonthParam, parseWeekEnd, shiftEthMonth, type EthMonth } from "@/lib/report-month";
import { busReportRange, routeReport, routeReportRange, type RouteReportRow } from "@/server/dal/transport";
import { getSession } from "@/server/dal/session";
import { daySchema } from "@/server/validation";

type Search = { day?: string; view?: string; month?: string; end?: string };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { profile } = await getSession();
  if (profile.role === "staff") redirect("/");
  const params = await searchParams;
  const t = await getTranslations("report");
  const view = params.view === "month" || params.view === "week" ? params.view : "day";

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <nav aria-label={t("chooseView")} className="grid grid-cols-3 gap-1 rounded-md border bg-card p-1">
        <ViewLink href="/reports" active={view === "day"}>{t("viewDay")}</ViewLink>
        <ViewLink href="/reports?view=week" active={view === "week"}>{t("viewWeek")}</ViewLink>
        <ViewLink href="/reports?view=month" active={view === "month"}>{t("viewMonth")}</ViewLink>
      </nav>
      {view === "month" ? <MonthReport raw={params.month} /> : view === "week" ? <WeekReport raw={params.end} /> : <DayReport raw={params.day} />}
    </div>
  );
}

function ViewLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex min-h-11 items-center justify-center rounded font-semibold ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
    >
      {children}
    </Link>
  );
}

async function DayReport({ raw }: { raw?: string }) {
  const today = addisToday();
  const day = daySchema.safeParse(raw).data && raw! <= today ? raw! : today;
  const [t, rows, locale] = await Promise.all([getTranslations("report"), routeReport(day), getLocale() as Promise<Locale>]);
  return (
    <>
      <DayNav path="/reports" day={day} maxToday />
      {rows.length === 0 ? <p className="text-muted-foreground">{t("empty")}</p> : <RouteCards rows={rows} locale={locale} />}
    </>
  );
}

async function MonthReport({ raw }: { raw?: string }) {
  const current = ethMonthOf(addisToday());
  const month = parseMonthParam(raw, current);
  const { from, to } = ethMonthRange(month);
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("report");
  return (
    <PeriodReport
      from={from}
      to={to}
      exportQuery={`month=${formatMonthParam(month)}`}
      emptyText={t("emptyMonth")}
      nav={<MonthNav month={month} current={current} locale={locale} />}
    />
  );
}

async function WeekReport({ raw }: { raw?: string }) {
  const today = addisToday();
  const end = parseWeekEnd(raw, today);
  const from = addDays(end, -6);
  const [t, locale] = await Promise.all([getTranslations("report"), getLocale() as Promise<Locale>]);
  const isCurrent = end >= today;
  const href = (e: string) => `/reports?view=week&end=${e}`;
  return (
    <PeriodReport
      from={from}
      to={end}
      exportQuery={`end=${end}`}
      emptyText={t("emptyWeek")}
      nav={
        <nav aria-label={t("viewWeek")} className="flex items-center justify-between gap-2">
          <Link href={href(addDays(end, -7))} aria-label={t("previousWeek")} className="inline-flex size-12 items-center justify-center rounded-md border bg-card">
            <ChevronLeft className="size-5" aria-hidden />
          </Link>
          <p className="num text-center font-semibold">
            {formatEthiopianDate(from, locale, { withEra: false })} – {formatEthiopianDate(end, locale)}
          </p>
          {isCurrent ? (
            <span className="size-12" aria-hidden />
          ) : (
            <Link href={href(addDays(end, 7) > today ? today : addDays(end, 7))} aria-label={t("nextWeek")} className="inline-flex size-12 items-center justify-center rounded-md border bg-card">
              <ChevronRight className="size-5" aria-hidden />
            </Link>
          )}
        </nav>
      }
    />
  );
}

async function PeriodReport({ from, to, exportQuery, emptyText, nav }: { from: string; to: string; exportQuery: string; emptyText: string; nav: React.ReactNode }) {
  const [t, routes, buses, locale] = await Promise.all([
    getTranslations("report"),
    routeReportRange(from, to),
    busReportRange(from, to),
    getLocale() as Promise<Locale>,
  ]);
  const takings = routes.reduce((sum, r) => sum + r.ticketTotal + r.parcelTotal, 0);
  const tickets = routes.reduce((sum, r) => sum + r.tickets, 0);

  return (
    <>
      {nav}
      {routes.length === 0 && buses.length === 0 ? (
        <p className="text-muted-foreground">{emptyText}</p>
      ) : (
        <>
          <dl className="num grid grid-cols-2 gap-3 rounded-md border bg-card p-3">
            <div><dt className="text-sm text-muted-foreground">{t("takings")}</dt><dd className="text-xl font-bold">{formatBirr(takings, locale)}</dd></div>
            <div><dt className="text-sm text-muted-foreground">{t("csvTickets")}</dt><dd className="text-xl font-bold">{tickets}</dd></div>
          </dl>

          <section aria-labelledby="by-route" className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="by-route" className="text-lg font-bold">{t("byRoute")}</h2>
              <CsvLink href={`/reports/export?kind=routes&${exportQuery}`}>{t("downloadRoutes")}</CsvLink>
            </div>
            <RouteCards rows={routes} locale={locale} />
          </section>

          <section aria-labelledby="by-bus" className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="by-bus" className="text-lg font-bold">{t("byBus")}</h2>
              <CsvLink href={`/reports/export?kind=buses&${exportQuery}`}>{t("downloadBuses")}</CsvLink>
            </div>
            <ul className="grid gap-3 md:grid-cols-2">
              {buses.map((b) => (
                <li key={b.vehicleId} className="grid gap-2 rounded-md border bg-card p-3">
                  <p className="num font-bold">{b.plate}{b.name ? <span className="ms-2 font-normal text-muted-foreground">{b.name}</span> : null}</p>
                  <dl className="num grid grid-cols-2 gap-2 text-sm">
                    <div><dt className="text-muted-foreground">{t("departures")}</dt><dd className="font-semibold">{b.departures}</dd></div>
                    <div><dt className="text-muted-foreground">{t("seats")}</dt><dd className="font-semibold">{t("seatsSold", { tickets: b.tickets, seats: b.seats })}</dd></div>
                    <div><dt className="text-muted-foreground">{t("ticketTotal")}</dt><dd className="font-semibold">{formatBirr(b.ticketTotal, locale)}</dd></div>
                    <div><dt className="text-muted-foreground">{t("onboardCash")}</dt><dd className="font-semibold">{formatBirr(b.onboardCash, locale)}</dd></div>
                  </dl>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </>
  );
}

async function MonthNav({ month, current, locale }: { month: EthMonth; current: EthMonth; locale: Locale }) {
  const t = await getTranslations("report");
  const isCurrent = compareEthMonth(month, current) >= 0;
  const label = `${ETHIOPIAN_MONTHS[locale][month.month - 1]} ${month.year}`;
  const href = (m: EthMonth) => `/reports?view=month&month=${formatMonthParam(m)}`;
  return (
    <nav aria-label={t("viewMonth")} className="flex items-center justify-between gap-2">
      <Link href={href(shiftEthMonth(month, -1))} aria-label={t("previousMonth")} className="inline-flex size-12 items-center justify-center rounded-md border bg-card">
        <ChevronLeft className="size-5" aria-hidden />
      </Link>
      <p className="num text-center font-semibold">
        {label}
        {isCurrent ? <span className="ms-2 text-sm font-normal text-muted-foreground">{t("thisMonth")}</span> : null}
      </p>
      {isCurrent ? (
        <span className="size-12" aria-hidden />
      ) : (
        <Link href={href(shiftEthMonth(month, 1))} aria-label={t("nextMonth")} className="inline-flex size-12 items-center justify-center rounded-md border bg-card">
          <ChevronRight className="size-5" aria-hidden />
        </Link>
      )}
    </nav>
  );
}

function CsvLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} download className="inline-flex min-h-11 items-center gap-2 rounded-md border bg-card px-3 text-sm font-semibold hover:bg-muted">
      <Download className="size-4" aria-hidden />
      {children}
    </a>
  );
}

async function RouteCards({ rows, locale }: { rows: RouteReportRow[]; locale: Locale }) {
  const t = await getTranslations("report");
  return (
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
  );
}
