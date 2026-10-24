"use client";
import { ActionForm } from "@/components/ui/action-form";
import { Field, Input } from "@/components/ui/input";
import { MarketingConsent } from "@/components/app/marketing-consent";
import { joinQueue } from "./actions";

export function JoinForm({ slug, maxParty, restaurant }: { slug: string; maxParty: number; restaurant: string }) {
  return (
    <ActionForm action={joinQueue.bind(null, slug)} submit="Join the line" size="lg" className="space-y-4">
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <Field label="Your name"><Input name="name" required autoComplete="name" maxLength={120} /></Field>
      <Field label="Guests in your party"><Input name="party" type="number" min={1} max={maxParty} defaultValue={2} required inputMode="numeric" /></Field>
      <Field label="Mobile number" hint="The restaurant may call or text you when your table is ready."><Input name="phone" type="tel" required autoComplete="tel" inputMode="tel" placeholder="416 555 0123" /></Field>
      <Field label="Email (optional)" hint="We will also email you when your table is ready."><Input name="email" type="email" autoComplete="email" /></Field>
      <MarketingConsent restaurant={restaurant} />
    </ActionForm>
  );
}
