import { Check, Minus } from "lucide-react";
import { Badge, Card, Notice } from "@/components/ui/misc";
import { formatDate } from "@/lib/format";
import { FEATURES, FREE_MONTHLY_LIMIT, GRACE_DAYS, PRO_PRICE_CAD, TRIAL_DAYS, usageLevel, type PlanState } from "@/lib/plan";
import { ManageBillingButton, UpgradeButton } from "./plan-card";

const REASON: Record<string, { label: string; tone: "green" | "blue" | "orange" | "gray" }> = {
  subscription: { label: "Pro", tone: "green" },
  trial: { label: "Pro trial", tone: "blue" },
  grace: { label: "Pro (payment problem)", tone: "orange" },
  comp: { label: "Pro (complimentary)", tone: "green" },
  free: { label: "Free", tone: "gray" },
};

/** Which plan the restaurant is on, what it gets, and how to change it. Only the owner sees the buttons. */
export function PlanSection({ slug, state, used, isOwner, timeZone, hasSubscription, checkout, billingReady }: {
  slug: string; state: PlanState; used: number; isOwner: boolean; timeZone: string; hasSubscription: boolean; checkout?: "success" | "cancelled" | "pending"; billingReady: boolean;
}) {
  const badge = REASON[state.reason];
  const level = usageLevel(state.plan, used);
  const pct = Math.min(100, Math.round((used / FREE_MONTHLY_LIMIT) * 100));
  return (
    <section id="plan" className="mb-8 scroll-mt-28">
      <h2 className="mb-1 text-[20px]">Plan</h2>
      <p className="mb-3 text-[14px] text-label-2">Free covers a quiet month. Pro is {`$${PRO_PRICE_CAD}`} CAD a month, with no contract: cancel any time.</p>
      {checkout === "success" && <div className="mb-3"><Notice tone="green" live>Thank you! Your Pro plan is {state.reason === "subscription" ? "active" : "being set up. This page updates within a minute"}.</Notice></div>}
      {checkout === "cancelled" && <div className="mb-3"><Notice tone="blue" live>No payment was taken. You can upgrade whenever you like.</Notice></div>}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[22px] font-semibold" style={{ fontFamily: "var(--font-display)" }}>{state.plan === "pro" ? "Table Ready Pro" : "Table Ready Free"}</span>
              <Badge tone={badge.tone}>{badge.label}</Badge>
            </div>
            <p className="mt-1 text-[14px] text-label-2">
              {state.reason === "trial" && state.trialDaysLeft !== null && `${state.trialDaysLeft} ${state.trialDaysLeft === 1 ? "day" : "days"} left of your ${TRIAL_DAYS}-day Pro trial. After it, you stay on Free unless you upgrade.`}
              {state.reason === "subscription" && !state.endsAt && "Your subscription is active."}
              {state.reason === "subscription" && state.endsAt && `Your Pro plan ends on ${formatDate(state.endsAt, timeZone, { month: "long", day: "numeric", year: "numeric" })}.`}
              {state.reason === "grace" && `Your last payment did not go through. Pro continues up to ${GRACE_DAYS} days while Stripe retries. Update your card to keep it.`}
              {state.reason === "comp" && "Pro has been added to your account at no charge."}
              {state.reason === "free" && "You are on the Free plan."}
            </p>
          </div>
          {isOwner ? (
            <div className="shrink-0">
              {hasSubscription && state.plan === "pro" ? <ManageBillingButton slug={slug} />
                : hasSubscription && state.plan === "free" ? <ManageBillingButton slug={slug} />
                : <UpgradeButton slug={slug} label={`Upgrade to Pro · $${PRO_PRICE_CAD}/month`} />}
              {!billingReady && <p className="mt-2 max-w-[260px] text-[12px] text-label-3">Billing is not switched on for this site yet.</p>}
            </div>
          ) : (
            <p className="max-w-[260px] text-[13px] text-label-2">Only the restaurant&apos;s owner can change the plan.</p>
          )}
        </div>

        {state.plan === "free" && (
          <div className="mt-5" data-testid="free-usage">
            <div className="flex items-baseline justify-between text-[14px]">
              <span className="font-medium">Reservations this month</span>
              <span className={level === "ok" ? "text-label-2" : "font-semibold text-orange-text"}>{used} of {FREE_MONTHLY_LIMIT}</span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={used} aria-valuemin={0} aria-valuemax={FREE_MONTHLY_LIMIT} aria-label="Free reservations used this month">
              <div className={`h-full rounded-full ${level === "ok" ? "bg-accent-fill" : "bg-orange"}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        <div className="mt-6 overflow-hidden rounded-[14px] hairline">
          <table className="w-full text-left text-[14px]">
            <caption className="sr-only">What is on each plan</caption>
            <thead className="bg-surface-2 text-[12px] uppercase tracking-wide text-label-2">
              <tr><th scope="col" className="px-4 py-2.5 font-semibold">What you get</th><th scope="col" className="px-3 py-2.5 font-semibold">Free</th><th scope="col" className="px-3 py-2.5 font-semibold">Pro</th></tr>
            </thead>
            <tbody className="divide-y divide-separator">
              {FEATURES.map((f) => (
                <tr key={f.label}>
                  <th scope="row" className="px-4 py-2.5 font-normal">{f.label}</th>
                  <td className="px-3 py-2.5 text-label-2">{f.free === "Not included" ? <span className="inline-flex items-center gap-1"><Minus className="size-4" aria-hidden />Not included</span> : f.free === "Included" ? <Check className="size-[18px] text-green-text" aria-label="Included" /> : f.free}</td>
                  <td className="px-3 py-2.5 font-medium">{f.pro === "Included" ? <Check className="size-[18px] text-green-text" aria-label="Included" /> : f.pro}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}
