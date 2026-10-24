"use client";
import { useState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Field, Input, Select } from "@/components/ui/input";
import { allTimeZones } from "@/lib/timezones";
import { slugify } from "@/lib/utils";
import { createRestaurant } from "./actions";

export function OnboardingForm({ defaultName }: { defaultName: string }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [touched, setTouched] = useState(false);
  const zones = allTimeZones();
  const detected = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "America/Toronto";
  return (
    <ActionForm action={createRestaurant} submit="Create restaurant" size="lg" className="space-y-4">
      <Field label="Restaurant name">
        <Input
          name="name"
          required
          maxLength={80}
          placeholder="Casa Verde"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!touched) setSlug(slugify(e.target.value));
          }}
        />
      </Field>
      <Field label="Your reservation link" hint={`tableready.sulosystems.com/${slug || "your-restaurant"}`}>
        <Input name="slug" required minLength={3} maxLength={40} value={slug} onChange={(e) => { setTouched(true); setSlug(slugify(e.target.value)); }} />
      </Field>
      <Field label="Your name (shown to your team)">
        <Input name="display_name" defaultValue={defaultName} maxLength={60} />
      </Field>
      <Field label="Time zone">
        <Select name="timezone" defaultValue={zones.includes(detected) ? detected : "America/Toronto"}>
          {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
        </Select>
      </Field>
    </ActionForm>
  );
}
