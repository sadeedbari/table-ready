"use client";
import { useState } from "react";
import { Megaphone } from "lucide-react";
import { ActionButton, ActionForm } from "@/components/ui/action-form";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Badge, Card } from "@/components/ui/misc";
import { formatDateTime } from "@/lib/format";
import { endAfter, type NoticeState } from "@/lib/notices";
import { addNotice, deleteNotice, endNotice } from "../actions";

export interface NoticeRow {
  id: string;
  message: string;
  starts_at: string;
  ends_at: string;
  show_reservations: boolean;
  show_queue: boolean;
  state: NoticeState;
}

const QUICK = [
  { label: "30 min", minutes: 30 },
  { label: "1 hour", minutes: 60 },
  { label: "2 hours", minutes: 120 },
  { label: "4 hours", minutes: 240 },
];

const STATE_LABEL: Record<NoticeState, { text: string; tone: "green" | "orange" | "gray" }> = {
  active: { text: "Showing now", tone: "green" },
  scheduled: { text: "Scheduled", tone: "orange" },
  ended: { text: "Ended", tone: "gray" },
};

const where = (n: Pick<NoticeRow, "show_reservations" | "show_queue">) =>
  n.show_reservations && n.show_queue ? "Reservations, waitlist and walk-in line" : n.show_reservations ? "Reservations and waitlist" : "Walk-in line";

export function NoticesSection({ slug, timeZone, notices }: { slug: string; timeZone: string; notices: NoticeRow[] }) {
  const [end, setEnd] = useState("");
  const [start, setStart] = useState("");
  const [len, setLen] = useState(0);
  const quick = (minutes: number) => setEnd(endAfter(minutes, timeZone, start));
  return (
    <section>
      <h2 className="mb-1 flex items-center gap-2 text-[20px]"><Megaphone className="size-5 text-accent-text" aria-hidden />Guest notice</h2>
      <p className="mb-3 text-[14px] text-label-2">
        Tell guests about something that makes your wait times unreliable, like a backed-up kitchen or a short-staffed night. It shows at the top of your reservation page
        (and the waitlist on it) and your walk-in line, and takes itself down when the end time passes. Times are in your restaurant&apos;s time zone ({timeZone.replace(/_/g, " ")}).
      </p>
      <Card className="mb-4">
        <ActionForm action={addNotice.bind(null, slug)} submit="Show this notice" resetOnSuccess onDone={() => { setEnd(""); setStart(""); setLen(0); }}>
          <Field label="Message guests will see" hint={`${len}/300`}>
            <Textarea name="message" rows={2} maxLength={300} required placeholder="The kitchen is running behind tonight, so waits are longer than quoted. Thank you for your patience." onChange={(e) => setLen(e.target.value.length)} />
          </Field>
          <fieldset>
            <legend className="px-1 pb-1.5 text-[13px] font-medium text-label-2">Show it on</legend>
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-[15px]"><input type="checkbox" name="show_reservations" defaultChecked className="size-5 accent-[var(--accent)]" />Reservations and waitlist</label>
              <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-[15px]"><input type="checkbox" name="show_queue" defaultChecked className="size-5 accent-[var(--accent)]" />Walk-in line</label>
            </div>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Starts" hint="Leave empty to show it right away.">
              <Input name="starts" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="min-w-0" />
            </Field>
            <Field label="Ends (it disappears then)">
              <Input name="ends" type="datetime-local" required value={end} onChange={(e) => setEnd(e.target.value)} className="min-w-0" />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] text-label-2">Quick end (after the start):</span>
            {QUICK.map((q) => (
              <button key={q.minutes} type="button" onClick={() => quick(q.minutes)} className="inline-flex h-10 items-center rounded-full bg-surface-2 px-4 text-[14px] font-medium hover:bg-surface-3">
                In {q.label}
              </button>
            ))}
          </div>
        </ActionForm>
      </Card>

      {notices.length > 0 && (
        <ul className="mb-6 space-y-3">
          {notices.map((n) => (
            <li key={n.id}>
              <Card className="!p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2"><Badge tone={STATE_LABEL[n.state].tone}>{STATE_LABEL[n.state].text}</Badge><span className="text-[13px] text-label-2">{where(n)}</span></div>
                    <p className="text-[15px] font-medium">{n.message}</p>
                    <p className="mt-1 text-[13px] text-label-2">{formatDateTime(n.starts_at, timeZone)} to {formatDateTime(n.ends_at, timeZone)}</p>
                  </div>
                  <div className="flex gap-2">
                    {n.state === "active" && <ActionButton action={endNotice.bind(null, slug, n.id)} variant="tinted">End now</ActionButton>}
                    {n.state === "scheduled" && <ActionButton action={deleteNotice.bind(null, slug, n.id)} variant="destructive" confirm="Cancel this scheduled notice?">Cancel</ActionButton>}
                    {n.state === "ended" && <ActionButton action={deleteNotice.bind(null, slug, n.id)} variant="plain">Delete</ActionButton>}
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
