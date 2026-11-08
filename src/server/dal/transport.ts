import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { transportErrorKey } from "@/lib/transport-errors";

export type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

// The generated database types cover the core tables; tr_* rows are typed by the DTOs below.
async function db(): Promise<SupabaseClient> {
  return (await createClient()) as unknown as SupabaseClient;
}

function failure(message: string | undefined): Result<never> {
  return { ok: false, error: transportErrorKey(message) };
}

export type RouteDTO = { id: string; origin: string; destination: string; fare: number; active: boolean };
export type VehicleDTO = { id: string; plate: string; name: string | null; seats: number; active: boolean };
export type DriverDTO = { id: string; name: string; phone: string | null; active: boolean };

export type DepartureStatus = "scheduled" | "boarding" | "departed" | "arrived" | "cancelled";
export type DepartureDTO = {
  id: string;
  origin: string;
  destination: string;
  routeId: string;
  vehicle: string;
  vehicleId: string;
  driver: string | null;
  departsAt: string;
  fare: number;
  seats: number;
  sold: number;
  status: DepartureStatus;
};

const DEPARTURE_COLUMNS =
  "id, route_id, vehicle_id, departs_at, fare, seats, status, tr_routes(origin, destination), tr_vehicles(plate, name), tr_drivers(name)";

type DepartureRow = {
  id: string; route_id: string; vehicle_id: string; departs_at: string; fare: number; seats: number; status: DepartureStatus;
  tr_routes: { origin: string; destination: string };
  tr_vehicles: { plate: string; name: string | null };
  tr_drivers: { name: string } | null;
};

function toDeparture(r: DepartureRow, sold: number): DepartureDTO {
  return {
    id: r.id, routeId: r.route_id, vehicleId: r.vehicle_id, origin: r.tr_routes.origin, destination: r.tr_routes.destination,
    vehicle: r.tr_vehicles.name ?? r.tr_vehicles.plate, driver: r.tr_drivers?.name ?? null,
    departsAt: r.departs_at, fare: r.fare, seats: r.seats, sold, status: r.status,
  };
}

/** Departures leaving on a day (Addis time), earliest first, with seats sold. */
export async function listBoard(day: string): Promise<DepartureDTO[]> {
  const supabase = await db();
  const { data } = await supabase.from("tr_departures").select(DEPARTURE_COLUMNS).eq("departs_day", day).order("departs_at");
  const rows = (data ?? []) as unknown as DepartureRow[];
  if (rows.length === 0) return [];
  const { data: tickets } = await supabase.from("tr_tickets").select("departure_id").in("departure_id", rows.map((r) => r.id)).is("voided_at", null);
  const sold = new Map<string, number>();
  for (const t of (tickets ?? []) as { departure_id: string }[]) sold.set(t.departure_id, (sold.get(t.departure_id) ?? 0) + 1);
  return rows.map((r) => toDeparture(r, sold.get(r.id) ?? 0));
}

export type TicketDTO = { id: string; seat: number; phone: string | null; name: string | null; method: string; channel: "office" | "onboard"; fare: number };

export async function getDeparture(id: string): Promise<{ departure: DepartureDTO; tickets: TicketDTO[] } | null> {
  const supabase = await db();
  const { data } = await supabase.from("tr_departures").select(DEPARTURE_COLUMNS).eq("id", id).maybeSingle();
  if (!data) return null;
  const { data: rows } = await supabase
    .from("tr_tickets").select("id, seat, passenger_phone, passenger_name, method, channel, fare")
    .eq("departure_id", id).is("voided_at", null).order("seat");
  const tickets = ((rows ?? []) as { id: string; seat: number; passenger_phone: string | null; passenger_name: string | null; method: string; channel: "office" | "onboard"; fare: number }[]).map((t) => ({
    id: t.id, seat: t.seat, phone: t.passenger_phone, name: t.passenger_name, method: t.method, channel: t.channel, fare: t.fare,
  }));
  return { departure: toDeparture(data as unknown as DepartureRow, tickets.length), tickets };
}

export async function sellTicket(input: {
  departure: string; seat: number; phone: string; name: string; method: string; channel: string; clientRef: string;
}): Promise<Result<string>> {
  const supabase = await db();
  const { data, error } = await supabase.rpc("tr_sell_ticket", {
    p_departure: input.departure, p_seat: input.seat, p_phone: input.phone || null, p_name: input.name || null,
    p_method: input.method, p_channel: input.channel, p_client_ref: input.clientRef || null,
  });
  return error ? failure(error.message) : { ok: true, data: data as string };
}

export async function voidTicket(ticket: string, reason: string): Promise<Result> {
  const supabase = await db();
  const { error } = await supabase.rpc("tr_void_ticket", { p_ticket: ticket, p_reason: reason });
  return error ? failure(error.message) : { ok: true, data: undefined };
}

