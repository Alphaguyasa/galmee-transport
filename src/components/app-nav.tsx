"use client";

import { useTranslations } from "next-intl";
import { Banknote, BarChart3, Package, Settings, Ticket } from "lucide-react";
import { BottomNav } from "@/components/galmee/bottom-nav";

const ITEMS = [
  { href: "/", key: "home", icon: Ticket, manager: false },
  { href: "/parcels", key: "parcels", icon: Package, manager: false },
  { href: "/cash", key: "cash", icon: Banknote, manager: true },
  { href: "/reports", key: "reports", icon: BarChart3, manager: true },
  { href: "/setup", key: "setup", icon: Settings, manager: true },
] as const;

/** Transport's destinations in the shared Galmee nav; sellers see only sale and parcels. */
export function AppNav({ variant, canManage }: { variant: "bottom" | "side"; canManage: boolean }) {
  const t = useTranslations("nav");
  return (
    <BottomNav
      variant={variant}
      menuLabel={t("menu")}
      items={ITEMS.filter((item) => canManage || !item.manager).map(({ href, key, icon }) => ({
        href,
        label: t(key),
        icon,
      }))}
    />
  );
}
