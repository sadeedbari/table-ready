"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Phone, Plus, Printer, StickyNote, Users } from "lucide-react";
import { ActionButton, ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { buttonClass } from "@/components/ui/button-class";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Badge, Card } from "@/components/ui/misc";
import { Sheet } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { readyMessage, smsLink, telLink } from "@/lib/queue";
import { addWalkin, setQueueOpen, setWalkinStatus } from "../actions";
import type { Walkin } from "@/lib/types";

/** Refreshes the list every 15 seconds so a host on a tablet sees parties that joined from their phones. */
export function Poller() {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, 15_000);
    return () => clearInterval(id);
  }, [router]);
  return null;
}

/** "12 min" since a time, ticking every 30 seconds. */
function Elapsed({ since }: { since: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 30_000);
    return () => { clearTimeout(first); clearInterval(id); };
  }, []);
  if (now === null) return <span>&nbsp;</span>;
  const m = Math.max(0, Math.floor((now - new Date(since).getTime()) / 60_000));
  return <span>{m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`}</span>;
}

export function QueueRow({ slug, restaurant, walkin: w, place }: { slug: string; restaurant: string; walkin: Walkin; place: number | null; last?: boolean }) {
  const set = (s: Walkin["status"]) => () => setWalkinStatus(slug, w.id, s);
  const ready = w.status === "ready";
  return (
    <Card className={`flex flex-wrap items-start gap-x-5 gap-y-3 !p-4 ${ready ? "ring-2 ring-[var(--accent)]" : ""}`}>
      <div className="w-[64px] shrink-0 text-center">
        <div className="text-[26px] font-semibold leading-none" style={{ fontFamily: "var(--font-display)" }}>{ready ? "✓" : place}</div>
        <div className="mt-1 text-[12px] text-label-3">{ready ? "ready" : "in line"}</div>
      </div>
      <div className="min-w-[200px] flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[17px] font-semibold">{w.guest_name}</span>
          <Badge tone={ready ? "green" : "orange"}>{ready ? "Table ready" : "Waiting"}</Badge>
          {w.source === "online" && <Badge>Joined online</Badge>}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] text-label-2">
          <span className="inline-flex items-center gap-1"><Users className="size-4" aria-hidden />{w.party_size}</span>
          <span>Waiting <Elapsed since={w.joined_at} />{w.quoted_minutes !== null ? ` · quoted ${w.quoted_minutes} min` : ""}</span>
          {w.phone ? <span className="inline-flex items-center gap-1"><Phone className="size-4" aria-hidden />{w.phone}</span> : <span className="text-label-3">No phone saved</span>}
          {w.email && <span>{w.email}</span>}
        </div>
        {w.notes && <p className="mt-1.5 inline-flex items-start gap-1.5 text-[14px] text-label-2"><StickyNote className="mt-0.5 size-4 shrink-0" aria-hidden />{w.notes}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {w.status === "waiting" && <ActionButton action={set("ready")} variant="filled" size="md">Table ready</ActionButton>}
        {w.phone && (
          <>
            <a href={telLink(w.phone)} className={buttonClass("tinted", "sm")}><Phone className="size-4" aria-hidden />Call</a>
            <a href={smsLink(w.phone, readyMessage(restaurant, w.party_size))} className={buttonClass("tinted", "sm")}><MessageSquare className="size-4" aria-hidden />Text</a>
          </>
        )}
        <ActionButton action={set("seated")} variant={ready ? "filled" : "gray"}>Seated</ActionButton>
        {ready && <ActionButton action={set("waiting")} variant="plain">Back in line</ActionButton>}
        <ActionButton action={set("cancelled")} variant="destructive" confirm={`Remove ${w.guest_name} from the line?`}>{ready ? "No-show" : "Left"}</ActionButton>
      </div>
    </Card>
  );
}

export function AddWalkin({ slug, suggested }: { slug: string; suggested: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} variant="filled"><Plus className="size-4" aria-hidden />Add a party</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Add a party to the line" subtitle="Save their phone number so you can call or text when the table is ready.">
        <ActionForm action={addWalkin.bind(null, slug)} submit="Add to line" onDone={() => setOpen(false)}>
          <Field label="Name"><Input name="name" required autoFocus maxLength={120} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Guests"><Input name="party" type="number" min={1} max={50} defaultValue={2} required inputMode="numeric" /></Field>
            <Field label="Quoted wait (min)" hint={`Suggested ${suggested}`}><Input name="quoted" type="number" min={0} max={600} defaultValue={suggested} inputMode="numeric" /></Field>
          </div>
          <Field label="Phone"><Input name="phone" type="tel" inputMode="tel" autoComplete="off" placeholder="416 555 0123" /></Field>
          <Field label="Email (optional)" hint="We email them automatically when you mark the table ready."><Input name="email" type="email" autoComplete="off" /></Field>
          <Field label="Notes (optional)"><Textarea name="notes" rows={2} maxLength={300} placeholder="Wants a booth, high chair, prefers the patio" /></Field>
        </ActionForm>
      </Sheet>
    </>
  );
}

export function JoinLinkCard({ slug, url, qrSvg, open, canEdit }: { slug: string; url: string; qrSvg: string; open: boolean; canEdit: boolean }) {
  return (
    <Card className="mt-8">
      <h2 className="text-[20px]">Let guests join from their phone</h2>
      <p className="mt-1 text-[14px] text-label-2">Print this QR code for your door. Guests enter their name and number, see their place in line, and are told when their table is ready.</p>
      <div className="mt-4 flex flex-wrap items-start gap-6">
        <div className="size-40 shrink-0 overflow-hidden rounded-[14px] bg-white p-1 hairline" role="img" aria-label={`QR code for ${url}`} dangerouslySetInnerHTML={{ __html: qrSvg }} />
        <div className="min-w-[220px] flex-1 space-y-4">
          <p className="rounded-[12px] bg-surface-2 px-3.5 py-2.5 font-mono text-[14px] break-all select-all">{url}</p>
          <ActionForm action={setQueueOpen.bind(null, slug)} submit={canEdit ? "Save" : null} size="sm">
            <div className="flex items-center gap-3">
              <Switch name="queue_open" defaultChecked={open} label="Guests can join the line online" disabled={!canEdit} />
              <span className="text-[15px]">Guests can join the line online</span>
            </div>
          </ActionForm>
          <Button type="button" variant="gray" size="sm" onClick={() => window.print()}><Printer className="size-4" aria-hidden />Print this page</Button>
        </div>
      </div>
    </Card>
  );
}
