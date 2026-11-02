import test from "node:test";
import assert from "node:assert/strict";
import { FREE_MONTHLY_LIMIT, GRACE_DAYS, HARD_STOP, WARN_AT, planOf, usageLevel, type PlanRow } from "../src/lib/plan";

const DAY = 86_400_000;
const NOW = Date.parse("2026-11-10T15:00:00Z");
const row = (over: Partial<PlanRow> = {}): PlanRow => ({
  trial_ends_at: new Date(NOW - DAY).toISOString(), status: "none", current_period_end: null, cancel_at_period_end: false, past_due_since: null, comped_until: null, ...over,
});

test("a new restaurant is on Pro during its 30-day trial, with whole days counted up", () => {
  const p = planOf(row({ trial_ends_at: new Date(NOW + 12.2 * DAY).toISOString() }), NOW);
  assert.deepEqual([p.plan, p.reason, p.trialDaysLeft], ["pro", "trial", 13]);
  const last = planOf(row({ trial_ends_at: new Date(NOW + 3_600_000).toISOString() }), NOW);
  assert.equal(last.trialDaysLeft, 1); // the last day still says 1
});

test("after the trial with no subscription the restaurant is on Free", () => {
  const p = planOf(row(), NOW);
  assert.deepEqual([p.plan, p.reason, p.trialDaysLeft], ["free", "free", null]);
});

test("a subscription makes it Pro, and cancelling keeps Pro until the paid period ends", () => {
  assert.equal(planOf(row({ status: "active" }), NOW).plan, "pro");
  const cancelling = planOf(row({ status: "active", cancel_at_period_end: true, current_period_end: "2026-12-01T00:00:00Z" }), NOW);
  assert.deepEqual([cancelling.plan, cancelling.endsAt], ["pro", "2026-12-01T00:00:00Z"]);
  assert.equal(planOf(row({ status: "cancelled" }), NOW).plan, "free");
});

test("a failed payment keeps Pro for the grace days, then drops to Free", () => {
  const fresh = planOf(row({ status: "past_due", past_due_since: new Date(NOW - 2 * DAY).toISOString() }), NOW);
  assert.deepEqual([fresh.plan, fresh.reason, fresh.paymentProblem], ["pro", "grace", true]);
  const stale = planOf(row({ status: "past_due", past_due_since: new Date(NOW - (GRACE_DAYS + 1) * DAY).toISOString() }), NOW);
  assert.equal(stale.plan, "free");
});

test("a comped period gives Pro until it ends", () => {
  assert.equal(planOf(row({ comped_until: new Date(NOW + DAY).toISOString() }), NOW).reason, "comp");
  assert.equal(planOf(row({ comped_until: new Date(NOW - DAY).toISOString() }), NOW).plan, "free");
});

test("Free usage warns at 40, is over at 50, and stops online booking at 60; Pro is never limited", () => {
  assert.equal(FREE_MONTHLY_LIMIT, 50);
  assert.deepEqual([0, WARN_AT - 1, WARN_AT, FREE_MONTHLY_LIMIT - 1, FREE_MONTHLY_LIMIT, HARD_STOP - 1, HARD_STOP].map((n) => usageLevel("free", n)), ["ok", "ok", "warning", "warning", "over", "over", "stopped"]);
  assert.equal(usageLevel("pro", 5000), "ok");
});
