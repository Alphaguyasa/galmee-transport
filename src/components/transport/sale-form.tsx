"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { sellTicketAction } from "@/actions/transport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { SelectField } from "./fields";

/** Seat grid and sale form. A remount after each sale (key on the sold seat) clears the choice and issues a new client_ref. */
export function SaleForm({ departure, seats, taken, canOnboard }: { departure: string; seats: number; taken: number[]; canOnboard: boolean }) {
  const t = useTranslations("sale");
  const tMethods = useTranslations("methods");
  const tErrors = useTranslations("errors");
  const [state, formAction, pending] = useActionState(sellTicketAction, undefined);
  const [seat, setSeat] = useState<number | null>(null);
  const [clientRef] = useState(() => crypto.randomUUID());
  const takenSet = new Set(taken);

  return (
    <form action={formAction} className="grid gap-4 pb-16 md:pb-0">
      <input type="hidden" name="departure" value={departure} />
      <input type="hidden" name="clientRef" value={clientRef} />
      <fieldset className="grid gap-2">
        <legend className="mb-1 font-semibold">{t("chooseSeat")}</legend>
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: seats }, (_, i) => i + 1).map((n) => {
            const isTaken = takenSet.has(n);
            return (
              <label
                key={n}
                className={cn(
                  "num flex h-12 items-center justify-center rounded-md border text-base font-semibold",
                  isTaken ? "bg-muted text-muted-foreground line-through" : "cursor-pointer bg-card has-[:checked]:bg-primary has-[:checked]:text-primary-foreground has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
                )}
              >
                <input
                  type="radio"
                  name="seat"
                  value={n}
                  disabled={isTaken}
                  required
                  className="sr-only"
                  onChange={() => setSeat(n)}
                  aria-label={isTaken ? t("seatTaken", { seat: n }) : t("seatFree", { seat: n })}
                />
                {n}
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="grid gap-2">
        <Label htmlFor="phone">{t("phone")}</Label>
        <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="off" placeholder="0911 234 567" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="name">{t("name")}</Label>
        <Input id="name" name="name" autoComplete="off" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SelectField name="method" label={t("method")} defaultValue="cash" options={(["cash", "telebirr", "cbe_birr", "bank"] as const).map((m) => ({ value: m, label: tMethods(m) }))} />
        <SelectField
          name="channel"
          label={t("channel")}
          defaultValue={canOnboard ? "onboard" : "office"}
          options={[{ value: "office", label: t("office") }, { value: "onboard", label: t("onboard") }]}
        />
      </div>
      {state?.error ? (
        <p role="alert" className="text-sm text-destructive">{tErrors(state.error)}</p>
      ) : null}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t bg-card p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] md:static md:border-0 md:bg-transparent md:p-0">
        <Button type="submit" size="lg" className="w-full" disabled={pending || seat === null} aria-busy={pending}>
          {seat === null ? t("pickSeatFirst") : t("sell", { seat })}
        </Button>
      </div>
    </form>
  );
}
