/** The plans and their limits. Pure rules with no database or Stripe in them, so they are easy to test and to change in one place. */

export const PRO_PRICE_CAD = 29;
export const TRIAL_DAYS = 30;
/** Free plan: reservations in a calendar month (any way they are made, cancelled ones not counted). */
export const FREE_MONTHLY_LIMIT = 50;
/** Warning starts here (80% of the free limit). */
export const WARN_AT = 40;
/** A little room past the limit so a busy weekend does not turn guests away mid-booking. At this many, online booking pauses for the month. */
export const HARD_STOP = 60;
/** After a failed payment, Pro continues this long while Stripe retries the card. */
export const GRACE_DAYS = 7;

export interface PlanRow {
  trial_ends_at: string;
  status: "none" | "active" | "past_due" | "cancelled";
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  past_due_since: string | null;
  comped_until: string | null;
}

export type PlanReason = "trial" | "subscription" | "grace" | "comp" | "free";
export interface PlanState {
  plan: "pro" | "free";
  reason: PlanReason;
  /** Whole days left in the trial (only while it runs), rounded up so the last day still says 1. */
  trialDaysLeft: number | null;
  /** The paid plan ends (cancelled, still paid up to this date). */
  endsAt: string | null;
  /** A card problem is being retried. */
  paymentProblem: boolean;
}

const DAY = 86_400_000;
const t = (s: string | null) => (s ? new Date(s).getTime() : 0);

/** Which plan a restaurant is on right now, and why. */
export function planOf(row: PlanRow, now: number): PlanState {
  const trialMs = t(row.trial_ends_at) - now;
  const trialDaysLeft = trialMs > 0 ? Math.ceil(trialMs / DAY) : null;
  const base = { trialDaysLeft, endsAt: row.cancel_at_period_end ? row.current_period_end : null, paymentProblem: row.status === "past_due" };
  if (row.status === "active") return { ...base, plan: "pro", reason: "subscription" };
  if (row.status === "past_due" && row.past_due_since && now < t(row.past_due_since) + GRACE_DAYS * DAY) return { ...base, plan: "pro", reason: "grace" };
  if (t(row.comped_until) > now) return { ...base, plan: "pro", reason: "comp" };
  if (trialMs > 0) return { ...base, plan: "pro", reason: "trial" };
  return { ...base, plan: "free", reason: "free" };
}

export type UsageLevel = "ok" | "warning" | "over" | "stopped";
/** How the month's reservations compare with the Free limit (Pro is never limited). */
export function usageLevel(plan: "pro" | "free", used: number): UsageLevel {
  if (plan === "pro") return "ok";
  if (used >= HARD_STOP) return "stopped";
  if (used >= FREE_MONTHLY_LIMIT) return "over";
  if (used >= WARN_AT) return "warning";
  return "ok";
}

/** What a restaurant gets on each plan, for the plan card and the pricing section. */
export const FEATURES: { label: string; free: string; pro: string }[] = [
  { label: "Reservations a month", free: `${FREE_MONTHLY_LIMIT}`, pro: "Unlimited" },
  { label: "Tables, opening hours and booking page", free: "Included", pro: "Included" },
  { label: "Waitlist and walk-in line", free: "Included", pro: "Included" },
  { label: "Emails to guests and alerts to you", free: "Included", pro: "Included" },
  { label: "Install as an app", free: "Included", pro: "Included" },
  { label: "Guest list download (CSV)", free: "Not included", pro: "Included" },
  { label: "“Powered by Table Ready” on guest pages", free: "Shown", pro: "Removed" },
];
