import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { recordHandoverAction, reverseHandoverAction } from "@/actions/transport";
import { ActionForm } from "@/components/transport/action-form";
import { DayNav } from "@/components/transport/day-nav";
import { Input } from "@/components/ui/input";
import type { Locale } from "@/i18n/config";
import { addisToday } from "@/lib/day";
import { formatBirr } from "@/lib/money";
import { listHandovers, reconcile } from "@/server/dal/transport";
import { getSession } from "@/server/dal/session";
import { daySchema } from "@/server/validation";

export default async function CashPage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const { profile } = await getSession();
  if (profile.role === "staff") redirect("/");
  const { day: dayRaw } = await searchParams;
  const today = addisToday();
  const day = daySchema.safeParse(dayRaw).data && dayRaw! <= today ? dayRaw! : today;
  const [t, rows, handovers, locale] = await Promise.all([getTranslations("cash"), reconcile(day), listHandovers(day), getLocale() as Promise<Locale>]);
  const short = rows.reduce((sum, r) => sum + (r.short > 0 ? r.short : 0), 0);

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <DayNav path="/cash" day={day} maxToday />
      {rows.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        <>
          <p className={`num text-xl font-bold ${short > 0 ? "text-destructive" : ""}`}>
            {short > 0 ? t("totalShort", { amount: formatBirr(short, locale) }) : t("allIn")}
          </p>
          <ul className="grid gap-3 md:grid-cols-2">
            {rows.map((r) => {
              const key = r.sellerId ?? r.vehicleId ?? r.label;
              return (
                <li key={key} className="grid gap-2 rounded-md border bg-card p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-bold">{r.label}</span>
                    <span className="text-sm text-muted-foreground">{t(r.kind)}</span>
                  </div>
                  <p className="num text-sm text-muted-foreground">{t("activity", { tickets: r.tickets, parcels: r.parcels })}</p>
                  <dl className="num grid grid-cols-3 gap-2 text-sm">
                    <div><dt className="text-muted-foreground">{t("expected")}</dt><dd className="font-semibold">{formatBirr(r.expected, locale)}</dd></div>
                    <div><dt className="text-muted-foreground">{t("handed")}</dt><dd className="font-semibold">{formatBirr(r.handed, locale)}</dd></div>
                    <div>
                      <dt className="text-muted-foreground">{r.short > 0 ? t("short") : r.short < 0 ? t("over") : t("settled")}</dt>
                      <dd className={`font-semibold ${r.short > 0 ? "text-destructive" : ""}`}>{formatBirr(Math.abs(r.short), locale)}</dd>
                    </div>
                  </dl>
                  <ActionForm key={r.handed} action={recordHandoverAction} submitLabel={t("record")} doneLabel={t("recorded")} variant="outline" className="grid grid-cols-[1fr_auto] items-center gap-2">
                    <input type="hidden" name="day" value={day} />
                    <input type="hidden" name="kind" value={r.kind} />
                    <input type="hidden" name="clientRef" value={randomUUID()} />
                    <input type="hidden" name="subject" value={r.sellerId ?? r.vehicleId ?? ""} />
                    <Input name="amount" inputMode="decimal" required defaultValue={r.short > 0 ? String(r.short) : ""} aria-label={t("amount")} autoComplete="off" />
                  </ActionForm>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <section className="grid gap-2">
        <h2 className="text-xl font-bold">{t("handovers")}</h2>
        {handovers.length === 0 ? <p className="text-muted-foreground">{t("noHandovers")}</p> : (
          <ul>
            {handovers.map((h) => (
              <li key={h.id} className={`grid gap-1 border-b py-3 ${h.reversed ? "text-muted-foreground line-through" : ""}`}>
                <div className="num flex items-baseline justify-between gap-2">
                  <span className="font-semibold">{h.who}</span>
                  <span>{formatBirr(h.amount, locale)}</span>
                </div>
                {h.note ? <p className="text-sm">{h.note}</p> : null}
                {h.reversed ? (
                  <p className="text-sm no-underline">{t("reversed")}</p>
                ) : (
                  <ActionForm action={reverseHandoverAction} submitLabel={t("reverse")} variant="outline" className="grid gap-1">
                    <input type="hidden" name="handover" value={h.id} />
                    <input type="hidden" name="day" value={day} />
                  </ActionForm>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
