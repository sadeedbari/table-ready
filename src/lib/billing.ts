import "server-only";
import type Stripe from "stripe";
import { env, features } from "@/lib/env";
import { esc, sendEmail, shell } from "@/lib/emails";
import { loadPlanRecord, type PlanRecord } from "@/lib/plan-server";
import { GRACE_DAYS, PRO_PRICE_CAD } from "@/lib/plan";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Restaurant } from "@/lib/types";

/** A message that is safe and meant for the person using the page. Anything else is logged and replaced by a fixed sentence. */
export class BillingUserError extends Error {}

export const billingReady = () => features.billing && Boolean(getStripe());

function requireBilling() {
  const stripe = getStripe();
  if (!stripe || !features.billing || !env.stripePricePro) throw new BillingUserError("Billing is not set up yet. Please try again later.");
  return { stripe, price: env.stripePricePro };
}

const LIVE = new Set(["active", "trialing", "past_due", "unpaid", "paused"]);
const isMissing = (e: unknown) => (e as { code?: string })?.code === "resource_missing" || (e as { statusCode?: number })?.statusCode === 404;
const idOf = (v: string | { id: string } | null | undefined) => (typeof v === "string" ? v : v?.id ?? null);
const iso = (seconds: number) => new Date(seconds * 1000).toISOString();

/** The Stripe customer for a restaurant, made once and remembered (two tabs at once end up with the same customer). */
async function ensureCustomer(stripe: Stripe, restaurant: Pick<Restaurant, "id" | "name">, email: string | undefined, record: PlanRecord): Promise<string> {
  if (record.stripe_customer_id) return record.stripe_customer_id;
  const customer = await stripe.customers.create(
    { name: restaurant.name, ...(email ? { email } : {}), metadata: { restaurant_id: restaurant.id } },
    { idempotencyKey: `tableready-customer-${restaurant.id}` },
  );
  const db = createAdminClient();
  const { data } = await db.from("restaurant_plans").update({ stripe_customer_id: customer.id }).eq("restaurant_id", restaurant.id).is("stripe_customer_id", null).select("stripe_customer_id");
  if (data?.length) return customer.id;
  const { data: row } = await db.from("restaurant_plans").select("stripe_customer_id").eq("restaurant_id", restaurant.id).single();
  return row!.stripe_customer_id as string;
}

/** A Stripe Checkout page for the Pro plan. The amount comes from our price id, never from the browser. */
export async function createCheckoutUrl(restaurant: Pick<Restaurant, "id" | "name" | "slug">, email: string | undefined): Promise<string> {
  const { stripe, price } = requireBilling();
  const record = await loadPlanRecord(restaurant.id);
  if (!record) throw new BillingUserError("We could not find your plan. Please try again.");
  const customer = await ensureCustomer(stripe, restaurant, email, record);

  // Never start a second subscription: if Stripe already has a live one, bring our copy up to date and say so.
  const existing = (await stripe.subscriptions.list({ customer, status: "all", limit: 20 })).data.find((s) => LIVE.has(s.status));
  if (existing) {
    await applySubscription(existing, { restaurantHint: restaurant.id, eventAt: Math.floor(Date.now() / 1000) });
    throw new BillingUserError(existing.status === "active" || existing.status === "trialing"
      ? "You already have a subscription. Refresh this page to see it."
      : "Your subscription has an unpaid invoice. Open Manage billing to pay it or update your card.");
  }

  const back = `${env.appUrl}/o/${encodeURIComponent(restaurant.slug)}/settings`;
  const bucket = Math.floor(Date.now() / 600_000);
  const session = await stripe.checkout.sessions.create(
    {
      mode: "subscription",
      customer,
      client_reference_id: restaurant.id,
      line_items: [{ price, quantity: 1 }],
      metadata: { restaurant_id: restaurant.id },
      subscription_data: { metadata: { restaurant_id: restaurant.id } },
      expires_at: bucket * 600 + 3600, // fixed within a 10-minute bucket so a double click returns the same page
      success_url: `${back}?checkout=success&session_id={CHECKOUT_SESSION_ID}#plan`,
      cancel_url: `${back}?checkout=cancelled#plan`,
      allow_promotion_codes: true,
    },
    { idempotencyKey: `tableready-checkout-${restaurant.id}-${price}-${bucket}` },
  );
  if (!session.url) throw new BillingUserError("Stripe did not return a payment page. Please try again.");
  return session.url;
}

