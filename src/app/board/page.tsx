import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { GalmeeMark } from "@/components/galmee/brand";
import { AutoRefresh } from "@/components/transport/auto-refresh";
import type { Locale } from "@/i18n/config";
import { addisTime, addisToday } from "@/lib/day";
import { formatEthiopianDate } from "@/lib/ethiopian-date";
import { tvBoardRows } from "@/lib/tv-board";
import { getSession } from "@/server/dal/session";
import { listBoard } from "@/server/dal/transport";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("tvBoard");
  return { title: t("title") };
}

/** Read-only departure board for the office TV: big type, amber on the dark board, refreshes itself. */
export default async function TvBoardPage() {
  const { tenant } = await getSession();
  const today = addisToday();
  const [t, tStatus, departures, locale] = await Promise.all([
    getTranslations("tvBoard"),
    getTranslations("departureStatus"),
    listBoard(today),
    getLocale() as Promise<Locale>,
  ]);
  const rows = tvBoardRows(departures);
  const updated = addisTime(new Date().toISOString());

  return (
    <main className="min-h-dvh bg-board px-4 py-6 text-white md:px-10 md:py-8">
      <AutoRefresh seconds={60} />
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/20 pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <GalmeeMark inverse className="size-10 md:size-14" />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold md:text-5xl">{tenant.name}</h1>
            <p className="text-white/80 md:text-2xl">{t("title")}</p>
          </div>
        </div>
        <p className="num text-white/80 md:text-right md:text-2xl">
          {formatEthiopianDate(today, locale)}
          <br />
          {t("updated", { time: updated })}
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="py-16 text-center text-2xl text-white/80 md:text-5xl">{t("empty")}</p>
      ) : (
        <table className="mt-4 w-full border-collapse text-left">
          <thead className="text-sm text-white/70 md:text-2xl">
            <tr>
              <th scope="col" className="py-2 pr-3 font-semibold">{t("time")}</th>
              <th scope="col" className="py-2 pr-3 font-semibold">{t("destination")}</th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">{t("seatsLeft")}</th>
              <th scope="col" className="hidden py-2 text-right font-semibold md:table-cell">{t("status")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/15">
            {rows.map((r) => {
              const cancelled = r.status === "cancelled";
              return (
                <tr key={r.id} className={cancelled ? "text-white/60" : undefined}>
                  <td className="num py-3 pr-3 text-2xl font-bold text-board-foreground md:text-6xl">{addisTime(r.departsAt)}</td>
                  <td className="py-3 pr-3 text-xl font-bold md:text-5xl">
                    <span className={cancelled ? "line-through" : undefined}>{r.destination}</span>
                    <span className="block text-sm font-semibold text-white/80 md:hidden">{tStatus(r.status)}</span>
                  </td>
                  <td className="num py-3 pr-3 text-right text-2xl font-bold md:text-5xl">
                    {cancelled ? "–" : r.seatsLeft === 0 ? t("full") : r.seatsLeft}
                  </td>
                  <td className="hidden py-3 text-right text-xl font-semibold md:table-cell md:text-4xl">{tStatus(r.status)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </main>
  );
}
