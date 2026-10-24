import "server-only";
import webpush from "web-push";
import { env, features } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendStaffEmail } from "@/lib/emails";
import { formatDate, formatTime } from "@/lib/format";
import type { Reservation, Restaurant } from "@/lib/types";

type R = Pick<Restaurant, "id" | "slug" | "name" | "timezone" | "notify_push" | "notify_email">;
export interface StaffMessage { title: string; body: string; path: string; tag: string }

const party = (n: number) => `${n} ${n === 1 ? "guest" : "guests"}`;

/** What the restaurant is told when a guest books online. Kept short: a lock screen cuts off long lines. */
export function reservationMessage(
  r: Pick<Restaurant, "timezone" | "slug">,
  x: Pick<Reservation, "id" | "guest_name" | "party_size" | "starts_at" | "notes">,
  tableName?: string | null,
): StaffMessage {
  const when = `${formatDate(x.starts_at, r.timezone, { weekday: "short", month: "short", day: "numeric" })} at ${formatTime(x.starts_at, r.timezone)}`;
  return {
    title: "New reservation",
    body: `${x.guest_name} · ${party(x.party_size)} · ${when}${tableName ? ` · Table ${tableName}` : ""}${x.notes ? ` · "${x.notes}"` : ""}`,
    path: `?date=${new Date(x.starts_at).toLocaleDateString("en-CA", { timeZone: r.timezone })}`,
    tag: `reservation-${x.id}`,
  };
}

export function cancellationMessage(r: Pick<Restaurant, "timezone" | "slug">, x: Pick<Reservation, "id" | "guest_name" | "party_size" | "starts_at">): StaffMessage {
  const m = reservationMessage(r, { ...x, notes: null });
  return { ...m, title: "Reservation cancelled by guest" };
}

/**
 * Tells the owners and admins by email (to the address on their account) and by push (to every device they turned it on for).
 * Never throws: a failed alert must not break a booking.
 */
export async function notifyStaff(r: R, m: StaffMessage) {
  try {
    const db = createAdminClient();
    const { data: members } = await db.from("memberships").select("user_id, role").eq("restaurant_id", r.id);
    const userIds = [...new Set((members ?? []).filter((x) => x.role === "owner" || x.role === "admin").map((x) => x.user_id as string))];
    if (!userIds.length) return;
    const url = `/o/${r.slug}${m.path}`;
    const jobs: Promise<unknown>[] = [];
    if (r.notify_push && features.push) jobs.push(deliverPush(userIds, { title: m.title, body: m.body, url, tag: m.tag }));
    if (r.notify_email) {
      for (const id of userIds) {
        jobs.push(
          db.auth.admin.getUserById(id).then(({ data }) => {
            const to = data.user?.email;
            return to ? sendStaffEmail(to, r.name, m.title, m.body, `${env.appUrl}${url}`) : undefined;
          }),
        );
      }
    }
    await Promise.allSettled(jobs);
  } catch (e) {
    console.error("[notify-staff]", e);
  }
}

/** Sends one notification to every device registered by these people, and forgets devices that no longer exist. */
async function deliverPush(userIds: string[], message: { title: string; body: string; url: string; tag: string }) {
  const admin = createAdminClient();
  const { data: subs } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").in("user_id", userIds);
  if (!subs?.length) return;
  webpush.setVapidDetails(env.vapidSubject, env.vapidPublicKey!, env.vapidPrivateKey!);
  const payload = JSON.stringify(message);
  const dead: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 24 });
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) dead.push(s.id); // the phone removed the subscription
        else console.error("[push]", code ?? e);
      }
    }),
  );
  if (dead.length) await admin.from("push_subscriptions").delete().in("id", dead);
}