export async function setDepartureStatus(departure: string, status: string): Promise<Result> {
  const supabase = await db();
  const { error } = await supabase.rpc("tr_set_departure_status", { p_departure: departure, p_status: status });
  return error ? failure(error.message) : { ok: true, data: undefined };
}

export async function scheduleDeparture(input: { route: string; vehicle: string; driver: string; departsAt: string; fare: number | null }): Promise<Result<string>> {
  const supabase = await db();
  const { data, error } = await supabase.rpc("tr_schedule_departure", {
    p_route: input.route, p_vehicle: input.vehicle, p_departs_at: input.departsAt, p_driver: input.driver || null, p_fare: input.fare,
  });
  return error ? failure(error.message) : { ok: true, data: data as string };
}

export async function listSetup(): Promise<{ routes: RouteDTO[]; vehicles: VehicleDTO[]; drivers: DriverDTO[] }> {
  const supabase = await db();
  const [routes, vehicles, drivers] = await Promise.all([
    supabase.from("tr_routes").select("id, origin, destination, fare, active").order("origin").order("destination"),
    supabase.from("tr_vehicles").select("id, plate, name, seats, active").order("plate"),
    supabase.from("tr_drivers").select("id, name, phone, active").order("name"),
  ]);
  return {
    routes: (routes.data ?? []) as RouteDTO[],
    vehicles: (vehicles.data ?? []) as VehicleDTO[],
    drivers: (drivers.data ?? []) as DriverDTO[],
  };
}

function insertFailure(error: { code?: string; message?: string }, duplicate: string): Result<never> {
  if (error.code === "23505") return { ok: false, error: duplicate };
  if (error.code === "42501") return { ok: false, error: "not_allowed" };
  return failure(error.message);
}

export async function addRoute(input: { origin: string; destination: string; fare: number }): Promise<Result> {
  const supabase = await db();
  const { error } = await supabase.from("tr_routes").insert(input);
  return error ? insertFailure(error, "route_exists") : { ok: true, data: undefined };
}

export async function addVehicle(input: { plate: string; name: string; seats: number }): Promise<Result> {
  const supabase = await db();
  const { error } = await supabase.from("tr_vehicles").insert({ plate: input.plate, name: input.name || null, seats: input.seats });
  return error ? insertFailure(error, "plate_taken") : { ok: true, data: undefined };
}

export async function addDriver(input: { name: string; phone: string }): Promise<Result> {
  const supabase = await db();
  const { error } = await supabase.from("tr_drivers").insert({ name: input.name, phone: input.phone || null });
  return error ? insertFailure(error, "driver_exists") : { ok: true, data: undefined };
}

export type ParcelStatus = "received" | "loaded" | "arrived" | "collected" | "cancelled";
export type ParcelDTO = {
  id: string; waybillNo: number; routeId: string; origin: string; destination: string; senderName: string; receiverName: string;
  receiverPhone: string; description: string; fee: number; status: ParcelStatus; soldAt: string;
};

export async function listParcels(query: string): Promise<ParcelDTO[]> {
  const supabase = await db();
  let builder = supabase
    .from("tr_parcels")
    .select("id, waybill_no, route_id, sender_name, receiver_name, receiver_phone, description, fee, status, sold_at, tr_routes(origin, destination)")
    .order("waybill_no", { ascending: false })
    .limit(60);
  if (query) {
    const waybill = /^\d{1,8}$/.test(query) ? Number(query) : null;
    const digits = query.replace(/[^0-9+]/g, "");
    builder = waybill !== null && query.length < 7
      ? builder.eq("waybill_no", waybill)
      : builder.ilike("receiver_phone", `%${digits}%`);
  }
  const { data } = await builder;
  type Row = { id: string; waybill_no: number; route_id: string; sender_name: string; receiver_name: string; receiver_phone: string; description: string; fee: number; status: ParcelStatus; sold_at: string; tr_routes: { origin: string; destination: string } };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id, waybillNo: r.waybill_no, routeId: r.route_id, origin: r.tr_routes.origin, destination: r.tr_routes.destination,
    senderName: r.sender_name, receiverName: r.receiver_name, receiverPhone: r.receiver_phone, description: r.description,
    fee: r.fee, status: r.status, soldAt: r.sold_at,
  }));
}

export async function registerParcel(input: {
  route: string; senderName: string; senderPhone: string; receiverName: string; receiverPhone: string;
  description: string; weight: number | null; fee: number; method: string; clientRef: string;
}): Promise<Result<string>> {
  const supabase = await db();
  const { data, error } = await supabase.rpc("tr_register_parcel", {
    p_route: input.route, p_sender_name: input.senderName, p_sender_phone: input.senderPhone || null,
    p_receiver_name: input.receiverName, p_receiver_phone: input.receiverPhone, p_description: input.description,
    p_weight: input.weight, p_fee: input.fee, p_method: input.method, p_client_ref: input.clientRef || null,
  });
  return error ? failure(error.message) : { ok: true, data: data as string };
}

