import test from "node:test";
import assert from "node:assert/strict";
import { minutesLeft, openQueue, partiesAhead, readyMessage, smsLink, suggestQuote, telLink } from "../src/lib/queue";

const at = (min: number) => new Date(Date.UTC(2026, 9, 24, 18, min)).toISOString();
const e = (id: string, status: "waiting" | "ready" | "seated" | "cancelled", min: number) => ({ id, status, joined_at: at(min) });

test("the open queue keeps waiting and called parties in join order", () => {
  const q = openQueue([e("c", "waiting", 20), e("a", "waiting", 0), e("x", "seated", 5), e("b", "ready", 10), e("y", "cancelled", 15)]);
  assert.deepEqual(q.map((w) => w.id), ["a", "b", "c"]);
});

test("parties ahead counts only those still waiting", () => {
  const all = [e("a", "waiting", 0), e("b", "ready", 10), e("c", "waiting", 20), e("d", "waiting", 30)];
  assert.equal(partiesAhead(all, "a"), 0);
  assert.equal(partiesAhead(all, "c"), 1); // b already has a table called, so only a is ahead
  assert.equal(partiesAhead(all, "d"), 2);
  assert.equal(partiesAhead(all, "missing"), 0);
});

test("the suggested quote grows with the line, in steps of five", () => {
  assert.equal(suggestQuote(0), 5);
  assert.equal(suggestQuote(3), 25);
  assert.equal(suggestQuote(10), 80);
});

test("minutes left on a quote counts down and stops at zero", () => {
  const joined = at(0);
  assert.equal(minutesLeft(30, joined, new Date(at(10)).getTime()), 20);
  assert.equal(minutesLeft(30, joined, new Date(at(45)).getTime()), 0);
  assert.equal(minutesLeft(null, joined, Date.now()), null);
});

test("call and text links keep digits and the plus sign, and the text is pre-written", () => {
  assert.equal(telLink("+1 (416) 555-0123"), "tel:+14165550123");
  const link = smsLink("+1 416 555 0123", readyMessage("Casa Verde", 4));
  assert.ok(link.startsWith("sms:+14165550123?&body="));
  assert.ok(decodeURIComponent(link.split("body=")[1]).startsWith("Casa Verde: your table for 4 is ready."));
});
