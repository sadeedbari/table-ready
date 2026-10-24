"use client";
import { useRouter } from "next/navigation";
import { ActionForm } from "@/components/ui/action-form";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { MarketingConsent } from "@/components/app/marketing-consent";
import { joinWaitlist, reserve, signUpForUpdates } from "./actions";

export function Picker({ slug, party, date, maxParty, days }: { slug: string; party: number; date: string; maxParty: number; days: { value: string; label: string }[] }) {
  const router = useRouter();
  const go = (p: number, d: string) => router.replace(`/${slug}?party=${p}&date=${d}`, { scroll: false });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Guests">
        <Select value={party} onChange={(e) => go(Number(e.target.value), date)}>
          {Array.from({ length: maxParty }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} {n === 1 ? "guest" : "guests"}</option>)}
        </Select>
      </Field>
      <Field label="Day">
        <Select value={date} onChange={(e) => go(party, e.target.value)}>
          {days.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </Select>
      </Field>
    </div>
  );
}

export function DetailsForm({ slug, party, startsAt, restaurant }: { slug: string; party: number; startsAt: string; restaurant: string }) {
  return (
    <ActionForm action={reserve.bind(null, slug)} submit="Confirm reservation" size="lg" className="space-y-4">
      <input type="hidden" name="party" value={party} />
      <input type="hidden" name="startsAt" value={startsAt} />
      {/* Honeypot: hidden from people, tempting to bots. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <Field label="Full name"><Input name="name" required autoComplete="name" maxLength={120} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email" hint="We send your confirmation here."><Input name="email" type="email" required autoComplete="email" /></Field>
        <Field label="Phone (optional)" hint="In case the restaurant needs to reach you."><Input name="phone" type="tel" autoComplete="tel" inputMode="tel" /></Field>
      </div>
      <Field label="Anything we should know? (optional)"><Textarea name="notes" rows={2} maxLength={500} placeholder="Allergies, a celebration, a high chair" /></Field>
      <MarketingConsent restaurant={restaurant} />
    </ActionForm>
  );
}

const HALF_HOURS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2), m = (i % 2) * 30;
  return { value: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`, label: `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}` };
}).filter((t) => t.value >= "10:00" || t.value === "00:00");

export function WaitlistForm({ slug, party, date, restaurant }: { slug: string; party: number; date: string; restaurant: string }) {
  return (
    <ActionForm action={joinWaitlist.bind(null, slug)} submit="Join the waitlist" size="md" className="space-y-3">
      <input type="hidden" name="party" value={party} />
      <input type="hidden" name="date" value={date} />
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Earliest time"><Select name="from" defaultValue="17:00">{HALF_HOURS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select></Field>
        <Field label="Latest time"><Select name="to" defaultValue="20:00">{HALF_HOURS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select></Field>
      </div>
      <Field label="Full name"><Input name="name" required autoComplete="name" maxLength={120} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Email"><Input name="email" type="email" required autoComplete="email" /></Field>
        <Field label="Phone (optional)"><Input name="phone" type="tel" autoComplete="tel" inputMode="tel" /></Field>
      </div>
      <MarketingConsent restaurant={restaurant} />
    </ActionForm>
  );
}

/** "Get offers and news": an email sign-up that stands on its own, for people who are not booking right now. */
export function SignupForm({ slug, restaurant }: { slug: string; restaurant: string }) {
  return (
    <ActionForm action={signUpForUpdates.bind(null, slug)} submit="Sign me up" size="md" className="space-y-3">
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name (optional)"><Input name="name" autoComplete="name" maxLength={120} /></Field>
        <Field label="Email"><Input name="email" type="email" required autoComplete="email" /></Field>
      </div>
      <p className="text-[13px] text-label-2">By signing up you agree to receive occasional offers and news by email from {restaurant}. You can opt out at any time by replying to any of our emails.</p>
    </ActionForm>
  );
}
