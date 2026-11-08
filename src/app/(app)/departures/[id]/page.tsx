import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { setDepartureStatusAction, voidTicketAction } from "@/actions/transport";
import { ActionForm } from "@/components/transport/action-form";
import { Roll } from "@/components/transport/roll";
import { SaleForm } from "@/components/transport/sale-form";
import { Input } from "@/components/ui/input";
import type { Locale } from "@/i18n/config";
import { addisTime } from "@/lib/day";
import { formatEthiopianDate } from "@/lib/ethiopian-date";
import { formatBirr } from "@/lib/money";
import { getDeparture, type DepartureStatus } from "@/server/dal/transport";
import { getSession } from "@/server/dal/session";

const NEXT: Record<DepartureStatus, ("boarding" | "departed" | "arrived")[]> = {
  scheduled: ["boarding", "departed"],
  boarding: ["departed"],
  departed: ["arrived"],
  arrived: [],
  cancelled: [],
};

export default async function DeparturePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sold?: string }> }) {
  const [{ id }, { sold }] = await Promise.all([params, searchParams]);
  if (!z.string().uuid().safeParse(id).success) notFound();
  const soldSeat = z.coerce.number().int().min(1).max(80).safeParse(sold).data;
  const [found, t, tStatus, tMethods, { profile }, locale] = await Promise.all([
    getDeparture(id), getTranslations("sale"), getTranslations("departureStatus"), getTranslations("methods"), getSession(), getLocale() as Promise<Locale>,
  ]);
  if (!found) notFound();
  const { departure: d, tickets } = found;
  const canManage = profile.role !== "staff";
  const canSell = d.status === "scheduled" || d.status === "boarding" || d.status === "departed";
  const canCancel = canManage && (d.status === "scheduled" || d.status === "boarding") && tickets.length === 0;

  return (
    <div className="grid gap-4">
      <Link href="/" className="text-sm text-primary underline-offset-4 hover:underline">{t("backToBoard")}</Link>
      <h1 className="sr-only">{t("title")}</h1>
      <Roll origin={d.origin} destination={d.destination} />
      <div className="flex items-baseline justify-between gap-2">
        <span className="num text-2xl font-bold">{addisTime(d.departsAt)}</span>
        <span className="font-semibold">{tStatus(d.status)}</span>
      </div>
      <p className="num text-sm text-muted-foreground">
        {formatEthiopianDate(d.departsAt, locale)} · {d.vehicle}{d.driver ? ` · ${d.driver}` : ""} · {formatBirr(d.fare, locale)} · {t("seatsSold", { sold: d.sold, seats: d.seats })}
      </p>

      {soldSeat ? <p role="status" className="rounded-md bg-accent px-3 py-2 font-semibold text-accent-foreground">{t("soldNote", { seat: soldSeat })}</p> : null}

      <div className="flex flex-wrap gap-2">
        {NEXT[d.status].map((status) => (
          <ActionForm key={status} action={setDepartureStatusAction} submitLabel={t(`action_${status}`)} variant="outline" className="grid gap-1">
            <input type="hidden" name="departure" value={d.id} />
            <input type="hidden" name="status" value={status} />
          </ActionForm>
        ))}
        {canCancel ? (
          <ActionForm action={setDepartureStatusAction} submitLabel={t("action_cancelled")} variant="destructive" className="grid gap-1">
            <input type="hidden" name="departure" value={d.id} />
            <input type="hidden" name="status" value="cancelled" />
          </ActionForm>
        ) : null}
      </div>

      {canSell ? (
        <SaleForm key={soldSeat ?? 0} departure={d.id} seats={d.seats} taken={tickets.map((x) => x.seat)} canOnboard={d.status === "departed"} />
      ) : (
        <p className="text-muted-foreground">{t("closed")}</p>
      )}

      <section className="grid gap-2">
        <h2 className="text-xl font-bold">{t("ticketsTitle")}</h2>
        {tickets.length === 0 ? (
          <p className="text-muted-foreground">{t("noTickets")}</p>
        ) : (
          <ul>
            {tickets.map((x) => (
              <li key={x.id} className="grid gap-2 border-b py-3">
                <div className="num flex items-baseline justify-between gap-2">
                  <span className="font-semibold">{t("seatLabel", { seat: x.seat })}</span>
                  <span>{tMethods(x.method)} · {t(x.channel)}</span>
                </div>
                {x.phone || x.name ? <p className="num text-sm text-muted-foreground">{[x.name, x.phone].filter(Boolean).join(" · ")}</p> : null}
                {canManage ? (
                  <ActionForm action={voidTicketAction} submitLabel={t("void")} doneLabel={t("voided")} variant="outline" className="grid grid-cols-[1fr_auto] items-center gap-2">
                    <input type="hidden" name="ticket" value={x.id} />
                    <input type="hidden" name="departure" value={d.id} />
                    <Input name="reason" required minLength={2} maxLength={300} placeholder={t("voidReason")} aria-label={t("voidReason")} />
                  </ActionForm>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
