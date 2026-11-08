const KNOWN = [
  "route_not_found", "vehicle_not_found", "driver_not_found", "bad_time", "bad_amount", "vehicle_busy",
  "bad_channel", "bad_phone", "departure_not_found", "departure_closed", "bad_seat", "seat_taken",
  "reason_required", "ticket_not_found", "already_voided", "bad_status", "departure_has_tickets",
  "name_required", "description_required", "bad_weight", "parcel_not_found", "wrong_route",
  "bad_kind", "bad_day", "seller_not_found", "handover_not_found", "already_reversed", "not_allowed",
] as const;

export type TransportErrorKey = (typeof KNOWN)[number] | "route_exists" | "plate_taken" | "driver_exists" | "generic";

/** Turns a database error message into a translation key; anything unknown stays generic. */
export function transportErrorKey(message: string | undefined): TransportErrorKey {
  return KNOWN.find((code) => message?.includes(code)) ?? "generic";
}
