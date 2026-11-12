import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { PrintButton } from "@/components/transport/print-button";
import type { Locale } from "@/i18n/config";
import { addisTime } from "@/lib/day";
import { formatEthiopianDate } from "@/lib/ethiopian-date";
import { getSession } from "@/server/dal/session";
import { getDeparture } from "@/server/dal/transport";

/** Passenger list for the driver and road checkpoints: one A4/A5 page per departure, seat order. */
export default async function ManifestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const [found, t, { tenant }, locale] = await Promise.all([
    getDeparture(id),
    getTranslations("manifest"),
    getSession(),
    getLocale() as Promise<Locale>,
  ]);
  if (!found) notFound();
  const { departure: d, tickets } = found;
  const rows = [...tickets].sort((a, b) => a.seat - b.seat);

  return (
    <article className="grid gap-4 print:gap-3 print:text-black">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={`/departures/${d.id}`} className="text-sm text-primary underline-offset-4 hover:underline">
          {t("back")}
        </Link>
        <PrintButton label={t("print")} />
      </div>

      <header className="grid gap-1 border-b pb-3">
        <p className="font-bold">{tenant.name}</p>
        <h1 className="text-[1.5625rem] leading-tight font-bold">{t("title")}</h1>
        <p className="num text-lg font-semibold">
          {d.origin} → {d.destination}
        </p>
        <dl className="num grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground print:text-black">{t("date")}</dt>
            <dd className="font-semibold">{formatEthiopianDate(d.departsAt, locale)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground print:text-black">{t("time")}</dt>
            <dd className="font-semibold">{addisTime(d.departsAt)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground print:text-black">{t("vehicle")}</dt>
            <dd className="font-semibold">{d.vehicle}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground print:text-black">{t("driver")}</dt>
            <dd className="font-semibold">{d.driver ?? "—"}</dd>
          </div>
        </dl>
      </header>

      {rows.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        <table className="num w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b">
              <th scope="col" className="w-16 py-2 pr-2 font-semibold">{t("seat")}</th>
              <th scope="col" className="py-2 pr-2 font-semibold">{t("passenger")}</th>
              <th scope="col" className="py-2 font-semibold">{t("phone")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((x) => (
              <tr key={x.id} className="border-b break-inside-avoid">
                <td className="py-2 pr-2 font-bold">{x.seat}</td>
                <td className="py-2 pr-2">{x.name ?? "—"}</td>
                <td className="py-2">{x.phone ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="num font-semibold">{t("count", { count: rows.length, seats: d.seats })}</p>

      <div className="mt-6 grid grid-cols-2 gap-6 text-sm">
        <p className="border-t pt-2">{t("driverSign")}</p>
        <p className="border-t pt-2">{t("officeSign")}</p>
      </div>
    </article>
  );
}
