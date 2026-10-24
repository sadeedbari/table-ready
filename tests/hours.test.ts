import test from "node:test";
import assert from "node:assert/strict";
import { availableSlots, openDays, turnMinutes, toMinutes } from "../src/lib/hours";
import { addDaysToKey, todayKey } from "../src/lib/format";
import type { DiningTable, ServicePeriod } from "../src/lib/types";

const restaurant = {
  timezone: "America/Toronto",
  slot_interval_minutes: 30,
  min_notice_minutes: 60,
  max_advance_days: 30,
  max_party_size: 6,
  online_enabled: true,
  turn_times: [{ upTo: 2, minutes: 60 }, { upTo: 99, minutes: 120 }],
};
const table = (id: string, seats: number, extra: Partial<DiningTable> = {}): DiningTable => ({ id, restaurant_id: "r", name: id, seats, online: true, active: true, position: 0, ...extra });
const dinner: ServicePeriod = { id: "p", restaurant_id: "r", name: "Dinner", days: [0, 1, 2, 3, 4, 5, 6], opens: "17:00", last_seating: "19:00", active: true };
const today = todayKey("America/Toronto");
const tomorrow = addDaysToKey(today, 1);
const base = { restaurant, periods: [dinner], tables: [table("a", 2)], closures: [], reservations: [], dateKey: tomorrow, party: 2 };

test("turn time follows the party size", () => {
  assert.equal(turnMinutes(restaurant.turn_times, 2), 60);
  assert.equal(turnMinutes(restaurant.turn_times, 3), 120);
  assert.equal(toMinutes("17:30:00"), 1050);
});

test("offers every interval from opening to last seating", () => {
  const slots = availableSlots(base);
  assert.deepEqual(slots.map((s) => s.time), ["17:00", "17:30", "18:00", "18:30", "19:00"]);
});

test("a taken table removes the overlapping times only", () => {
  const start = new Date(availableSlots(base)[2].startsAt); // 18:00, a 60 minute stay
  const slots = availableSlots({
    ...base,
    reservations: [{ table_id: "a", starts_at: start.toISOString(), ends_at: new Date(start.getTime() + 3600_000).toISOString(), status: "confirmed" }],
  });
  // 17:30 would still hold the table at 18:00 and 18:30 starts before the 19:00 end: both blocked
  assert.deepEqual(slots.map((s) => s.time), ["17:00", "19:00"]);
});

test("another free table keeps the time open; cancelled reservations do not block", () => {
  const start = availableSlots(base)[0].startsAt;
  const end = new Date(new Date(start).getTime() + 3600_000).toISOString();
  const two = availableSlots({ ...base, tables: [table("a", 2), table("b", 2)], reservations: [{ table_id: "a", starts_at: start, ends_at: end, status: "confirmed" }] });
  assert.equal(two[0].time, "17:00");
  const cancelled = availableSlots({ ...base, reservations: [{ table_id: "a", starts_at: start, ends_at: end, status: "cancelled" }] });
  assert.equal(cancelled[0].time, "17:00");
});

test("tables that are offline, inactive or too small are not offered", () => {
  assert.equal(availableSlots({ ...base, tables: [table("a", 2, { online: false })] }).length, 0);
  assert.equal(availableSlots({ ...base, tables: [table("a", 2, { active: false })] }).length, 0);
  assert.equal(availableSlots({ ...base, tables: [table("a", 2)], party: 4 }).length, 0);
  assert.ok(availableSlots({ ...base, tables: [table("a", 4)], party: 3 }).length > 0);
});

test("closures, party limits, hours by weekday and booking range", () => {
  assert.equal(availableSlots({ ...base, closures: [{ on_date: tomorrow }] }).length, 0);
  assert.equal(availableSlots({ ...base, party: 7 }).length, 0);
  assert.equal(availableSlots({ ...base, dateKey: addDaysToKey(today, 31) }).length, 0);
  assert.equal(availableSlots({ ...base, dateKey: addDaysToKey(today, -1) }).length, 0);
  const noDays = { ...dinner, days: [] as number[] };
  assert.equal(availableSlots({ ...base, periods: [noDays] }).length, 0);
});

test("minimum notice hides times that are too soon", () => {
  const first = availableSlots({ ...base, now: new Date("2000-01-01") })[0];
  const now = new Date(new Date(first.startsAt).getTime() - 30 * 60_000); // 30 minutes before the first slot
  const soon = availableSlots({ ...base, now });
  assert.ok(soon.every((s) => new Date(s.startsAt).getTime() >= now.getTime() + 60 * 60_000));
  assert.ok(soon.length < 5);
});

test("open days skip closures and days without hours", () => {
  const monday = { ...dinner, days: [1] };
  const days = openDays({ timezone: "America/Toronto", max_advance_days: 14 }, [monday], []);
  assert.ok(days.length >= 2 && days.length <= 3);
  const closed = openDays({ timezone: "America/Toronto", max_advance_days: 14 }, [monday], days.map((d) => ({ on_date: d })));
  assert.equal(closed.length, 0);
});
