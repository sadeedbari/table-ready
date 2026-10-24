"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { ActionButton, ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { addReservation, setReservationStatus } from "./actions";
import type { DiningTable, ReservationStatus } from "@/lib/types";

export function RowActions({ slug, id, status }: { slug: string; id: string; status: ReservationStatus }) {
  const set = (s: ReservationStatus) => () => setReservationStatus(slug, id, s);
  if (status === "confirmed") {
    return (
      <>
        <ActionButton action={set("seated")} variant="filled">Seat</ActionButton>
        <ActionButton action={set("no_show")}>No-show</ActionButton>
        <ActionButton action={set("cancelled")} variant="destructive" confirm="Cancel this reservation? The guest is emailed.">Cancel</ActionButton>
      </>
    );
  }
  if (status === "seated") return <ActionButton action={set("completed")} variant="filled">Finished</ActionButton>;
  if (status === "no_show" || status === "completed") return <ActionButton action={set("confirmed")} variant="plain">Reopen</ActionButton>;
  return null;
}

export function AddReservation({ slug, date, tables }: { slug: string; date: string; tables: DiningTable[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} variant="filled"><Plus className="size-4" aria-hidden />Add reservation</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Add a reservation" subtitle="For phone calls and walk-ups. Online limits do not apply.">
        <ActionForm action={addReservation.bind(null, slug)} submit="Add reservation" onDone={() => setOpen(false)}>
          <Field label="Guest name"><Input name="name" required autoFocus maxLength={120} /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Guests"><Input name="party" type="number" min={1} max={50} defaultValue={2} required inputMode="numeric" /></Field>
            <Field label="Date"><Input name="date" type="date" defaultValue={date} required /></Field>
            <Field label="Time"><Input name="time" type="time" step={900} defaultValue="18:00" required /></Field>
          </div>
          <Field label="Table" hint="Automatic picks the smallest free table that fits.">
            <Select name="table" defaultValue="">
              <option value="">Automatic</option>
              {tables.map((t) => <option key={t.id} value={t.id}>{t.name} (seats {t.seats})</option>)}
            </Select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Phone (optional)"><Input name="phone" type="tel" inputMode="tel" autoComplete="off" /></Field>
            <Field label="Email (optional)" hint="Used to send a confirmation."><Input name="email" type="email" autoComplete="off" /></Field>
          </div>
          <Field label="Notes (optional)"><Textarea name="notes" rows={2} maxLength={500} placeholder="Birthday, high chair, allergies" /></Field>
        </ActionForm>
      </Sheet>
    </>
  );
}
