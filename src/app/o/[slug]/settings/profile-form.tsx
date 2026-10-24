"use client";
import { ActionForm } from "@/components/ui/action-form";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { allTimeZones } from "@/lib/timezones";
import { saveProfile } from "../actions";
import type { Restaurant } from "@/lib/types";

export function ProfileForm({ slug, r, disabled }: { slug: string; r: Restaurant; disabled?: boolean }) {
  const zones = allTimeZones();
  return (
    <ActionForm action={saveProfile.bind(null, slug)} submit={disabled ? null : "Save"}>
      <Field label="Name"><Input name="name" defaultValue={r.name} required maxLength={80} disabled={disabled} /></Field>
      <Field label="About (shown on your reservation page)"><Textarea name="description" defaultValue={r.description ?? ""} rows={3} maxLength={500} disabled={disabled} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Phone"><Input name="phone" type="tel" defaultValue={r.phone ?? ""} maxLength={40} disabled={disabled} /></Field>
        <Field label="Website"><Input name="website" defaultValue={r.website ?? ""} maxLength={200} disabled={disabled} /></Field>
      </div>
      <Field label="Address"><Input name="address" defaultValue={r.address ?? ""} maxLength={200} disabled={disabled} /></Field>
      <Field label="Time zone">
        <Select name="timezone" defaultValue={r.timezone} disabled={disabled}>
          {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
        </Select>
      </Field>
    </ActionForm>
  );
}
