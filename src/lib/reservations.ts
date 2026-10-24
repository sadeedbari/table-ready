import "server-only";
import { bg } from "@/lib/background";
import { createAdminClient } from "@/lib/supabase/admin";
import { addDaysToKey, dayKey, startOfDayInZone, todayKey } from "@/lib/format";
import { availableSlots, toMinutes } from "@/lib/hours";
import { sendCancellation, sendConfirmation, sendWaitlistOpening } from "@/lib/emails";
import { notifyStaff, reservationMessage } from "@/lib/notify-staff";
import type { Closure, DiningTable, Reservation, Restaurant, ServicePeriod, WaitlistEntry } from "@/lib/types";

export interface RestaurantData {
  restaurant: Restaurant;
  tables: DiningTable[];
  periods: ServicePeriod[];
  closures: Closure[];
}

/** Everything the public page needs about a restaurant (guests cannot read these tables directly; the server reads for them). */
export async function loadRestaurantData(slug: string): Promise<RestaurantData | null> {
  const db = createAdminClient();
  const { data: restaurant } = await db.from("restaurants").select("*").eq("slug", slug).maybeSingle();
  if (!restaurant) return null;
  const [tables, periods, closures] = await Promise.all([
    db.from("dining_tables").select("*").eq("restaurant_id", restaurant.id).order("position").order("name"),
    db.from("service_periods").select("*").eq("restaurant_id", restaurant.id).order("opens"),
    db.from("closures").select("*").eq("restaurant_id", restaurant.id).gte("on_date", todayKey(restaurant.timezone)),
  ]);
  return {
    restaurant: restaurant as Restaurant,
    tables: (tables.data ?? []) as DiningTable[],
    periods: (periods.data ?? []) as ServicePeriod[],
    closures: (closures.data ?? []) as Closure[],
  };
}

/** Reservations that hold a table during a local day (a little wider than the day, so a late stay is not missed). */
export async function loadHeldReservations(r: Pick<Restaurant, "id" | "timezone">, dateKey: string) {
  const from = startOfDayInZone(dateKey, r.timezone);
  const to = startOfDayInZone(addDaysToKey(dateKey, 1), r.timezone);
  const { data } = await createAdminClient()
    .from("reservations")
    .select("table_id, starts_at, ends_at, status")
    .eq("restaurant_id", r.id)
    .in("status", ["confirmed", "seated"])
    .lt("starts_at", new Date(to.getTime() + 6 * 3600_000).toISOString())
    .gt("ends_at", new Date(from.getTime()).toISOString());
  return (data ?? []) as Pick<Reservation, "table_id" | "starts_at" | "ends_at" | "status">[];
}

export async function slotsFor(data: RestaurantData, dateKey: string, party: number) {
  const reservations = await loadHeldReservations(data.restaurant, dateKey);
  return availableSlots({ restaurant: data.restaurant, periods: data.periods, tables: data.tables, closures: data.closures, reservations, dateKey, party });
}

const BOOK_ERRORS: Record<string, string> = {
  online_closed: "This restaurant is not taking online reservations right now.",
  party_too_large: "That is more guests than we can book online. Please call the restaurant.",
  too_soon: "That time is too soon to book online. Please pick a later time or call the restaurant.",
  too_far: "That is further ahead than we take reservations.",
  closed_that_day: "The restaurant is closed that day.",
  outside_hours: "That time is outside opening hours.",
  no_table: "Sorry, that time was just taken. Please pick another time.",
  unknown_restaurant: "We could not find that restaurant.",
  bad_party: "Please choose how many guests.",
};

export type BookResult = { ok: true; token: string; reservationId: string } | { ok: false; error: string };

/** Books a table through the database function (which re-checks hours and double-booking), then sends the confirmation. */
export async function bookTable(
  r: Restaurant,
  input: { name: string; email?: string; phone?: string; party: number; startsAt: string; notes?: string; source: "online" | "host"; tableId?: string | null },
): Promise<BookResult> {
  const { data, error } = await createAdminClient().rpc("book_table", {
    p_restaurant: r.id,
    p_name: input.name,
    p_email: input.email ?? "",
    p_phone: input.phone ?? "",
    p_party: input.party,
    p_starts: input.startsAt,
    p_notes: input.notes ?? "",
    p_source: input.source,
    p_table: input.tableId ?? undefined,
  });
  if (error) {
    const key = Object.keys(BOOK_ERRORS).find((k) => error.message.includes(k));
    if (!key) console.error("[book_table]", error.message);
    return { ok: false, error: key ? BOOK_ERRORS[key] : "Something went wrong booking that table. Please try again." };
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { ok: false, error: "Something went wrong booking that table. Please try again." };
  bg(sendConfirmation(r, { guest_name: input.name, email: input.email ?? null, party_size: input.party, starts_at: input.startsAt, token: row.token }));
  // The team is told about guests who book themselves; staff who add a booking already know about it.
  if (input.source === "online") {
    bg(notifyStaff(r, reservationMessage(r, { id: row.reservation_id, guest_name: input.name, party_size: input.party, starts_at: input.startsAt, notes: input.notes ?? null }, row.table_name)));
  }
  return { ok: true, token: row.token as string, reservationId: row.reservation_id as string };
}

/** Cancels a reservation, tells the guest, and lets people on the waitlist know a table may have opened up. */
export async function cancelReservation(r: Restaurant, reservation: Reservation, opts: { notifyGuest?: boolean } = {}) {
  const db = createAdminClient();
  const { error } = await db.from("reservations").update({ status: "cancelled" }).eq("id", reservation.id).in("status", ["confirmed"]);
  if (error) return false;
  if (opts.notifyGuest !== false) bg(sendCancellation(r, reservation));
  await flushWaitlist(r);
  return true;
}

/**
 * Looks at everyone waiting and emails those whose date and time window now has an open table. They are asked to book
 * (the table is not held for them), and marked as notified so they are only told once.
 */
export async function flushWaitlist(r: Restaurant) {
  const db = createAdminClient();
  const today = todayKey(r.timezone);
  const { data: waiting } = await db.from("waitlist").select("*").eq("restaurant_id", r.id).eq("status", "waiting").gte("wanted_date", today).order("created_at");
  if (!waiting?.length) return 0;
  const data = await loadRestaurantData(r.slug);
  if (!data) return 0;
  let sent = 0;
  for (const w of waiting as WaitlistEntry[]) {
    const slots = await slotsFor(data, w.wanted_date, w.party_size);
    const hit = slots.some((s) => s.minutes >= toMinutes(w.from_time) && s.minutes <= toMinutes(w.to_time));
    if (!hit) continue;
    const { error } = await db.from("waitlist").update({ status: "notified", notified_at: new Date().toISOString() }).eq("id", w.id).eq("status", "waiting");
    if (error) continue;
    await sendWaitlistOpening(r, w);
    sent++;
  }
  return sent;
}

/** Expires waitlist entries whose date has passed. */
export async function expireWaitlist(r: Pick<Restaurant, "id" | "timezone">) {
  await createAdminClient().from("waitlist").update({ status: "expired" }).eq("restaurant_id", r.id).in("status", ["waiting", "notified"]).lt("wanted_date", todayKey(r.timezone));
}

export { dayKey };
