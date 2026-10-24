"use server";
import { z } from "zod";
import { bg } from "@/lib/background";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/phone";
import { suggestQuote } from "@/lib/queue";
import { loadRestaurantData } from "@/lib/reservations";
import { sendWalkinJoined } from "@/lib/emails";
import { notifyStaff } from "@/lib/notify-staff";
import { friendlyZodMessage } from "@/lib/zod-message";
import type { ActionResult } from "@/components/ui/action-form";

const MAX_LINE = 80;

const joinSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name.").max(120),
  party: z.coerce.number().int().min(1, "Please enter how many are in your party.").max(50),
  phone: z.string().trim().min(1, "Please enter a phone number so we can reach you.").max(40),
  email: z.union([z.literal(""), z.email("That email does not look right.")]),
  website: z.string().max(0).optional(), // honeypot
});

export async function joinQueue(slug: string, fd: FormData): Promise<ActionResult> {
  const parsed = joinSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: friendlyZodMessage(parsed.error) };
  const v = parsed.data;
  const data = await loadRestaurantData(slug);
  if (!data) return { error: "We could not find that restaurant." };
  const r = data.restaurant;
  if (!r.queue_open) return { error: "The line is not open online right now. Please check in with the host." };
  if (v.party > r.max_party_size) return { error: "For a party that size, please check in with the host." };
  const phone = normalizePhone(v.phone, "CAD");
  if (!phone) return { error: "Please enter a valid phone number, for example 416 555 0123." };

  const db = createAdminClient();
  const { data: open } = await db.from("walkins").select("id, phone, status").eq("restaurant_id", r.id).in("status", ["waiting", "ready"]);
  const line = open ?? [];
  if (line.some((w) => w.phone === phone)) return { error: "That number is already in line. Check the text or email you were sent for your place." };
  if (line.length >= MAX_LINE) return { error: "The line is full right now. Please check in with the host." };

  const waiting = line.filter((w) => w.status === "waiting").length;
  const { data: row, error } = await db.from("walkins").insert({
    restaurant_id: r.id, guest_name: v.name, party_size: v.party, phone, email: v.email ? v.email.toLowerCase() : null,
    quoted_minutes: suggestQuote(waiting), source: "online",
  }).select("*").single();
  if (error || !row) {
    console.error("[queue]", error?.message);
    return { error: "Something went wrong. Please try again." };
  }
  bg(sendWalkinJoined(r, row));
  bg(notifyStaff(r, { title: "Joined the line", body: `${v.name} · ${v.party} ${v.party === 1 ? "guest" : "guests"} · ${phone}`, path: "/queue", tag: `walkin-${row.id}` }));
  return { redirect: `/queue/${row.token}` };
}

export async function leaveQueue(token: string): Promise<ActionResult> {
  const db = createAdminClient();
  const { error } = await db.from("walkins").update({ status: "cancelled", closed_at: new Date().toISOString() }).eq("token", token).in("status", ["waiting", "ready"]);
  if (error) return { error: "Something went wrong. Please try again." };
  return { redirect: `/queue/${token}` };
}
