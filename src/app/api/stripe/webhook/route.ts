import type Stripe from "stripe";
import { env } from "@/lib/env";
import { applySubscription, retrieveSubscription, sendPlanEmail } from "@/lib/billing";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Stripe tells us here when someone subscribes, pays, fails to pay or cancels.
 *  - The signature is checked on the raw body first; a forged request changes nothing.
 *  - Events from another Stripe account, or from the other mode (test vs live), are ignored.
 *  - Nothing in an event is trusted beyond its signature: the subscription is always re-read from Stripe with our own key,
 *    so what we save is Stripe's current truth (which also makes out-of-order events harmless).
 *  - Each event id is claimed before any work, so a repeat is acknowledged and not run twice. A failed run is released for Stripe's retry.
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  if (!stripe || !env.stripeWebhookSecret) return new Response("Billing webhook not configured", { status: 501 });

  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, request.headers.get("stripe-signature") ?? "", env.stripeWebhookSecret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }
  if ((event as { account?: string }).account) return Response.json({ received: true, ignored: "connected account event" });
  const keyIsLive = /^(sk|rk)_live_/.test(env.stripeSecretKey ?? "");
  if (typeof event.livemode === "boolean" && !env.stripeMockUrl && event.livemode !== keyIsLive) return Response.json({ received: true, ignored: "wrong mode" });

  const db = createAdminClient();
  const { error: claimError } = await db.from("stripe_billing_events").insert({ id: event.id, type: event.type });
  if (claimError) {
    if (claimError.code !== "23505") {
      console.error("[stripe-webhook] could not record event:", claimError.message);
      return new Response("Could not record event", { status: 500 });
    }
    const { data: seen } = await db.from("stripe_billing_events").select("processed_at").eq("id", event.id).single();
    if (seen?.processed_at) return Response.json({ received: true, duplicate: true });
    return new Response("Event is being processed", { status: 409 }); // Stripe retries shortly
  }

  try {
    await handle(stripe, event);
  } catch (e) {
    console.error(`[stripe-webhook] ${event.type} failed:`, (e as Error).message);
    await db.from("stripe_billing_events").delete().eq("id", event.id); // release the claim so the retry runs
    return new Response("Processing failed", { status: 500 });
  }
  await db.from("stripe_billing_events").update({ processed_at: new Date().toISOString() }).eq("id", event.id);
  return Response.json({ received: true });
}

const idOf = (v: string | { id: string } | null | undefined) => (typeof v === "string" ? v : v?.id ?? null);

async function sync(stripe: Stripe, subscriptionId: string, event: Stripe.Event, restaurantHint?: string) {
  const sub = await retrieveSubscription(stripe, subscriptionId);
  if (!sub) return;
  const r = await applySubscription(sub, { eventAt: event.created, restaurantHint });
  if (r?.started) await sendPlanEmail(r.restaurantId, "started");
  else if (r?.paymentFailed) await sendPlanEmail(r.restaurantId, "payment_failed"); // only when the problem starts, not on every retry
}

async function handle(stripe: Stripe, event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const subId = session.mode === "subscription" ? idOf(session.subscription) : null;
      if (subId) await sync(stripe, subId, event, session.client_reference_id ?? undefined);
      return;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await sync(stripe, (event.data.object as Stripe.Subscription).id, event);
      return;
    case "invoice.payment_failed":
    case "invoice.paid": {
      const subId = idOf((event.data.object as Stripe.Invoice).parent?.subscription_details?.subscription);
      if (subId) await sync(stripe, subId, event); // a one-off invoice must not start a grace period
      return;
    }
  }
}
