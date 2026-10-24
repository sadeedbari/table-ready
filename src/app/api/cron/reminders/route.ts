import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { bearerMatches } from "@/lib/secure-compare";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendReminder } from "@/lib/emails";
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
  return NextResponse.json({ reminded });
}
