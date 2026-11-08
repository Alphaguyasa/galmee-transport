import { z } from "zod";

export const MIN_PASSWORD = 10;

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().max(128),
});

export const signupSchema = credentialsSchema.extend({
  password: z.string().min(MIN_PASSWORD).max(128),
});

// Ethiopian mobile/landline: 09xxxxxxxx, 07xxxxxxxx or +2519xxxxxxxx; spaces and dashes allowed.
export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .pipe(z.string().regex(/^(\+251|0)[1-9]\d{8}$/));

export const onboardingSchema = z.object({
  companyName: z.string().trim().min(2).max(120),
  fullName: z.string().trim().min(2).max(120),
  phone: phoneSchema,
});

export function formToObject(formData: FormData, keys: readonly string[]) {
  return Object.fromEntries(keys.map((k) => [k, formData.get(k) ?? ""]));
}

const uuid = z.string().uuid();
const money = z.coerce.number().positive().max(1_000_000);
const optional = (max: number) => z.string().trim().max(max).optional().default("");
const optionalPhone = z.union([z.literal(""), phoneSchema]);
export const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const METHODS = ["cash", "telebirr", "cbe_birr", "bank"] as const;
const clientRef = z.union([z.literal(""), uuid]).optional().default("");

export const routeSchema = z.object({
  origin: z.string().trim().min(2).max(80),
  destination: z.string().trim().min(2).max(80),
  fare: money,
});
export const vehicleSchema = z.object({
  plate: z.string().trim().min(2).max(20),
  name: optional(60),
  seats: z.coerce.number().int().min(4).max(80),
});
export const driverSchema = z.object({ name: z.string().trim().min(2).max(120), phone: optionalPhone });
export const departureSchema = z.object({
  route: uuid,
  vehicle: uuid,
  driver: z.union([z.literal(""), uuid]),
  day: daySchema,
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  fare: z.union([z.literal(""), money]),
});
export const saleSchema = z.object({
  departure: uuid,
  seat: z.coerce.number().int().min(1).max(80),
  phone: optionalPhone,
  name: optional(120),
  method: z.enum(METHODS),
  channel: z.enum(["office", "onboard"]),
  clientRef,
});
export const voidSchema = z.object({ ticket: uuid, departure: uuid, reason: z.string().trim().min(2).max(300) });
export const departureStatusSchema = z.object({ departure: uuid, status: z.enum(["boarding", "departed", "arrived", "cancelled"]) });
export const parcelSchema = z.object({
  route: uuid,
  senderName: z.string().trim().min(2).max(120),
  senderPhone: optionalPhone,
  receiverName: z.string().trim().min(2).max(120),
  receiverPhone: phoneSchema,
  description: z.string().trim().min(2).max(300),
  weight: z.union([z.literal(""), z.coerce.number().positive().max(100_000)]),
  fee: z.coerce.number().min(0).max(1_000_000),
  method: z.enum(METHODS),
  clientRef,
});
export const parcelStatusSchema = z.object({
  parcel: uuid,
  status: z.enum(["loaded", "arrived", "collected", "cancelled"]),
  departure: z.union([z.literal(""), uuid]).optional().default(""),
});
export const handoverSchema = z.object({
  day: daySchema,
  kind: z.enum(["seller", "vehicle"]),
  subject: uuid,
  amount: money,
  note: optional(300),
  clientRef,
});
export const reverseHandoverSchema = z.object({ handover: uuid, day: daySchema });
