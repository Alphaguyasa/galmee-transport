import { randomUUID } from "node:crypto";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { registerParcelAction, setParcelStatusAction } from "@/actions/transport";
import { ActionForm } from "@/components/transport/action-form";
import { SelectField, selectClass } from "@/components/transport/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Locale } from "@/i18n/config";
import { addDays, addisTime, addisToday } from "@/lib/day";
import { formatBirr } from "@/lib/money";
import { listBoard, listParcels, listSetup } from "@/server/dal/transport";
import { getSession } from "@/server/dal/session";

const queryParam = z.string().trim().max(40);

export default async function ParcelsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const query = queryParam.safeParse(q ?? "").data ?? "";
  const today = addisToday();
  const [t, tMethods, tStatus, { routes }, parcels, todayBoard, tomorrowBoard, { profile }, locale] = await Promise.all([
    getTranslations("parcels"), getTranslations("methods"), getTranslations("parcelStatus"),
    listSetup(), listParcels(query), listBoard(today), listBoard(addDays(today, 1)), getSession(), getLocale() as Promise<Locale>,
  ]);
  const open = [...todayBoard, ...tomorrowBoard].filter((d) => d.status === "scheduled" || d.status === "boarding");
  const canManage = profile.role !== "staff";

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <form action="/parcels" className="flex items-end gap-2">
        <div className="grid min-w-0 flex-1 gap-2">
          <Label htmlFor="q">{t("search")}</Label>
          <Input id="q" name="q" defaultValue={query} inputMode="tel" autoComplete="off" />
        </div>
        <Button type="submit" size="lg">{t("searchAction")}</Button>
      </form>

      {parcels.length === 0 ? (
        <p className="text-muted-foreground">{query ? t("noMatch") : t("empty")}</p>
      ) : (
        <ul>
          {parcels.map((p) => {
            const options = open.filter((d) => d.routeId === p.routeId);
            return (
              <li key={p.id} className="grid gap-2 border-b py-3">
                <div className="num flex items-baseline justify-between gap-2">
                  <span className="font-bold">{t("waybill", { no: p.waybillNo })}</span>
                  <span className="text-sm font-semibold">{tStatus(p.status)}</span>
                </div>
                <p className="num text-sm">{p.origin} → {p.destination} · {formatBirr(p.fee, locale)}</p>
                <p className="text-sm">{p.description}</p>
                <p className="num text-sm text-muted-foreground">{p.senderName} → {p.receiverName} · {p.receiverPhone}</p>
                {p.status === "received" ? (
                  options.length > 0 ? (
                    <ActionForm action={setParcelStatusAction} submitLabel={t("load")} variant="outline" className="grid grid-cols-[1fr_auto] items-end gap-2">
                      <input type="hidden" name="parcel" value={p.id} />
                      <input type="hidden" name="status" value="loaded" />
                      <select name="departure" aria-label={t("chooseDeparture")} className={selectClass}>
                        {options.map((d) => <option key={d.id} value={d.id}>{addisTime(d.departsAt)} · {d.vehicle}</option>)}
                      </select>
                    </ActionForm>
                  ) : <p className="text-sm text-muted-foreground">{t("noDeparture")}</p>
                ) : null}
                {p.status === "loaded" ? (
                  <ActionForm action={setParcelStatusAction} submitLabel={t("arrived")} variant="outline" className="grid gap-1">
                    <input type="hidden" name="parcel" value={p.id} />
                    <input type="hidden" name="status" value="arrived" />
                  </ActionForm>
                ) : null}
                {p.status === "arrived" ? (
                  <ActionForm action={setParcelStatusAction} submitLabel={t("collected")} variant="outline" className="grid gap-1">
                    <input type="hidden" name="parcel" value={p.id} />
                    <input type="hidden" name="status" value="collected" />
                  </ActionForm>
                ) : null}
                {canManage && (p.status === "received" || p.status === "loaded") ? (
                  <ActionForm action={setParcelStatusAction} submitLabel={t("cancel")} variant="outline" className="grid gap-1">
                    <input type="hidden" name="parcel" value={p.id} />
                    <input type="hidden" name="status" value="cancelled" />
                  </ActionForm>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <section className="grid gap-3">
        <h2 className="text-xl font-bold">{t("register")}</h2>
        {routes.length === 0 ? <p className="text-muted-foreground">{t("needRoutes")}</p> : (
          <ActionForm action={registerParcelAction} submitLabel={t("registerAction")} doneLabel={t("registered")}>
            <input type="hidden" name="clientRef" value={randomUUID()} />
            <SelectField name="route" label={t("route")} options={routes.filter((r) => r.active).map((r) => ({ value: r.id, label: `${r.origin} → ${r.destination}` }))} />
            <div className="grid gap-2"><Label htmlFor="senderName">{t("senderName")}</Label><Input id="senderName" name="senderName" required autoComplete="off" /></div>
            <div className="grid gap-2"><Label htmlFor="senderPhone">{t("senderPhone")}</Label><Input id="senderPhone" name="senderPhone" type="tel" inputMode="tel" autoComplete="off" /></div>
            <div className="grid gap-2"><Label htmlFor="receiverName">{t("receiverName")}</Label><Input id="receiverName" name="receiverName" required autoComplete="off" /></div>
            <div className="grid gap-2"><Label htmlFor="receiverPhone">{t("receiverPhone")}</Label><Input id="receiverPhone" name="receiverPhone" type="tel" inputMode="tel" required autoComplete="off" /></div>
            <div className="grid gap-2"><Label htmlFor="description">{t("description")}</Label><Input id="description" name="description" required autoComplete="off" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2"><Label htmlFor="weight">{t("weight")}</Label><Input id="weight" name="weight" inputMode="decimal" autoComplete="off" /></div>
              <div className="grid gap-2"><Label htmlFor="fee">{t("fee")}</Label><Input id="fee" name="fee" inputMode="decimal" required autoComplete="off" /></div>
            </div>
            <SelectField name="method" label={t("method")} defaultValue="cash" options={(["cash", "telebirr", "cbe_birr", "bank"] as const).map((m) => ({ value: m, label: tMethods(m) }))} />
          </ActionForm>
        )}
      </section>
    </div>
  );
}
