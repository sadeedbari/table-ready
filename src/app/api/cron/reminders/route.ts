import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { bearerMatches } from "@/lib/secure-compare";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendReminder } from "@/lib/emails";
import { sendPlanEmail } from "@/lib/billing";
import { expireWaitlist, flushWaitlist } from "@/lib/reservations";
import type { Restaurant } from "@/lib/types";

/**
 * Runs once a day (vercel.json): emails each guest a reminder for tomorrow's reservations, tidies old waitlist entries and
 * re-checks the waitlist. Protected by CRON_SECRET (Vercel sends it as a Bearer token).
 */
export async function GET(request: NextRequest) {
  if (!bearerMatches(request.headers.get("authorization"), env.cronSecret)) return new NextResponse("Unauthorized", { status: 401 });
  const db = createAdminClient();
  const now = Date.now();
  const { data: due } = await db
    .from("reservations")
    .select("*, restaurants(*)")
    .eq("status", "confirmed")
    .is("reminder_sent_at", null)
    .not("email", "is", null)
    .gt("starts_at", new Date(now + 2 * 3600_000).toISOString())
    .lte("starts_at", new Date(now + 26 * 3600_000).toISOString());
  let reminded = 0;
  for (const row of due ?? []) {
    const r = row.restaurants as unknown as Restaurant;
    // Claim it first, so a second run cannot send it twice.
    const { data: claimed } = await db.from("reservations").update({ reminder_sent_at: new Date().toISOString() }).eq("id", row.id).is("reminder_sent_at", null).select("id");
    if (!claimed?.length) continue;
    await sendReminder(r, row);
    reminded++;
  }
  // Anyone still marked in line after 18 hours is long gone: close those entries.
  await db.from("walkins").update({ status: "cancelled", closed_at: new Date().toISOString() }).in("status", ["waiting", "ready"]).lt("joined_at", new Date(now - 18 * 3600_000).toISOString());
  const { data: restaurants } = await db.from("restaurants").select("*");
  for (const r of (restaurants ?? []) as Restaurant[]) {
    await expireWaitlist(r);
    await flushWaitlist(r);
  }
  // Trials ending within 3 days: one email to the owners, claimed first so it is sent once.
  let trialNotices = 0;
  const { data: ending } = await db
    .from("restaurant_plans")
    .select("restaurant_id")
    .eq("status", "none")
    .is("trial_reminder_sent_at", null)
    .gt("trial_ends_at", new Date(now).toISOString())
    .lte("trial_ends_at", new Date(now + 3 * 86_400_000).toISOString());
  for (const p of ending ?? []) {
    const { data: claimed } = await db.from("restaurant_plans").update({ trial_reminder_sent_at: new Date().toISOString() }).eq("restaurant_id", p.restaurant_id).is("trial_reminder_sent_at", null).select("restaurant_id");
    if (!claimed?.length) continue;
    if (await sendPlanEmail(p.restaurant_id, "trial_ending")) trialNotices++;
  }
  return NextResponse.json({ reminded, trialNotices });
}
