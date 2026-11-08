import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { addDriverAction, addRouteAction, addVehicleAction } from "@/actions/transport";
import { ActionForm } from "@/components/transport/action-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Locale } from "@/i18n/config";
import { formatBirr } from "@/lib/money";
import { listSetup } from "@/server/dal/transport";
import { getSession } from "@/server/dal/session";

function Field({ name, label, required = false, inputMode, type }: { name: string; label: string; required?: boolean; inputMode?: "decimal" | "tel" | "numeric"; type?: string }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} required={required} inputMode={inputMode} type={type} autoComplete="off" />
    </div>
  );
}

export default async function SetupPage() {
  const { profile } = await getSession();
  if (profile.role === "staff") redirect("/");
  const [t, { routes, vehicles, drivers }, locale] = await Promise.all([getTranslations("setup"), listSetup(), getLocale() as Promise<Locale>]);

  return (
    <div className="grid gap-8">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <section className="grid gap-3">
        <h2 className="text-xl font-bold">{t("routes")}</h2>
        {routes.length === 0 ? <p className="text-muted-foreground">{t("noRoutes")}</p> : (
          <ul>{routes.map((r) => (
            <li key={r.id} className="num flex items-baseline justify-between gap-2 border-b py-2">
              <span>{r.origin} → {r.destination}</span><span>{formatBirr(r.fare, locale)}</span>
            </li>
          ))}</ul>
        )}
        <ActionForm action={addRouteAction} submitLabel={t("addRoute")} doneLabel={t("saved")}>
          <Field name="origin" label={t("origin")} required />
          <Field name="destination" label={t("destination")} required />
          <Field name="fare" label={t("fare")} required inputMode="decimal" />
        </ActionForm>
      </section>
      <section className="grid gap-3">
        <h2 className="text-xl font-bold">{t("vehicles")}</h2>
        {vehicles.length === 0 ? <p className="text-muted-foreground">{t("noVehicles")}</p> : (
          <ul>{vehicles.map((v) => (
            <li key={v.id} className="num flex items-baseline justify-between gap-2 border-b py-2">
              <span>{v.name ?? v.plate}</span><span className="text-sm text-muted-foreground">{v.plate} · {t("seatsCount", { seats: v.seats })}</span>
            </li>
          ))}</ul>
        )}
        <ActionForm action={addVehicleAction} submitLabel={t("addVehicle")} doneLabel={t("saved")}>
          <Field name="plate" label={t("plate")} required />
          <Field name="name" label={t("vehicleName")} />
          <Field name="seats" label={t("seats")} required inputMode="numeric" />
        </ActionForm>
      </section>
      <section className="grid gap-3">
        <h2 className="text-xl font-bold">{t("drivers")}</h2>
        {drivers.length === 0 ? <p className="text-muted-foreground">{t("noDrivers")}</p> : (
          <ul>{drivers.map((d) => (
            <li key={d.id} className="num flex items-baseline justify-between gap-2 border-b py-2">
              <span>{d.name}</span><span className="text-sm text-muted-foreground">{d.phone ?? ""}</span>
            </li>
          ))}</ul>
        )}
        <ActionForm action={addDriverAction} submitLabel={t("addDriver")} doneLabel={t("saved")}>
          <Field name="name" label={t("driverName")} required />
          <Field name="phone" label={t("phone")} type="tel" inputMode="tel" />
        </ActionForm>
      </section>
    </div>
  );
}
