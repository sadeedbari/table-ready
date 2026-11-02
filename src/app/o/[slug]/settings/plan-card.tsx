"use client";
import { ActionForm } from "@/components/ui/action-form";
import { startCheckout, openBillingPortal } from "../actions";

/** The two buttons on the plan card. Each sends the owner to a page on Stripe; the card details are never typed into Table Ready. */
export function UpgradeButton({ slug, label }: { slug: string; label: string }) {
  return <ActionForm action={startCheckout.bind(null, slug)} submit={label} size="lg" className="space-y-2" />;
}

export function ManageBillingButton({ slug }: { slug: string }) {
  return <ActionForm action={openBillingPortal.bind(null, slug)} submit="Manage billing" variant="gray" size="md" className="space-y-2" />;
}
