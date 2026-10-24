import test from "node:test";
import assert from "node:assert/strict";
import { filterQuery, modeLabel, outcomeLabel, parseFilters, toCsv, type GuestRow } from "../src/lib/guest-list";

test("filters are read from the address and unknown values are ignored", () => {
  const f = parseFilters({ mode: "waitlist", outcome: "no_show", marketing: "1", q: "  ann,(lee)*  ", from: "2026-10-01", to: "nope", page: "3" });
  assert.deepEqual(f, { mode: "waitlist", outcome: "no_show", marketing: true, q: "ann  lee", from: "2026-10-01", to: "", page: 3 });
  const empty = parseFilters({ mode: "hacker", outcome: "x", page: "-4" });
  assert.deepEqual(empty, { mode: "", outcome: "", marketing: false, q: "", from: "", to: "", page: 1 });
});

test("the same filters can be turned back into an address", () => {
  assert.equal(filterQuery({}), "");
  assert.equal(filterQuery({ mode: "signup", marketing: true, q: "ann" }, { page: "2" }), "?mode=signup&marketing=1&q=ann&page=2");
});

test("every outcome and mode has a readable label", () => {
  assert.equal(outcomeLabel("no_show"), "No-show");
  assert.equal(outcomeLabel("notified"), "Told a table opened");
  assert.equal(modeLabel("walk_in"), "Walk-in line");
  assert.equal(modeLabel("signup"), "Signed up for updates");
});

test("the CSV has a header, quotes awkward cells, and defuses spreadsheet formulas", () => {
  const rows: GuestRow[] = [
    { id: "1", mode: "reservation", guest_name: 'Ann "AJ" Lee, Jr', email: "ann@example.com", phone: "+14165550123", party_size: 4, added_at: "2026-10-25T22:00:00Z", event_at: "2026-10-26T23:00:00Z", outcome: "showed", marketing_opt_in: true, source: "online" },
    { id: "2", mode: "signup", guest_name: "=HYPERLINK(\"x\")", email: "b@example.com", phone: null, party_size: null, added_at: "2026-10-25T22:00:00Z", event_at: null, outcome: "subscribed", marketing_opt_in: true, source: "online" },
  ];
  const lines = toCsv(rows, "America/Toronto").trim().split("\r\n");
  assert.equal(lines.length, 3);
  assert.ok(lines[0].startsWith("Date added,Name,How they came to you,Outcome"));
  assert.ok(lines[1].includes('"Ann ""AJ"" Lee, Jr"'));
  assert.ok(lines[1].includes("Reservation,Showed,4"));
  assert.ok(lines[2].includes("'=HYPERLINK("), lines[2]); // starts with an apostrophe so it stays text
  assert.ok(lines[2].includes("Signed up for updates,Subscribed"));
});
