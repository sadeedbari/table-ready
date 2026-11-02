import Link from "next/link";
import { AlertTriangle, Sparkles } from "lucide-react";
import { formatDate } from "@/lib/format";
import { FREE_MONTHLY_LIMIT, GRACE_DAYS, HARD_STOP, usageLevel, type PlanState } from "@/lib/plan";

/**
 * One message at the top of the dashboard when the plan needs attention, most urgent first: a payment problem, the Free
 * limit, a trial about to end, a plan that is ending. Renders nothing when everything is fine.
 */
export function PlanBanner({ slug, state, used, timeZone }: { slug: string; state: PlanState; used: number; timeZone: string }) {
  const href = `/o/${slug}/settings#plan`;
  const level = usageLevel(state.plan, used);
  let tone: "red" | "orange" | "blue" | null = null;
  let message = "";
  let cta = "See plans";

  if (state.paymentProblem && state.reason === "grace") {
    tone = "red";
    message = `Your last payment did not go through. Pro continues for up to ${GRACE_DAYS} days while we retry the card.`;
    cta = "Update payment method";
  } else if (level === "stopped") {
    tone = "red";
    message = `Online reservations are paused for this month: you have ${used} reservations and the Free plan stops at ${HARD_STOP}. Guests are asked to call you. Upgrade to turn them back on.`;
    cta = "Upgrade to Pro";
  } else if (level === "over") {
    tone = "orange";
    message = `You have ${used} reservations this month, over the Free limit of ${FREE_MONTHLY_LIMIT}. Online booking pauses at ${HARD_STOP}.`;
    cta = "Upgrade to Pro";
  } else if (level === "warning") {
    tone = "orange";
    message = `You have used ${used} of your ${FREE_MONTHLY_LIMIT} free reservations this month. Pro is unlimited.`;
    cta = "See Pro";
  } else if (state.reason === "trial" && state.trialDaysLeft !== null && state.trialDaysLeft <= 7) {
    tone = "blue";
    message = `Your Pro trial ends in ${state.trialDaysLeft} ${state.trialDaysLeft === 1 ? "day" : "days"}. After that you stay on Free (${FREE_MONTHLY_LIMIT} reservations a month, no guest list download).`;
    cta = "Keep Pro";
  } else if (state.endsAt) {
    tone = "blue";
    message = `Your Pro plan ends on ${formatDate(state.endsAt, timeZone, { month: "long", day: "numeric", year: "numeric" })}. You can keep it from Manage billing.`;
    cta = "Manage plan";
  }
  if (!tone) return null;

  const palette = {
    red: "bg-red-soft text-red-text",
    orange: "bg-[color-mix(in_srgb,var(--orange)_16%,transparent)] text-orange-text",
    blue: "bg-accent-soft text-accent-text",
  }[tone];
  const Icon = tone === "blue" ? Sparkles : AlertTriangle;
  return (
    <div role="status" data-testid="plan-banner" className={`mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[16px] px-4 py-3 ${palette}`}>
      <Icon className="size-5 shrink-0" aria-hidden />
      <p className="min-w-[200px] flex-1 text-[14px] font-medium leading-snug">{message}</p>
      <Link href={href} className="inline-flex min-h-10 items-center rounded-full bg-surface px-4 text-[14px] font-semibold text-label shadow-sm hover:bg-surface-2">{cta}</Link>
    </div>
  );
}
