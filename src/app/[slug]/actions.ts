"use server";
import { z } from "zod";
import { bg } from "@/lib/background";
import { createAdminClient } from "@/lib/supabase/admin";
import { addDaysToKey, todayKey } from "@/lib/format";
import { toMinutes } from "@/lib/hours";
import { normalizePhone } from "@/lib/phone";
import { bookTable, cancelReservation, loadRestaurantData } from "@/lib/reservations";
import { cancellationMessage, notifyStaff } from "@/lib/notify-staff";
import { friendlyZodMessage } from "@/lib/zod-message";
import type { ActionResult } from "@/components/ui/action-form";
import type { Reservation } from "@/lib/types";

const reserveSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name.").max(120),
  email: z.email("Please enter a valid email so we can confirm your reservation.").max(200),
  phone: z.string().trim().max(40),
  notes: z.string().trim().max(500),
  party: z.coerce.number().int().min(1).max(50),
  startsAt: z.iso.datetime({ offset: true, message: "Please pick a time." }),
  marketing: z.string().optional(),
  website: z.string().max(0).optional(), // honeypot: real people never fill this in
});

export async function reserve(slug: string, fd: FormData): Promise<ActionResult> {
  const parsed = reserveSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: friendlyZodMessage(parsed.error) };
  const data = await loadRestaurantData(slug);
  if (!data) return { error: "We could not find that restaurant." };
  const v = parsed.data;
  const result = await bookTable(data.restaurant, {
    name: v.name,
    email: v.email,
    phone: v.phone ? (normalizePhone(v.phone, "CAD") ?? v.phone) : "",
    notes: v.notes,
    party: v.party,
    startsAt: v.startsAt,
    source: "online",
    marketing: v.marketing === "on",
  });
  if (!result.ok) return { error: result.error };
  return { redirect: `/reservation/${result.token}` };
}

const waitSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name.").max(120),
  email: z.email("Please enter a valid email so we can tell you when a table opens.").max(200),
  phone: z.string().trim().max(40),
  party: z.coerce.number().int().min(1).max(50),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  from: z.string().regex(/^\d{2}:\d{2}$/, "Choose the earliest time you would take."),
  to: z.string().regex(/^\d{2}:\d{2}$/, "Choose the latest time you would take."),
  marketing: z.string().optional(),
  website: z.string().max(0).optional(),
});

export async function joinWaitlist(slug: string, fd: FormData): Promise<ActionResult> {
  const parsed = waitSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: friendlyZodMessage(parsed.error) };
  const v = parsed.data;
  const data = await loadRestaurantData(slug);
  if (!data) return { error: "We could not find that restaurant." };
  const r = data.restaurant;
  const today = todayKey(r.timezone);
  if (!r.online_enabled) return { error: "This restaurant is not taking online reservations right now." };
  if (v.party > r.max_party_size) return { error: "That is more guests than we can book online. Please call the restaurant." };
  if (v.date < today || v.date > addDaysToKey(today, r.max_advance_days)) return { error: "Please pick a date within the booking range." };
  if (toMinutes(v.to) < toMinutes(v.from)) return { error: "The latest time cannot be before the earliest." };

  const db = createAdminClient();
  const { count } = await db.from("waitlist").select("id", { count: "exact", head: true })
    .eq("restaurant_id", r.id).eq("status", "waiting").eq("email", v.email.toLowerCase()).eq("wanted_date", v.date);
  if ((count ?? 0) > 0) return { error: "You are already on the waitlist for that day. We will email you if a table opens." };
  const { error } = await db.from("waitlist").insert({
    restaurant_id: r.id, guest_name: v.name, email: v.email.toLowerCase(), phone: v.phone ? (normalizePhone(v.phone, "CAD") ?? v.phone) : null,
    party_size: v.party, wanted_date: v.date, from_time: v.from, to_time: v.to, marketing_opt_in: v.marketing === "on",
  });
  if (error) {
    console.error("[waitlist]", error.message);
    return { error: "Something went wrong. Please try again." };
  }
  bg(notifyStaff(r, {
    title: "New waitlist request",
    body: `${v.name} · ${v.party} ${v.party === 1 ? "guest" : "guests"} · ${v.date} · ${v.from} to ${v.to}`,
    path: "/waitlist",
    tag: `waitlist-${v.email}-${v.date}`,
  }));
  return { redirect: `/${slug}?waitlisted=1` };
}

export async function cancelByToken(token: string): Promise<ActionResult> {
  const db = createAdminClient();
  const { data: reservation } = await db.from("reservations").select("*").eq("token", token).maybeSingle();
  if (!reservation) return { error: "We could not find that reservation." };
  const { data: r } = await db.from("restaurants").select("*").eq("id", reservation.restaurant_id).single();
  if (!r) return { error: "We could not find that restaurant." };
  if (reservation.status !== "confirmed") return { error: "This reservation can no longer be cancelled online." };
  const cutoff = new Date(reservation.starts_at).getTime() - r.cancellation_window_hours * 3600_000;
  if (Date.now() > cutoff) return { error: `It is too late to cancel online${r.phone ? `. Please call ${r.phone}` : ""}.` };
  const ok = await cancelReservation(r, reservation as Reservation);
  if (!ok) return { error: "Something went wrong. Please try again." };
  bg(notifyStaff(r, cancellationMessage(r, reservation as Reservation)));
  return { redirect: `/reservation/${token}` };
}

const signupSchema = z.object({
  name: z.string().trim().max(120),
  email: z.email("Please enter a valid email address.").max(200),
  website: z.string().max(0).optional(),
});

/** "Get offers and news": a guest gives their email and agrees to hear from the restaurant. Saying it twice changes nothing. */
export async function signUpForUpdates(slug: string, fd: FormData): Promise<ActionResult> {
  const parsed = signupSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: friendlyZodMessage(parsed.error) };
  const data = await loadRestaurantData(slug);
  if (!data) return { error: "We could not find that restaurant." };
  const db = createAdminClient();
  const email = parsed.data.email.toLowerCase();
  const { data: existing } = await db.from("guest_signups").select("id").eq("restaurant_id", data.restaurant.id).ilike("email", email).maybeSingle();
  if (!existing) {
    const { error } = await db.from("guest_signups").insert({ restaurant_id: data.restaurant.id, guest_name: parsed.data.name, email, marketing_opt_in: true });
    if (error && error.code !== "23505") {
      console.error("[signup]", error.message);
      return { error: "Something went wrong. Please try again." };
    }
  }
  return { redirect: `/${slug}?subscribed=1` };
}
