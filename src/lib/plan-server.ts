import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { addDaysToKey, dayKey, todayKey } from "@/lib/format";
import { instantAt } from "@/lib/hours";
import { planOf, usageLevel, type PlanRow, type PlanState } from "@/lib/plan";
import type { Restaurant } from "@/lib/types";

/** The full plan row, including Stripe ids. Server only: the table cannot be read from a browser. */
export interface PlanRecord extends PlanRow {
  restaurant_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  trial_reminder_sent_at: string | null;
  last_stripe_event_at: string | null;
}

export async function loadPlanRecord(restaurantId: string): Promise<PlanRecord | null> {
  const { data } = await createAdminClient().from("restaurant_plans").select("*").eq("restaurant_id", restaurantId).maybeSingle();
  return (data as PlanRecord | null) ?? null;
}

/** Which plan a restaurant is on right now. A restaurant with no plan row (should not happen) is treated as Free. */
export async function currentPlan(restaurantId: string, now = Date.now()): Promise<{ state: PlanState; record: PlanRecord | null }> {
  const record = await loadPlanRecord(restaurantId);
  const state: PlanState = record
    ? planOf(record, now)
    : { plan: "free", reason: "free", trialDaysLeft: null, endsAt: null, paymentProblem: false };
  return { state, record };
}

/** The first moment of the calendar month containing a local date, and of the next month (in the restaurant's time zone). */
export function monthRange(timeZone: string, forDate: string): { from: Date; to: Date } {
  const [y, m] = forDate.split("-").map(Number);
  const first = `${y}-${String(m).padStart(2, "0")}-01`;
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return { from: instantAt(first, 0, timeZone), to: instantAt(next, 0, timeZone) };
}

/** Reservations in the month of a local date, however they were made (cancelled ones are not counted). */
export async function reservationsInMonth(restaurant: Pick<Restaurant, "id" | "timezone">, forDate = todayKey(restaurant.timezone)): Promise<number> {
  const { from, to } = monthRange(restaurant.timezone, forDate);
  const { count } = await createAdminClient()
    .from("reservations")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurant.id)
    .gte("starts_at", from.toISOString())
    .lt("starts_at", to.toISOString())
    .in("status", ["confirmed", "seated", "completed", "no_show"]);
  return count ?? 0;
}

/** True when this restaurant is on the Free plan and already at the point where new online reservations pause for that month. */
export async function onlineBookingPaused(restaurant: Pick<Restaurant, "id" | "timezone">, forDate: string): Promise<boolean> {
  const { state } = await currentPlan(restaurant.id);
  if (state.plan === "pro") return false;
  return usageLevel("free", await reservationsInMonth(restaurant, forDate)) === "stopped";
}

export { addDaysToKey, dayKey };
