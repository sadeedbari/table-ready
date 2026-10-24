import { TZDate } from "@date-fns/tz";
import { addDaysToKey, todayKey, weekdayOfKey } from "@/lib/format";
import type { Closure, DiningTable, Reservation, Restaurant, ServicePeriod, TurnRule } from "@/lib/types";

/** "17:30:00" or "17:30" -> minutes after midnight. */
export function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function minutesToTime(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

/** How long a party of this size keeps its table. Mirrors book_table() in the database. */
export function turnMinutes(rules: TurnRule[], party: number): number {
  const sorted = [...rules].sort((a, b) => a.upTo - b.upTo);
  return (sorted.find((r) => r.upTo >= party) ?? sorted[sorted.length - 1])?.minutes ?? 120;
}

/** The instant at a local wall-clock time ("YYYY-MM-DD", minutes after midnight) in a time zone. */
export function instantAt(dateKey: string, minutes: number, timeZone: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(new TZDate(y, m - 1, d, Math.floor(minutes / 60), minutes % 60, 0, timeZone).getTime());
}

export interface Slot { time: string; minutes: number; startsAt: string; period: string }

interface SlotInput {
  restaurant: Pick<Restaurant, "timezone" | "slot_interval_minutes" | "min_notice_minutes" | "max_advance_days" | "max_party_size" | "turn_times" | "online_enabled">;
  periods: ServicePeriod[];
  tables: DiningTable[];
  closures: Pick<Closure, "on_date">[];
  /** Reservations that hold a table on that day (confirmed or seated). */
  reservations: Pick<Reservation, "table_id" | "starts_at" | "ends_at" | "status">[];
  dateKey: string;
  party: number;
  now?: Date;
}

/**
 * The times a guest can pick for a party on a date: inside an opening window, in the allowed booking range, and with at least
 * one online table that fits and is free for the whole stay. The database re-checks when the guest confirms, so a race is safe.
 */
export function availableSlots(input: SlotInput): Slot[] {
  const { restaurant: r, periods, tables, closures, reservations, dateKey, party } = input;
  const now = input.now ?? new Date();
  if (!r.online_enabled || party < 1 || party > r.max_party_size) return [];
  if (closures.some((c) => c.on_date === dateKey)) return [];
  const today = todayKey(r.timezone);
  if (dateKey < today || dateKey > addDaysToKey(today, r.max_advance_days)) return [];

  const weekday = weekdayOfKey(dateKey);
  const candidates = tables.filter((t) => t.active && t.online && t.seats >= party);
  if (candidates.length === 0) return [];
  const stay = turnMinutes(r.turn_times, party) * 60_000;
  const earliest = now.getTime() + r.min_notice_minutes * 60_000;
  const live = reservations.filter((x) => (x.status === "confirmed" || x.status === "seated") && x.table_id);

  const seen = new Set<number>();
  const out: Slot[] = [];
  for (const p of periods) {
    if (!p.active || !p.days.includes(weekday)) continue;
    for (let m = toMinutes(p.opens); m <= toMinutes(p.last_seating); m += r.slot_interval_minutes) {
      if (seen.has(m)) continue;
      const start = instantAt(dateKey, m, r.timezone);
      if (start.getTime() < earliest) continue;
      const end = start.getTime() + stay;
      const free = candidates.some((t) =>
        !live.some((x) => x.table_id === t.id && new Date(x.starts_at).getTime() < end && new Date(x.ends_at).getTime() > start.getTime()),
      );
      if (!free) continue;
      seen.add(m);
      out.push({ time: minutesToTime(m), minutes: m, startsAt: start.toISOString(), period: p.name });
    }
  }
  return out.sort((a, b) => a.minutes - b.minutes);
}

/** Days in the booking range that have opening hours and are not closed: what the date picker can offer. */
export function openDays(r: Pick<Restaurant, "timezone" | "max_advance_days">, periods: ServicePeriod[], closures: Pick<Closure, "on_date">[]): string[] {
  const today = todayKey(r.timezone);
  const out: string[] = [];
  for (let i = 0; i <= r.max_advance_days; i++) {
    const key = addDaysToKey(today, i);
    if (closures.some((c) => c.on_date === key)) continue;
    const wd = weekdayOfKey(key);
    if (periods.some((p) => p.active && p.days.includes(wd))) out.push(key);
  }
  return out;
}
