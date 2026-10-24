import { instantAt, toMinutes } from "@/lib/hours";

export type NoticeState = "active" | "scheduled" | "ended";

export interface NoticeTimes { starts_at: string; ends_at: string }

/** Whether a notice is showing now, will show later, or is over. */
export function noticeState(n: NoticeTimes, now: number): NoticeState {
  if (new Date(n.ends_at).getTime() <= now) return "ended";
  if (new Date(n.starts_at).getTime() > now) return "scheduled";
  return "active";
}

/** "2026-10-25T19:30" typed in a restaurant's time zone -> the real instant (ISO), or null if it is not a date and time. */
export function parseLocalInput(value: string, timeZone: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(value.trim());
  if (!m) return null;
  const d = instantAt(m[1], toMinutes(m[2]), timeZone);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** An instant as "YYYY-MM-DDTHH:mm" in a time zone: the format a datetime-local field uses. */
export function toLocalInput(date: Date, timeZone: string): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** The "Ends" value for a quick button: that many minutes after the start the person typed, or after right now when they left it empty. */
export function endAfter(minutes: number, timeZone: string, startValue: string): string {
  const startIso = startValue ? parseLocalInput(startValue, timeZone) : null;
  const from = startIso ? new Date(startIso).getTime() : Date.now();
  return toLocalInput(new Date(from + minutes * 60_000), timeZone);
}
