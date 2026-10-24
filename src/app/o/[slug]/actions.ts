"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRestaurantContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError } from "@/lib/db-errors";
import { instantAt, toMinutes } from "@/lib/hours";
import { bookTable, cancelReservation, flushWaitlist } from "@/lib/reservations";
import { normalizePhone } from "@/lib/phone";
import { friendlyZodMessage as zodMessage } from "@/lib/zod-message";
import type { ActionResult } from "@/components/ui/action-form";
import type { Reservation, ReservationStatus } from "@/lib/types";

const refresh = (slug: string) => revalidatePath(`/o/${slug}`, "layout");
const NOT_ALLOWED: ActionResult = { error: "Only an owner or admin can change this." };

// ─────────────── Reservations (any team member) ───────────────

const addSchema = z.object({
  name: z.string().trim().min(1, "Enter the guest's name.").max(120),
  party: z.coerce.number().int().min(1, "Enter how many guests.").max(50),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date."),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Choose a time."),
  email: z.union([z.literal(""), z.email("That email does not look right.")]),
  phone: z.string().trim().max(40),
  notes: z.string().trim().max(500),
  table: z.string(),
});

export async function addReservation(slug: string, fd: FormData): Promise<ActionResult> {
  const { restaurant } = await getRestaurantContext(slug);
  const parsed = addSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: zodMessage(parsed.error) };
  const v = parsed.data;
  const result = await bookTable(restaurant, {
    name: v.name,
    party: v.party,
    email: v.email,
    phone: v.phone ? (normalizePhone(v.phone, "CAD") ?? v.phone) : "",
    notes: v.notes,
    startsAt: instantAt(v.date, toMinutes(v.time), restaurant.timezone).toISOString(),
    source: "host",
    tableId: v.table || null,
  });
  if (!result.ok) return { error: result.error };
  refresh(slug);
  return { message: "Reservation added" };
}

const STATUSES: ReservationStatus[] = ["confirmed", "seated", "completed", "no_show", "cancelled"];

export async function setReservationStatus(slug: string, id: string, status: ReservationStatus): Promise<ActionResult> {
  const { restaurant } = await getRestaurantContext(slug);
  if (!STATUSES.includes(status)) return { error: "Unknown status." };
  const supabase = await createClient();
  const { data: reservation } = await supabase.from("reservations").select("*").eq("id", id).eq("restaurant_id", restaurant.id).maybeSingle();
  if (!reservation) return { error: "That reservation no longer exists." };
  if (status === "cancelled") {
    const ok = await cancelReservation(restaurant, reservation as Reservation);
    if (!ok) return { error: "Only a confirmed reservation can be cancelled." };
  } else {
    const { error } = await supabase.from("reservations").update({ status }).eq("id", id);
    if (error) return { error: friendlyDbError(error) };
    // Reopening a cancelled or no-show reservation could collide with a newer booking at the same table: the database says no.
  }
  refresh(slug);
}

// ─────────────── Tables, hours, rules (owner or admin) ───────────────

const tableSchema = z.object({
  name: z.string().trim().min(1, "Give the table a name.").max(30),
  seats: z.coerce.number().int().min(1, "A table needs at least 1 seat.").max(50),
});

export async function saveTable(slug: string, id: string | null, fd: FormData): Promise<ActionResult> {
  const { restaurant, isAdmin } = await getRestaurantContext(slug);
  if (!isAdmin) return NOT_ALLOWED;
  const parsed = tableSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: zodMessage(parsed.error) };
  const row = { ...parsed.data, online: fd.get("online") === "on", active: id ? fd.get("active") === "on" : true };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("dining_tables").update(row).eq("id", id).eq("restaurant_id", restaurant.id)
    : await supabase.from("dining_tables").insert({ ...row, restaurant_id: restaurant.id, position: 99 });
  if (error) return { error: error.code === "23505" ? "You already have a table with that name." : friendlyDbError(error) };
  refresh(slug);
  return { message: id ? "Table saved" : "Table added" };
}

export async function deleteTable(slug: string, id: string): Promise<ActionResult> {
  const { restaurant, isAdmin } = await getRestaurantContext(slug);
  if (!isAdmin) return NOT_ALLOWED;
  const supabase = await createClient();
  const { error } = await supabase.from("dining_tables").delete().eq("id", id).eq("restaurant_id", restaurant.id);
  if (error) return { error: friendlyDbError(error) };
  refresh(slug);
  return { message: "Table removed" };
}

const periodSchema = z.object({
  name: z.string().trim().min(1, "Name the service, for example Dinner.").max(40),
  opens: z.string().regex(/^\d{2}:\d{2}$/, "Choose an opening time."),
  last_seating: z.string().regex(/^\d{2}:\d{2}$/, "Choose a last seating time."),
});

