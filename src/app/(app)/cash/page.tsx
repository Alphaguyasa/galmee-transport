import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { recordHandoverAction, reverseHandoverAction } from "@/actions/transport";
import { CheckCircle2, CircleAlert, CirclePlus, Wallet } from "lucide-react";
import { EmptyState } from "@/components/galmee/empty-state";
import { ListRow, ListSheet } from "@/components/galmee/list-row";
import { MoneySummaryCard } from "@/components/galmee/money-summary-card";
import { StatusBadge } from "@/components/galmee/status-badge";
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
      <h1 className="text-[1.5625rem] leading-tight font-bold">{t("title")}</h1>
      <DayNav path="/cash" day={day} maxToday />
      {rows.length === 0 ? (
        <EmptyState icon={Wallet} message={t("empty")} />
      ) : (
        <>
          <MoneySummaryCard
            tone={short > 0 ? "owed" : "in"}
            size={short > 0 ? "lg" : "md"}
            label={short > 0 ? t("short") : t("settled")}
            figure={short > 0 ? formatBirr(short, locale) : t("allIn")}
          />
          <ListSheet className="md:grid md:grid-cols-2 md:divide-y-0">
            {rows.map((r) => {
              const key = r.sellerId ?? r.vehicleId ?? r.label;
              return (
                <li key={key} className="grid gap-2 p-3 md:border-b md:odd:border-r">
                  <div className="flex items-start justify-between gap-2">
                    <div className="grid min-w-0 gap-0.5">
                      <span className="truncate font-semibold">{r.label}</span>
                      <span className="num text-sm text-muted-foreground">
                        {t(r.kind)} · {t("activity", { tickets: r.tickets, parcels: r.parcels })}
                      </span>
                    </div>
                    {r.short > 0 ? (
                      <StatusBadge tone="urgent" icon={CircleAlert}>{t("short")} {formatBirr(r.short, locale)}</StatusBadge>
                    ) : r.short < 0 ? (
                      <StatusBadge tone="warn" icon={CirclePlus}>{t("over")} {formatBirr(-r.short, locale)}</StatusBadge>
                    ) : (
                      <StatusBadge tone="ok" icon={CheckCircle2}>{t("settled")}</StatusBadge>
                    )}
                  </div>
                  <dl className="num grid grid-cols-2 gap-2 text-sm">
                    <div><dt className="text-muted-foreground">{t("expected")}</dt><dd className="font-semibold">{formatBirr(r.expected, locale)}</dd></div>
                    <div><dt className="text-muted-foreground">{t("handed")}</dt><dd className="font-semibold">{formatBirr(r.handed, locale)}</dd></div>
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
          </ListSheet>
        </>
      )}

      <section className="grid gap-2">
        <h2 className="text-xl font-bold">{t("handovers")}</h2>
        {handovers.length === 0 ? <p className="text-muted-foreground">{t("noHandovers")}</p> : (
          <ListSheet>
            {handovers.map((h) => (
              <ListRow
                key={h.id}
                className={h.reversed ? "text-muted-foreground" : undefined}
                title={<span className={h.reversed ? "line-through" : undefined}>{h.who}</span>}
                right={<span className={`num font-semibold ${h.reversed ? "line-through" : ""}`}>{formatBirr(h.amount, locale)}</span>}
                sub={
                  <>
                    {h.note ? <span>{h.note}</span> : null}
                    {h.reversed ? (
                      <span>{t("reversed")}</span>
                    ) : (
                      <ActionForm action={reverseHandoverAction} submitLabel={t("reverse")} variant="outline" className="grid justify-items-start gap-1">
                        <input type="hidden" name="handover" value={h.id} />
                        <input type="hidden" name="day" value={day} />
                      </ActionForm>
                    )}
                  </>
                }
              />
            ))}
          </ListSheet>
        )}
      </section>
    </div>
  );
}
