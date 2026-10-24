"use client";
import { ActionButton, ActionForm } from "@/components/ui/action-form";
import { Card } from "@/components/ui/misc";
import { Field, Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { deleteTable, saveTable } from "../actions";
import type { DiningTable } from "@/lib/types";

export function TableEditor({ slug, table, disabled }: { slug: string; table: DiningTable; disabled?: boolean }) {
  return (
    <Card className="!p-4">
      <ActionForm action={saveTable.bind(null, slug, table.id)} submit={disabled ? null : "Save"} size="sm" className="flex flex-wrap items-end gap-x-4 gap-y-3 space-y-0"
        footer={disabled ? undefined : <ActionButton action={() => deleteTable(slug, table.id)} variant="destructive" confirm={`Remove table ${table.name}? Past reservations keep their history.`}>Remove</ActionButton>}>
        <Field label="Name" className="w-28"><Input name="name" defaultValue={table.name} required maxLength={30} disabled={disabled} /></Field>
        <Field label="Seats" className="w-24"><Input name="seats" type="number" min={1} max={50} defaultValue={table.seats} required inputMode="numeric" disabled={disabled} /></Field>
        <div className="flex items-center gap-2 pb-2.5"><Switch name="online" defaultChecked={table.online} label="Open to online guests" disabled={disabled} /><span className="text-[14px]">Open online</span></div>
        <div className="flex items-center gap-2 pb-2.5"><Switch name="active" defaultChecked={table.active} label="In use" disabled={disabled} /><span className="text-[14px]">In use</span></div>
      </ActionForm>
    </Card>
  );
}

export function NewTable({ slug }: { slug: string }) {
  return (
    <Card className="mt-6 !p-4">
      <h2 className="mb-3 text-[17px]">Add a table</h2>
      <ActionForm action={saveTable.bind(null, slug, null)} submit="Add table" resetOnSuccess size="sm" className="flex flex-wrap items-end gap-x-4 gap-y-3 space-y-0">
        <Field label="Name" className="w-28"><Input name="name" required maxLength={30} placeholder="T7" /></Field>
        <Field label="Seats" className="w-24"><Input name="seats" type="number" min={1} max={50} defaultValue={4} required inputMode="numeric" /></Field>
        <div className="flex items-center gap-2 pb-2.5"><Switch name="online" defaultChecked label="Open to online guests" /><span className="text-[14px]">Open online</span></div>
      </ActionForm>
    </Card>
  );
}
