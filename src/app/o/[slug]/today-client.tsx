"use client";
import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { ActionButton, ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { addReservation, editReservation, setReservationStatus } from "./actions";
import type { DiningTable, ReservationStatus } from "@/lib/types";

export interface EditValues { name: string; party: number; startLocal: string; email: string; phone: string; notes: string; tableId: string }

export function RowActions({ slug, id, status, tables, edit }: { slug: string; id: string; status: ReservationStatus; tables: DiningTable[]; edit: EditValues }) {
  const set = (s: ReservationStatus) => () => setReservationStatus(slug, id, s);
  const editor = <EditReservation slug={slug} id={id} tables={tables} values={edit} />;
  if (status === "confirmed") {
    return (
      <>
        <ActionButton action={set("seated")} variant="filled">Seat</ActionButton>
        {editor}
        <ActionButton action={set("no_show")}>No-show</ActionButton>
        <ActionButton action={set("cancelled")} variant="destructive" confirm="Cancel this reservation? The guest is emailed.">Cancel</ActionButton>
      </>
    );
  }
  if (status === "seated") return <><ActionButton action={set("completed")} variant="filled">Finished</ActionButton>{editor}</>;
  if (status === "no_show" || status === "completed") return <ActionButton action={set("confirmed")} variant="plain">Reopen</ActionButton>;
  return null;
}

/** Change a booking after the guest phones: time, number of guests, table, contact details. The guest can be emailed the new details. */
function EditReservation({ slug, id, tables, values }: { slug: string; id: string; tables: DiningTable[]; values: EditValues }) {
  const [open, setOpen] = useState(false);
  const [date, time] = values.startLocal.split("T");
  const [email, setEmail] = useState(values.email);
  return (
    <>
      <Button type="button" size="sm" variant="gray" onClick={() => setOpen(true)}><Pencil className="size-3.5" aria-hidden />Edit</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Edit reservation" subtitle="Staff changes ignore the online booking limits. The table is checked so two parties are never booked together.">
        <ActionForm action={editReservation.bind(null, slug, id)} submit="Save changes" onDone={() => setOpen(false)}>
          <Field label="Guest name"><Input name="name" required maxLength={120} defaultValue={values.name} /></Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Guests"><Input name="party" type="number" min={1} max={50} defaultValue={values.party} required inputMode="numeric" /></Field>
            <Field label="Date" className="min-w-0"><Input name="date" type="date" defaultValue={date} required /></Field>
            <Field label="Time" className="min-w-0"><Input name="time" type="time" step={900} defaultValue={time} required /></Field>
          </div>
          <Field label="Table" hint="Keep means: stay at the current table if it still fits and is free, otherwise pick the smallest free table that fits.">
            <Select name="table" defaultValue="">
              <option value="">Keep or choose automatically</option>
              {tables.map((t) => <option key={t.id} value={t.id}>{t.name} (seats {t.seats}){t.id === values.tableId ? " · current" : ""}</option>)}
            </Select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Phone (optional)"><Input name="phone" type="tel" inputMode="tel" autoComplete="off" defaultValue={values.phone} /></Field>
            <Field label="Email (optional)"><Input name="email" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          </div>
          <Field label="Notes (optional)"><Textarea name="notes" rows={2} maxLength={500} defaultValue={values.notes} /></Field>
          <label className={`flex items-start gap-3 rounded-[12px] bg-surface-2 px-3.5 py-3 text-[14px] ${email ? "cursor-pointer" : "opacity-60"}`}>
            <input type="checkbox" name="notify" defaultChecked disabled={!email} className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]" />
            <span><span className="font-medium">Email the guest the updated reservation</span><span className="block text-label-2">{email ? "Sent only if the time or number of guests changed." : "Add an email address to send an update."}</span></span>
          </label>
        </ActionForm>
      </Sheet>
    </>
  );
}

export function AddReservation({ slug, date, tables }: { slug: string; date: string; tables: DiningTable[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} variant="filled"><Plus className="size-4" aria-hidden />Add reservation</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Add a reservation" subtitle="For phone calls and walk-ups. Online limits do not apply.">
        <ActionForm action={addReservation.bind(null, slug)} submit="Add reservation" onDone={() => setOpen(false)}>
          <Field label="Guest name"><Input name="name" required autoFocus maxLength={120} /></Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Guests"><Input name="party" type="number" min={1} max={50} defaultValue={2} required inputMode="numeric" /></Field>
            <Field label="Date" className="min-w-0"><Input name="date" type="date" defaultValue={date} required /></Field>
            <Field label="Time" className="min-w-0"><Input name="time" type="time" step={900} defaultValue="18:00" required /></Field>
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
