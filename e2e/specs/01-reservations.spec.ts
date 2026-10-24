import { createClient } from "@supabase/supabase-js";
import { test, expect, type Page } from "@playwright/test";
import { OWNER, SLUG, seed } from "../seed";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const tomorrow = new Date(Date.now() + 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
let restaurantId = "";

/** The local time of tomorrow in Toronto, as an instant (the time zone is EDT or EST: try both offsets and keep the one that round-trips). */
function at(hhmm: string) {
  for (const off of ["-04:00", "-05:00"]) {
    const d = new Date(`${tomorrow}T${hhmm}:00${off}`);
    const back = d.toLocaleTimeString("en-GB", { timeZone: "America/Toronto", hour: "2-digit", minute: "2-digit" });
    if (back === hhmm) return d.toISOString();
  }
  throw new Error("bad time");
}

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(OWNER.email);
  await page.getByLabel("Password").fill(OWNER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(new RegExp(`/o/${SLUG}`));
}

async function onlyOnline(names: string[]) {
  await db.from("dining_tables").update({ online: false }).eq("restaurant_id", restaurantId);
  await db.from("dining_tables").update({ online: true }).eq("restaurant_id", restaurantId).in("name", names);
}

test.beforeEach(async () => {
  restaurantId = await seed();
});

test.afterAll(async () => {
  const { cleanup } = await import("../seed");
  await cleanup();
});

test("a guest books a table, the owner sees it on the list and cancels it", async ({ page, browser }) => {
  await page.goto(`/${SLUG}?party=2&date=${tomorrow}`);
  await expect(page.getByRole("heading", { name: "E2E Bistro", level: 1 })).toBeVisible();
  await page.getByRole("link", { name: "6:00 PM", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your details" })).toBeVisible();
  await page.getByLabel("Full name").fill("Gina Guest");
  await page.getByLabel("Email").fill("gina@tableready-e2e.test");
  await page.getByRole("button", { name: "Confirm reservation" }).click();
  await page.waitForURL(/\/reservation\/[a-f0-9]{48}/);
  await expect(page.getByRole("heading", { name: "You're booked" })).toBeVisible();
  const guestUrl = page.url();

  // The smallest online table that fits (a two-top) was picked.
  const { data: rows } = await db.from("reservations").select("party_size, status, dining_tables(name)").eq("restaurant_id", restaurantId);
  expect(rows).toHaveLength(1);
  expect((rows![0].dining_tables as unknown as { name: string }).name).toBe("T1");

  const ctx = await browser.newContext();
  const owner = await ctx.newPage();
  await signIn(owner);
  await owner.goto(`/o/${SLUG}?date=${tomorrow}`);
  await expect(owner.getByText("Gina Guest")).toBeVisible();
  await expect(owner.getByText("Table T1")).toBeVisible();
  owner.once("dialog", (d) => d.accept());
  await owner.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(owner.getByText("Cancelled", { exact: true })).toBeVisible();
  await ctx.close();

  await page.goto(guestUrl);
  await expect(page.getByRole("heading", { name: "Reservation cancelled" })).toBeVisible();
});

test("a full table is never double-booked and a full time offers the waitlist, which is notified when a table opens", async ({ page, browser }) => {
  await onlyOnline(["T1"]);
  const book = (table: string | null) => db.rpc("book_table", { p_restaurant: restaurantId, p_name: "Held", p_email: "", p_phone: "", p_party: 2, p_starts: at("18:00"), p_notes: "", p_source: "host", p_table: table });
  const { data: t1 } = await db.from("dining_tables").select("id").eq("restaurant_id", restaurantId).eq("name", "T1").single();
  expect((await book(t1!.id)).error).toBeNull();
  // The database itself refuses a second party at the same table and time.
  const second = await book(t1!.id);
  expect(second.error?.message).toContain("no_table");

  // Online guests no longer see 6:00 PM, but still see a time once the table is free again (a 75 minute stay ends at 7:15).
  await page.goto(`/${SLUG}?party=2&date=${tomorrow}`);
  await expect(page.getByRole("link", { name: "7:15 PM", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "6:00 PM", exact: true })).toHaveCount(0);

  // A party of 3 fits no online table: the page says so and offers the waitlist.
  await page.goto(`/${SLUG}?party=3&date=${tomorrow}`);
  await expect(page.getByText(/No tables for 3 guests/)).toBeVisible();
  await page.getByLabel("Full name").fill("Wanda Waiting");
  await page.getByLabel("Email").fill("wanda@tableready-e2e.test");
  await page.getByRole("button", { name: "Join the waitlist" }).click();
  await page.waitForURL(/waitlisted=1/);
  await expect(page.getByText("You are on the waitlist")).toBeVisible();
  const { data: entries } = await db.from("waitlist").select("status").eq("restaurant_id", restaurantId);
  expect(entries).toEqual([{ status: "waiting" }]);

  // The restaurant opens a four-top to online guests and checks the waitlist.
  await db.from("dining_tables").update({ online: true }).eq("restaurant_id", restaurantId).eq("name", "T3");
  const ctx = await browser.newContext();
  const owner = await ctx.newPage();
  await signIn(owner);
  await owner.goto(`/o/${SLUG}/waitlist`);
  await expect(owner.getByText("Wanda Waiting")).toBeVisible();
  await owner.getByRole("button", { name: "Check for openings" }).click();
  await expect(owner.getByText("Told a table opened")).toBeVisible();
  await ctx.close();
  const { data: after } = await db.from("waitlist").select("status").eq("restaurant_id", restaurantId);
  expect(after).toEqual([{ status: "notified" }]);
});

test("the owner chooses which tables are online, adds a table, and adds a phone reservation", async ({ browser }) => {
  const ctx = await browser.newContext();
  const owner = await ctx.newPage();
  await signIn(owner);
  await owner.goto(`/o/${SLUG}/tables`);
  // Everything starts open to online guests: 2 + 2 + 4 + 4 + 4 + 6 seats.
  await expect(owner.getByText(/6 tables · 22 seats/)).toBeVisible();

  const t6 = owner.locator("form", { has: owner.locator('input[value="T6"]') });
  await t6.getByRole("switch", { name: "Open to online guests" }).click();
  await t6.getByRole("button", { name: "Save" }).click();
  await expect(owner.getByText("Table saved")).toBeVisible();
  await expect(owner.getByText(/5 tables · 16 seats/)).toBeVisible();

  await owner.getByLabel("Name").last().fill("T7");
  await owner.getByLabel("Seats").last().fill("8");
  await owner.getByRole("button", { name: "Add table" }).click();
  await expect(owner.getByText("Table added")).toBeVisible();
  await expect(owner.getByText(/6 tables · 24 seats/)).toBeVisible();

  await owner.goto(`/o/${SLUG}?date=${tomorrow}`);
  await owner.getByRole("button", { name: "Add reservation" }).click();
  const dlg = owner.getByRole("dialog");
  await dlg.getByLabel("Guest name").fill("Phil Phone");
  await dlg.getByLabel("Time").fill("19:00");
  await dlg.getByRole("button", { name: "Add reservation" }).click();
  await expect(owner.getByText("Phil Phone")).toBeVisible();
  await expect(owner.getByText("Added by host")).toBeVisible();
  await ctx.close();
});