/** The Stripe Customer Portal (card, invoices, cancelling). */
export async function createPortalUrl(restaurant: Pick<Restaurant, "id" | "name" | "slug">, email: string | undefined): Promise<string> {
  const { stripe } = requireBilling();
  // Fail closed: never fall back to the Stripe account's Default portal, which may belong to another product.
  if (!env.stripePortalConfiguration) {
    console.error("Billing portal: STRIPE_PORTAL_CONFIGURATION is not set; refusing to use the account's Default portal configuration.");
    throw new BillingUserError("The billing portal is not set up yet. Please contact support.");
  }
  const record = await loadPlanRecord(restaurant.id);
  if (!record) throw new BillingUserError("We could not find your plan. Please try again.");
  const customer = await ensureCustomer(stripe, restaurant, email, record);
  const session = await stripe.billingPortal.sessions.create({ customer, configuration: env.stripePortalConfiguration, return_url: `${env.appUrl}/o/${encodeURIComponent(restaurant.slug)}/settings#plan` });
  return session.url;
}

/** After Checkout the person lands back here: confirm the session is this restaurant's and apply it at once, without waiting for the webhook. */
export async function confirmCheckout(restaurantId: string, sessionId: string): Promise<boolean> {
  const stripe = getStripe();
  if (!stripe || !/^cs_[A-Za-z0-9_]{4,200}$/.test(sessionId)) return false;
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.client_reference_id !== restaurantId || session.metadata?.restaurant_id !== restaurantId || session.mode !== "subscription" || session.status !== "complete") return false;
    const subId = idOf(session.subscription);
    if (!subId) return false;
    const sub = await stripe.subscriptions.retrieve(subId);
    const r = await applySubscription(sub, { restaurantHint: restaurantId, eventAt: Math.floor(Date.now() / 1000) });
    if (r?.started) await sendPlanEmail(restaurantId, "started");
    return Boolean(r);
  } catch (e) {
    console.error("[billing] confirm checkout failed:", (e as Error).message);
    return false;
  }
}

export function localStatus(stripeStatus: Stripe.Subscription.Status): PlanRecord["status"] {
  switch (stripeStatus) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "cancelled";
    default:
      return "none"; // incomplete (payment not finished) and paused do not unlock Pro
  }
}

export interface ApplyResult { restaurantId: string; started: boolean; paymentFailed: boolean }

/**
 * Writes a Stripe subscription into our plan row. Safe to run any number of times with the same data. `eventAt` (Stripe's time in
 * seconds) stops something older than what we already applied from undoing it. Returns null when it belongs to no restaurant we know,
 * or when it is a different subscription from the paying one already on the row.
 */
export async function applySubscription(sub: Stripe.Subscription, opts: { eventAt?: number; restaurantHint?: string } = {}): Promise<ApplyResult | null> {
  const db = createAdminClient();
  const customerId = idOf(sub.customer)!;
  const hint = opts.restaurantHint ?? sub.metadata?.restaurant_id;

  // Find the restaurant by what we stored first; the metadata is only a hint and counts only when it matches (or nothing is stored yet).
  let row: PlanRecord | null = null;
  for (const [column, value] of [["stripe_subscription_id", sub.id], ["stripe_customer_id", customerId]] as const) {
    const { data } = await db.from("restaurant_plans").select("*").eq(column, value).maybeSingle();
    if (data) { row = data as PlanRecord; break; }
  }
  if (!row && hint && /^[0-9a-f-]{36}$/i.test(hint)) {
    const { data } = await db.from("restaurant_plans").select("*").eq("restaurant_id", hint).maybeSingle();
    const h = data as PlanRecord | null;
    if (h && (!h.stripe_customer_id || h.stripe_customer_id === customerId)) row = h;
  }
  if (!row) return null;

  // A second, different live subscription must not overwrite the paying one.
  if (row.stripe_subscription_id && row.stripe_subscription_id !== sub.id && (row.status === "active" || row.status === "past_due")) {
    if (LIVE.has(sub.status)) console.error(`[billing] ALERT: restaurant ${row.restaurant_id} has a second live subscription ${sub.id} (keeping ${row.stripe_subscription_id}). Cancel and refund one in Stripe.`);
    return null;
  }
  if (opts.eventAt && row.last_stripe_event_at && new Date(row.last_stripe_event_at).getTime() > opts.eventAt * 1000) return null;

  const status = localStatus(sub.status);
  const ends = sub.items.data.map((i) => i.current_period_end).filter((n): n is number => typeof n === "number");
  const patch = {
    status,
    stripe_customer_id: customerId,
    stripe_subscription_id: sub.id,
    cancel_at_period_end: status === "cancelled" ? false : Boolean(sub.cancel_at_period_end),
    current_period_end: ends.length ? iso(Math.min(...ends)) : row.current_period_end,
    past_due_since: status === "past_due" ? row.past_due_since ?? new Date().toISOString() : null,
    ...(opts.eventAt ? { last_stripe_event_at: iso(opts.eventAt) } : {}),
  };
  // Compare-and-set on the status we read, so two deliveries of the same news change the row (and send the email) only once.
  const { data: changed, error } = await db.from("restaurant_plans").update(patch).eq("restaurant_id", row.restaurant_id).eq("status", row.status).select("restaurant_id");
  if (error) throw new Error(`could not save the plan: ${error.message}`);
  if (!changed?.length) return { restaurantId: row.restaurant_id, started: false, paymentFailed: false };
  return {
    restaurantId: row.restaurant_id,
    started: status === "active" && row.status !== "active" && row.status !== "past_due",
    paymentFailed: status === "past_due" && row.status !== "past_due",
  };
}

