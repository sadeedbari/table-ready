import test from "node:test";
import assert from "node:assert/strict";
import { noticeState, parseLocalInput, toLocalInput } from "../src/lib/notices";

const at = (iso: string) => new Date(iso).getTime();

test("a notice is scheduled before it starts, active between, and ended after", () => {
  const n = { starts_at: "2026-10-25T22:00:00Z", ends_at: "2026-10-26T00:00:00Z" };
  assert.equal(noticeState(n, at("2026-10-25T21:59:59Z")), "scheduled");
  assert.equal(noticeState(n, at("2026-10-25T22:00:00Z")), "active");
  assert.equal(noticeState(n, at("2026-10-25T23:59:59Z")), "active");
  assert.equal(noticeState(n, at("2026-10-26T00:00:00Z")), "ended");
});

test("times typed in the restaurant's zone become the right instant, in summer and winter", () => {
  assert.equal(parseLocalInput("2026-10-25T19:30", "America/Toronto"), "2026-10-25T23:30:00.000Z"); // EDT, UTC-4
  assert.equal(parseLocalInput("2026-12-01T19:30", "America/Toronto"), "2026-12-02T00:30:00.000Z"); // EST, UTC-5
  assert.equal(parseLocalInput("2026-10-25T19:30", "America/Vancouver"), "2026-10-26T02:30:00.000Z");
});

test("anything that is not a date and time is refused", () => {
  assert.equal(parseLocalInput("", "America/Toronto"), null);
  assert.equal(parseLocalInput("tomorrow", "America/Toronto"), null);
  assert.equal(parseLocalInput("2026-10-25", "America/Toronto"), null);
});

test("an instant formats back to the same local date and time", () => {
  const iso = parseLocalInput("2026-10-25T19:30", "America/Toronto")!;
  assert.equal(toLocalInput(new Date(iso), "America/Toronto"), "2026-10-25T19:30");
  assert.equal(toLocalInput(new Date(iso), "America/Vancouver"), "2026-10-25T16:30");
});