export async function setParcelStatus(parcel: string, status: string, departure: string): Promise<Result> {
  const supabase = await db();
  const { error } = await supabase.rpc("tr_set_parcel_status", { p_parcel: parcel, p_status: status, p_departure: departure || null });
  return error ? failure(error.message) : { ok: true, data: undefined };
}

export type ReconcileRow = {
  kind: "seller" | "vehicle"; sellerId: string | null; vehicleId: string | null; label: string;
  tickets: number; parcels: number; sold: number; expected: number; handed: number; short: number;
};

export async function reconcile(day: string): Promise<ReconcileRow[]> {
  const supabase = await db();
  const { data } = await supabase.rpc("tr_reconcile", { p_day: day });
  type Row = { kind: "seller" | "vehicle"; seller_id: string | null; vehicle_id: string | null; label: string; tickets: number; parcels: number; sold: number; expected: number; handed: number; short: number };
  return ((data ?? []) as Row[]).map((r) => ({
    kind: r.kind, sellerId: r.seller_id, vehicleId: r.vehicle_id, label: r.label, tickets: Number(r.tickets), parcels: Number(r.parcels),
    sold: Number(r.sold), expected: Number(r.expected), handed: Number(r.handed), short: Number(r.short),
  }));
}

export type HandoverDTO = { id: string; kind: "seller" | "vehicle"; amount: number; expected: number; note: string | null; createdAt: string; reversed: boolean; who: string };

export async function listHandovers(day: string): Promise<HandoverDTO[]> {
  const supabase = await db();
  const { data } = await supabase
    .from("tr_cash_handovers")
    .select("id, kind, amount, expected, note, created_at, reversed_at, seller_id, tr_vehicles(plate, name)")
    .eq("day", day)
    .order("created_at", { ascending: false });
  type Row = { id: string; kind: "seller" | "vehicle"; amount: number; expected: number; note: string | null; created_at: string; reversed_at: string | null; seller_id: string | null; tr_vehicles: { plate: string; name: string | null } | null };
  const rows = (data ?? []) as unknown as Row[];
  const ids = [...new Set(rows.flatMap((r) => (r.seller_id ? [r.seller_id] : [])))];
  const { data: people } = ids.length ? await supabase.from("profiles").select("user_id, full_name").in("user_id", ids) : { data: [] };
  const names = new Map(((people ?? []) as { user_id: string; full_name: string }[]).map((p) => [p.user_id, p.full_name]));
  return rows.map((r) => ({
    id: r.id, kind: r.kind, amount: r.amount, expected: r.expected, note: r.note, createdAt: r.created_at, reversed: r.reversed_at !== null,
    who: r.seller_id ? (names.get(r.seller_id) ?? "") : (r.tr_vehicles?.name ?? r.tr_vehicles?.plate ?? ""),
  }));
}

export async function recordHandover(input: { day: string; kind: string; subject: string; amount: number; note: string; clientRef: string }): Promise<Result<string>> {
  const supabase = await db();
  const { data, error } = await supabase.rpc("tr_record_handover", {
    p_day: input.day, p_kind: input.kind, p_amount: input.amount,
    p_seller: input.kind === "seller" ? input.subject : null,
    p_vehicle: input.kind === "vehicle" ? input.subject : null,
    p_note: input.note || null, p_client_ref: input.clientRef || null,
  });
  return error ? failure(error.message) : { ok: true, data: data as string };
}

export async function reverseHandover(handover: string): Promise<Result> {
  const supabase = await db();
  const { error } = await supabase.rpc("tr_reverse_handover", { p_handover: handover });
  return error ? failure(error.message) : { ok: true, data: undefined };
}

export type RouteReportRow = { routeId: string; origin: string; destination: string; departures: number; seats: number; tickets: number; ticketTotal: number; parcels: number; parcelTotal: number };

export async function routeReport(day: string): Promise<RouteReportRow[]> {
  const supabase = await db();
  const { data } = await supabase.rpc("tr_route_report", { p_day: day });
  type Row = { route_id: string; origin: string; destination: string; departures: number; seats: number; tickets: number; ticket_total: number; parcels: number; parcel_total: number };
  return ((data ?? []) as Row[]).map((r) => ({
    routeId: r.route_id, origin: r.origin, destination: r.destination, departures: Number(r.departures), seats: Number(r.seats),
    tickets: Number(r.tickets), ticketTotal: Number(r.ticket_total), parcels: Number(r.parcels), parcelTotal: Number(r.parcel_total),
  }));
}