export async function savePeriod(slug: string, id: string | null, fd: FormData): Promise<ActionResult> {
  const { restaurant, isAdmin } = await getRestaurantContext(slug);
  if (!isAdmin) return NOT_ALLOWED;
  const parsed = periodSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: zodMessage(parsed.error) };
  const days = fd.getAll("days").map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  if (days.length === 0) return { error: "Choose at least one day." };
  if (toMinutes(parsed.data.last_seating) < toMinutes(parsed.data.opens)) return { error: "The last seating cannot be before opening." };
  const row = { ...parsed.data, days, active: id ? fd.get("active") === "on" : true };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("service_periods").update(row).eq("id", id).eq("restaurant_id", restaurant.id)
    : await supabase.from("service_periods").insert({ ...row, restaurant_id: restaurant.id });
  if (error) return { error: friendlyDbError(error) };
  refresh(slug);
  return { message: id ? "Hours saved" : "Service added" };
}

export async function deletePeriod(slug: string, id: string): Promise<ActionResult> {
  const { restaurant, isAdmin } = await getRestaurantContext(slug);
  if (!isAdmin) return NOT_ALLOWED;
  const supabase = await createClient();
  const { error } = await supabase.from("service_periods").delete().eq("id", id).eq("restaurant_id", restaurant.id);
  if (error) return { error: friendlyDbError(error) };
  refresh(slug);
  return { message: "Service removed" };
}

export async function addClosure(slug: string, fd: FormData): Promise<ActionResult> {
  const { restaurant, isAdmin } = await getRestaurantContext(slug);
  if (!isAdmin) return NOT_ALLOWED;
  const date = String(fd.get("on_date") || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Choose the date you are closed." };
  const supabase = await createClient();
  const { error } = await supabase.from("closures").insert({ restaurant_id: restaurant.id, on_date: date, note: String(fd.get("note") || "").trim() || null });
  if (error) return { error: error.code === "23505" ? "That day is already marked closed." : friendlyDbError(error) };
  refresh(slug);
  return { message: "Day marked closed" };
}

export async function deleteClosure(slug: string, id: string): Promise<ActionResult> {
  const { restaurant, isAdmin } = await getRestaurantContext(slug);
  if (!isAdmin) return NOT_ALLOWED;
  const supabase = await createClient();
  const { error } = await supabase.from("closures").delete().eq("id", id).eq("restaurant_id", restaurant.id);
  if (error) return { error: friendlyDbError(error) };
  refresh(slug);
}

const rulesSchema = z.object({
  slot_interval_minutes: z.coerce.number().refine((n) => [10, 15, 20, 30, 60].includes(n), "Choose a time step."),
  min_notice_minutes: z.coerce.number().int().min(0).max(60 * 24 * 14),
  max_advance_days: z.coerce.number().int().min(1, "Allow at least 1 day ahead.").max(365),
  max_party_size: z.coerce.number().int().min(1).max(50),
  cancellation_window_hours: z.coerce.number().int().min(0).max(168),
  t2: z.coerce.number().int().min(15).max(480),
  t4: z.coerce.number().int().min(15).max(480),
  t6: z.coerce.number().int().min(15).max(480),
  t99: z.coerce.number().int().min(15).max(480),
});

export async function saveRules(slug: string, fd: FormData): Promise<ActionResult> {
  const { restaurant, isAdmin } = await getRestaurantContext(slug);
  if (!isAdmin) return NOT_ALLOWED;
  const parsed = rulesSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: zodMessage(parsed.error) };
  const { t2, t4, t6, t99, ...rest } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("restaurants").update({
    ...rest,
    online_enabled: fd.get("online_enabled") === "on",
    turn_times: [{ upTo: 2, minutes: t2 }, { upTo: 4, minutes: t4 }, { upTo: 6, minutes: t6 }, { upTo: 99, minutes: t99 }],
  }).eq("id", restaurant.id);
  if (error) return { error: friendlyDbError(error) };
  refresh(slug);
  return { message: "Booking rules saved" };
}

const profileSchema = z.object({
  name: z.string().trim().min(1, "Enter your restaurant's name.").max(80),
  description: z.string().trim().max(500),
  phone: z.string().trim().max(40),
  address: z.string().trim().max(200),
  website: z.string().trim().max(200),
  timezone: z.string().min(1),
});

export async function saveProfile(slug: string, fd: FormData): Promise<ActionResult> {
  const { restaurant, isAdmin } = await getRestaurantContext(slug);
  if (!isAdmin) return NOT_ALLOWED;
  const parsed = profileSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: zodMessage(parsed.error) };
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("restaurants").update({
    name: v.name, description: v.description || null, phone: v.phone || null, address: v.address || null, website: v.website || null, timezone: v.timezone,
  }).eq("id", restaurant.id);
  if (error) return { error: friendlyDbError(error) };
  refresh(slug);
  return { message: "Saved" };
}

// ─────────────── Waitlist ───────────────

export async function removeWaitlistEntry(slug: string, id: string): Promise<ActionResult> {
  const { restaurant } = await getRestaurantContext(slug);
  const supabase = await createClient();
  const { error } = await supabase.from("waitlist").update({ status: "cancelled" }).eq("id", id).eq("restaurant_id", restaurant.id);
  if (error) return { error: friendlyDbError(error) };
  refresh(slug);
}

export async function checkWaitlist(slug: string): Promise<ActionResult> {
  const { restaurant } = await getRestaurantContext(slug);
  const n = await flushWaitlist(restaurant);
  refresh(slug);
  return { message: n ? `${n} ${n === 1 ? "guest was" : "guests were"} told a table is open` : "No open tables match anyone waiting right now" };
}
