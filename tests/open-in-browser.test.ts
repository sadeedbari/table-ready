import test from "node:test";
import assert from "node:assert/strict";
import { browserLaunchUrl } from "../src/lib/open-in-browser";

const page = "https://tableready.sulosystems.com/bowl-theory?party=2";

test("a second address for the site always wins, because it is outside the installed app", () => {
  assert.equal(browserLaunchUrl(page, { ios: true, android: false, otherOrigin: "https://www.tableready.sulosystems.com" }), "https://www.tableready.sulosystems.com/bowl-theory?party=2");
  // the same address is not "another" one
  assert.equal(browserLaunchUrl(page, { ios: false, android: false, otherOrigin: "https://tableready.sulosystems.com" }), null);
});

test("iPhone asks Safari to open the page", () => {
  assert.equal(browserLaunchUrl(page, { ios: true, android: false }), "x-safari-https://tableready.sulosystems.com/bowl-theory?party=2");
});

test("Android asks Chrome, and falls back to the plain page", () => {
  const u = browserLaunchUrl(page, { ios: false, android: true })!;
  assert.ok(u.startsWith("intent://tableready.sulosystems.com/bowl-theory?party=2#Intent;scheme=https;"));
  assert.ok(u.includes("package=com.android.chrome"));
  assert.ok(u.includes(`S.browser_fallback_url=${encodeURIComponent(page)}`));
  assert.ok(u.endsWith(";end"));
});

test("anything else gets a normal new tab", () => {
  assert.equal(browserLaunchUrl(page, { ios: false, android: false }), null);
});