export async function retrieveSubscription(stripe: Stripe, id: string): Promise<Stripe.Subscription | null> {
  try {
    return await stripe.subscriptions.retrieve(id);
  } catch (e) {
    if (isMissing(e)) return null;
    throw e;
  }
}

/* ───────────────────────────── Emails about the plan (sent to the owners) ───────────────────────────── */

export type PlanEmail = "trial_ending" | "payment_failed" | "started";

/** The email address on each owner's account. */
export async function ownerEmails(restaurantId: string): Promise<string[]> {
  const db = createAdminClient();
  const { data: owners } = await db.from("memberships").select("user_id").eq("restaurant_id", restaurantId).eq("role", "owner");
  const out: string[] = [];
  for (const o of owners ?? []) {
    const { data } = await db.auth.admin.getUserById(o.user_id as string);
    if (data.user?.email) out.push(data.user.email);
  }
  return out;
}

/** Tells the owners about their plan. These are messages about their own account, not marketing. Never throws. */
export async function sendPlanEmail(restaurantId: string, kind: PlanEmail): Promise<boolean> {
  try {
    const db = createAdminClient();
    const { data: r } = await db.from("restaurants").select("name, slug").eq("id", restaurantId).maybeSingle();
    if (!r) return false;
    const to = await ownerEmails(restaurantId);
    if (!to.length) return false;
    const url = `${env.appUrl}/o/${encodeURIComponent(r.slug)}/settings#plan`;
    const copy: Record<PlanEmail, { subject: string; title: string; lines: string[]; button: string }> = {
      trial_ending: {
        subject: "Your Table Ready Pro trial ends soon",
        title: "Your Pro trial ends soon",
        lines: [
          `The free Pro trial for ${r.name} is about to end.`,
          `After that you stay on the Free plan, which is a good fit for a quiet month: up to 50 reservations, with the waitlist, walk-in line and alerts. Pro is $${PRO_PRICE_CAD} CAD a month and adds unlimited reservations, the guest list download, and no "Powered by Table Ready" on your guest pages.`,
          "Nothing is lost if you do nothing: your tables, hours and guests all stay.",
        ],
        button: "See plans",
      },
      payment_failed: {
        subject: "We could not take your Table Ready payment",
        title: "Your payment did not go through",
        lines: [
          `The latest payment for ${r.name} was declined. Stripe will try the card again automatically.`,
          `Please update your card. Pro continues for ${GRACE_DAYS} days while we retry. After that, ${r.name} moves to the Free plan until the payment goes through. Nothing is deleted.`,
        ],
        button: "Update payment method",
      },
      started: {
        subject: "Your Table Ready Pro plan is active",
        title: "You are on Pro",
        lines: [`Thank you! ${r.name} is on Table Ready Pro ($${PRO_PRICE_CAD} CAD a month): unlimited reservations, the guest list download, and no Table Ready branding on your guest pages.`, "You can update your card or see invoices any time from Settings."],
        button: "Open Settings",
      },
    };
    const c = copy[kind];
    const html = shell(c.title, c.lines.map((l) => `<p style="margin:0 0 12px">${esc(l)}</p>`).join(""), { href: url, label: c.button });
    const text = `${c.title}\n\n${c.lines.join("\n\n")}\n\n${c.button}: ${url}`;
    await Promise.all(to.map((address) => sendEmail({ to: address, subject: c.subject, html, text })));
    return true;
  } catch (e) {
    console.error("[billing] email failed:", e);
    return false;
  }
}
