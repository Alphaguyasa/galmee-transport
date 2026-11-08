"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as dal from "@/server/dal/transport";
import { getSession, getUserId } from "@/server/dal/session";
import {
  departureSchema,
  departureStatusSchema,
  driverSchema,
  formToObject,
  handoverSchema,
  parcelSchema,
  parcelStatusSchema,
  reverseHandoverSchema,
  routeSchema,
  saleSchema,
  vehicleSchema,
  voidSchema,
} from "@/server/validation";

/** `error` is a key in the `errors` message namespace. */
export type ActionState = { error?: string; done?: boolean } | undefined;

// Server Actions are public endpoints: every one checks the login and validates; the RPCs re-check tenant and role.
async function requireLogin() {
  if (!(await getUserId())) redirect("/login");
}

async function requireManager(): Promise<ActionState> {
  await requireLogin();
  const { profile } = await getSession();
  return profile.role === "staff" ? { error: "not_allowed" } : undefined;
}

export async function sellTicketAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireLogin();
  const parsed = saleSchema.safeParse(formToObject(formData, ["departure", "seat", "phone", "name", "method", "channel", "clientRef"]));
  if (!parsed.success) return { error: parsed.error.issues[0]?.path[0] === "phone" ? "phone" : "form" };
  const result = await dal.sellTicket(parsed.data);
  if (!result.ok) return { error: result.error };
  revalidatePath("/");
  revalidatePath(`/departures/${parsed.data.departure}`);
  redirect(`/departures/${parsed.data.departure}?sold=${parsed.data.seat}`);
}

export async function voidTicketAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await requireManager();
  if (denied) return denied;
  const parsed = voidSchema.safeParse(formToObject(formData, ["ticket", "departure", "reason"]));
  if (!parsed.success) return { error: "form" };
  const result = await dal.voidTicket(parsed.data.ticket, parsed.data.reason);
  if (!result.ok) return { error: result.error };
  revalidatePath("/");
  revalidatePath(`/departures/${parsed.data.departure}`);
  return { done: true };
}

export async function setDepartureStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireLogin();
  const parsed = departureStatusSchema.safeParse(formToObject(formData, ["departure", "status"]));
  if (!parsed.success) return { error: "form" };
  const result = await dal.setDepartureStatus(parsed.data.departure, parsed.data.status);
  if (!result.ok) return { error: result.error };
  revalidatePath("/");
  revalidatePath("/parcels");
  revalidatePath(`/departures/${parsed.data.departure}`);
  return { done: true };
}

export async function scheduleDepartureAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await requireManager();
  if (denied) return denied;
  const parsed = departureSchema.safeParse(formToObject(formData, ["route", "vehicle", "driver", "day", "time", "fare"]));
  if (!parsed.success) return { error: "form" };
  const { route, vehicle, driver, day, time, fare } = parsed.data;
  const result = await dal.scheduleDeparture({
    route, vehicle, driver, departsAt: `${day}T${time}:00+03:00`, fare: fare === "" ? null : fare,
  });
  if (!result.ok) return { error: result.error };
  revalidatePath("/");
  redirect(`/departures/${result.data}`);
}

export async function addRouteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await requireManager();
  if (denied) return denied;
  const parsed = routeSchema.safeParse(formToObject(formData, ["origin", "destination", "fare"]));
  if (!parsed.success) return { error: "form" };
  const result = await dal.addRoute(parsed.data);
  if (!result.ok) return { error: result.error };
  revalidatePath("/setup");
  return { done: true };
}

export async function addVehicleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await requireManager();
  if (denied) return denied;
  const parsed = vehicleSchema.safeParse(formToObject(formData, ["plate", "name", "seats"]));
  if (!parsed.success) return { error: "form" };
  const result = await dal.addVehicle(parsed.data);
  if (!result.ok) return { error: result.error };
  revalidatePath("/setup");
  return { done: true };
}

export async function addDriverAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await requireManager();
  if (denied) return denied;
  const parsed = driverSchema.safeParse(formToObject(formData, ["name", "phone"]));
  if (!parsed.success) return { error: parsed.error.issues[0]?.path[0] === "phone" ? "phone" : "form" };
  const result = await dal.addDriver(parsed.data);
  if (!result.ok) return { error: result.error };
  revalidatePath("/setup");
  return { done: true };
}

export async function registerParcelAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireLogin();
  const parsed = parcelSchema.safeParse(formToObject(formData, ["route", "senderName", "senderPhone", "receiverName", "receiverPhone", "description", "weight", "fee", "method", "clientRef"]));
  if (!parsed.success) return { error: String(parsed.error.issues[0]?.path[0]).endsWith("Phone") ? "phone" : "form" };
  const result = await dal.registerParcel({ ...parsed.data, weight: parsed.data.weight === "" ? null : parsed.data.weight });
  if (!result.ok) return { error: result.error };
  revalidatePath("/parcels");
  return { done: true };
}

export async function setParcelStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireLogin();
  const parsed = parcelStatusSchema.safeParse(formToObject(formData, ["parcel", "status", "departure"]));
  if (!parsed.success) return { error: "form" };
  if (parsed.data.status === "cancelled") {
    const denied = await requireManager();
    if (denied) return denied;
  }
  const result = await dal.setParcelStatus(parsed.data.parcel, parsed.data.status, parsed.data.departure);
  if (!result.ok) return { error: result.error };
  revalidatePath("/parcels");
  return { done: true };
}

export async function recordHandoverAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await requireManager();
  if (denied) return denied;
  const parsed = handoverSchema.safeParse(formToObject(formData, ["day", "kind", "subject", "amount", "note", "clientRef"]));
  if (!parsed.success) return { error: "form" };
  const result = await dal.recordHandover(parsed.data);
  if (!result.ok) return { error: result.error };
  revalidatePath("/cash");
  return { done: true };
}

export async function reverseHandoverAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await requireManager();
  if (denied) return denied;
  const parsed = reverseHandoverSchema.safeParse(formToObject(formData, ["handover", "day"]));
  if (!parsed.success) return { error: "form" };
  const result = await dal.reverseHandover(parsed.data.handover);
  if (!result.ok) return { error: result.error };
  revalidatePath("/cash");
  return { done: true };
}
