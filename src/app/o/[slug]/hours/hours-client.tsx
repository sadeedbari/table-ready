"use client";
import { ActionButton, ActionForm } from "@/components/ui/action-form";
import { Card } from "@/components/ui/misc";
import { Field, Input, Select } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { formatDate } from "@/lib/format";
import { addClosure, deleteClosure, deletePeriod, savePeriod, saveRules } from "../actions";
import type { Closure, Restaurant, ServicePeriod } from "@/lib/types";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function DayPicker({ selected, disabled }: { selected: number[]; disabled?: boolean }) {
  return (
    <fieldset className="min-w-0">
      <legend className="px-1 pb-1.5 text-[13px] font-medium text-label-2">Days</legend>
      <div className="flex flex-wrap gap-1.5">
        {DAYS.map((d, i) => (
          <label key={d} className="cursor-pointer">
            <input type="checkbox" name="days" value={i} defaultChecked={selected.includes(i)} disabled={disabled} className="peer sr-only" />
            <span className="inline-flex h-10 min-w-12 items-center justify-center rounded-full bg-surface-2 px-3 text-[14px] font-medium text-label-2 transition-colors peer-checked:bg-accent-fill peer-checked:text-white peer-focus-visible:shadow-[var(--ring)] peer-disabled:opacity-50">{d}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function PeriodEditor({ slug, period, disabled }: { slug: string; period: ServicePeriod; disabled?: boolean }) {
  return (
    <Card className="!p-4">
      <ActionForm
        action={savePeriod.bind(null, slug, period.id)}
        submit={disabled ? null : "Save"}
        size="sm"
        footer={disabled ? undefined : <ActionButton action={() => deletePeriod(slug, period.id)} variant="destructive" confirm={`Remove ${period.name}?`}>Remove</ActionButton>}
      >
        <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-end sm:gap-x-4">
          <Field label="Name" className="sm:w-40"><Input name="name" defaultValue={period.name} required maxLength={40} disabled={disabled} /></Field>
          <Field label="Opens" className="min-w-0"><Input name="opens" type="time" defaultValue={period.opens.slice(0, 5)} required disabled={disabled} /></Field>
          <Field label="Last seating" className="min-w-0"><Input name="last_seating" type="time" defaultValue={period.last_seating.slice(0, 5)} required disabled={disabled} /></Field>
          <div className="flex items-center gap-2 sm:pb-2.5"><Switch name="active" defaultChecked={period.active} label="Active" disabled={disabled} /><span className="text-[14px]">Active</span></div>
        </div>
        <DayPicker selected={period.days} disabled={disabled} />
      </ActionForm>
    </Card>
  );
}

export function NewPeriod({ slug }: { slug: string }) {
  return (
    <Card className="mt-4 !p-4">
      <h3 className="mb-3 text-[17px]">Add a service</h3>
      <ActionForm action={savePeriod.bind(null, slug, null)} submit="Add service" resetOnSuccess size="sm">
        <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-end sm:gap-x-4">
          <Field label="Name" className="sm:w-40"><Input name="name" required maxLength={40} placeholder="Lunch" /></Field>
          <Field label="Opens" className="min-w-0"><Input name="opens" type="time" defaultValue="11:30" required /></Field>
          <Field label="Last seating" className="min-w-0"><Input name="last_seating" type="time" defaultValue="14:00" required /></Field>
        </div>
        <DayPicker selected={[1, 2, 3, 4, 5]} />
      </ActionForm>
    </Card>
  );
}

export function ClosureList({ slug, closures, disabled }: { slug: string; closures: Closure[]; disabled?: boolean }) {
  return (
    <Card className="!p-4">
      {closures.length > 0 && (
        <ul className="mb-4 divide-y divide-separator">
          {closures.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 py-2">
              <span className="text-[15px]">{formatDate(`${c.on_date}T12:00:00Z`, "UTC", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}{c.note ? <span className="text-label-2"> · {c.note}</span> : null}</span>
              {!disabled && <ActionButton action={() => deleteClosure(slug, c.id)} variant="plain">Reopen</ActionButton>}
            </li>
          ))}
        </ul>
      )}
      {!disabled && (
        <ActionForm action={addClosure.bind(null, slug)} submit="Mark closed" resetOnSuccess size="sm" className="grid grid-cols-1 gap-3 space-y-0 sm:flex sm:flex-wrap sm:items-end sm:gap-x-4">
          <Field label="Date" className="min-w-0"><Input name="on_date" type="date" required /></Field>
          <Field label="Note (optional)" className="min-w-0 sm:w-56"><Input name="note" maxLength={80} placeholder="Private event" /></Field>
        </ActionForm>
      )}
      {disabled && closures.length === 0 && <p className="text-[14px] text-label-2">No closures.</p>}
    </Card>
  );
}

export function RulesForm({ slug, r, disabled }: { slug: string; r: Restaurant; disabled?: boolean }) {
  const turn = (upTo: number) => [...r.turn_times].sort((a, b) => a.upTo - b.upTo).find((t) => t.upTo >= upTo)?.minutes ?? 90;
  return (
    <Card className="mt-2">
      <ActionForm action={saveRules.bind(null, slug)} submit={disabled ? null : "Save rules"}>
        <div className="flex items-center justify-between gap-4 rounded-[12px] bg-surface-2 px-4 py-3">
          <div><div className="text-[15px] font-medium">Take online reservations</div><div className="text-[13px] text-label-2">Turn off to pause online booking. Your host list keeps working.</div></div>
          <Switch name="online_enabled" defaultChecked={r.online_enabled} label="Take online reservations" disabled={disabled} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Time step" hint="How often start times are offered.">
            <Select name="slot_interval_minutes" defaultValue={r.slot_interval_minutes} disabled={disabled}>
              {[10, 15, 20, 30, 60].map((n) => <option key={n} value={n}>Every {n} minutes</option>)}
            </Select>
          </Field>
          <Field label="Largest party online" hint="Bigger groups call the restaurant."><Input name="max_party_size" type="number" min={1} max={50} defaultValue={r.max_party_size} inputMode="numeric" disabled={disabled} /></Field>
          <Field label="Book up to (days ahead)"><Input name="max_advance_days" type="number" min={1} max={365} defaultValue={r.max_advance_days} inputMode="numeric" disabled={disabled} /></Field>
          <Field label="Minimum notice (minutes)" hint="No online bookings closer than this."><Input name="min_notice_minutes" type="number" min={0} defaultValue={r.min_notice_minutes} inputMode="numeric" disabled={disabled} /></Field>
          <Field label="Cancel up to (hours before)" hint="Guests can cancel themselves until then."><Input name="cancellation_window_hours" type="number" min={0} max={168} defaultValue={r.cancellation_window_hours} inputMode="numeric" disabled={disabled} /></Field>
        </div>
        <div>
          <h3 className="mb-2 text-[15px] font-medium">How long a party keeps its table (minutes)</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="1 to 2 guests"><Input name="t2" type="number" min={15} max={480} defaultValue={turn(2)} inputMode="numeric" disabled={disabled} /></Field>
            <Field label="3 to 4 guests"><Input name="t4" type="number" min={15} max={480} defaultValue={turn(4)} inputMode="numeric" disabled={disabled} /></Field>
            <Field label="5 to 6 guests"><Input name="t6" type="number" min={15} max={480} defaultValue={turn(6)} inputMode="numeric" disabled={disabled} /></Field>
            <Field label="7 or more"><Input name="t99" type="number" min={15} max={480} defaultValue={turn(99)} inputMode="numeric" disabled={disabled} /></Field>
          </div>
        </div>
      </ActionForm>
    </Card>
  );
}
