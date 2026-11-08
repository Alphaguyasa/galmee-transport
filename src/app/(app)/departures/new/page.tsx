import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { scheduleDepartureAction } from "@/actions/transport";
import { ActionForm } from "@/components/transport/action-form";
import { DateField, SelectField } from "@/components/transport/fields";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Locale } from "@/i18n/config";
import { addisToday } from "@/lib/day";
import { formatBirr } from "@/lib/money";
import { listSetup } from "@/server/dal/transport";
import { getSession } from "@/server/dal/session";

export default async function NewDeparturePage() {
  const { profile } = await getSession();
  if (profile.role === "staff") redirect("/");
  const [t, { routes, vehicles, drivers }, locale] = await Promise.all([getTranslations("schedule"), listSetup(), getLocale() as Promise<Locale>]);
  const activeRoutes = routes.filter((r) => r.active);
  const activeVehicles = vehicles.filter((v) => v.active);
  const today = addisToday();

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      {activeRoutes.length === 0 || activeVehicles.length === 0 ? (
        <p className="text-muted-foreground">{t("needSetup")}</p>
      ) : (
        <ActionForm action={scheduleDepartureAction} submitLabel={t("submit")}>
          <SelectField name="route" label={t("route")} options={activeRoutes.map((r) => ({ value: r.id, label: `${r.origin} → ${r.destination} (${formatBirr(r.fare, locale)})` }))} />
          <SelectField name="vehicle" label={t("vehicle")} options={activeVehicles.map((v) => ({ value: v.id, label: `${v.name ?? v.plate} (${t("seats", { seats: v.seats })})` }))} />
          <SelectField name="driver" label={t("driver")} defaultValue="" options={[{ value: "", label: t("noDriver") }, ...drivers.filter((d) => d.active).map((d) => ({ value: d.id, label: d.name }))]} />
          <DateField name="day" label={t("day")} defaultValue={today} min={today} />
          <div className="grid gap-2">
            <Label htmlFor="time">{t("time")}</Label>
            <Input id="time" name="time" type="time" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="fare">{t("fare")}</Label>
            <Input id="fare" name="fare" inputMode="decimal" autoComplete="off" />
          </div>
        </ActionForm>
      )}
    </div>
  );
}
