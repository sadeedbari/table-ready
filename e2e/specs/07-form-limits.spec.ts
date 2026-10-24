import { createClient } from "@supabase/supabase-js";
import { test, expect } from "@playwright/test";
import { LIMIT_SLUG, OWNER, seed } from "../seed";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const tomorrow = new Date(Date.now() + 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
let limitId = "";

/** The limits do not apply to restaurants whose address starts with e2e-, so these tests use a second restaurant without that prefix. */
test.beforeEach(async () => {
  await seed();
  const user = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  await user.auth.signInWithPassword(OWNER);
  const { data, error } = await user.rpc("create_restaurant", { p_name: "Limit Test Kitchen", p_slug: LIMIT_SLUG, p_timezone: "America/Toronto", p_display_name: "Olivia Owner" });
  if (error) throw error;
  limitId = data as string;
});

test.afterAll(async () => {
  const { cleanup } = await import("../seed");
  await cleanup();
});

test("the database limiter allows a few hits, refuses the next, and lets a visitor back in when the window passes", async () => {
  const hit = async (bucket: string, key: string, max: number, seconds: number) =>
    (await db.rpc("hit_rate_limit", { p_bucket: bucket, p_key: key, p_max: max, p_window_seconds: seconds })).data as boolean;
  const bucket = `unit-e2e-${Date.now()}`;
  expect([await hit(bucket, "a", 3, 2), await hit(bucket, "a", 3, 2), await hit(bucket, "a", 3, 2), await hit(bucket, "a", 3, 2)]).toEqual([true, true, true, false]);
  expect(await hit(bucket, "b", 3, 2)).toBe(true); // someone else is not affected
  await new Promise((r) => setTimeout(r, 2300));
  expect(await hit(bucket, "a", 3, 2)).toBe(true); // the window passed
});

test("the 'Get offers and news' sign-up stops after five tries from one visitor", async ({ page }) => {
  for (let i = 1; i <= 5; i++) {
    await page.goto(`/${LIMIT_SLUG}`);
    await page.locator("#updates-heading ~ form").getByLabel("Email").fill(`delivered+limit${i}@resend.dev`);
    await page.getByRole("button", { name: "Sign me up" }).click();
    await expect(page.getByText("You are signed up for offers and news")).toBeVisible();
  }
  await page.goto(`/${LIMIT_SLUG}`);
  await page.locator("#updates-heading ~ form").getByLabel("Email").fill("delivered+limit6@resend.dev");
  await page.getByRole("button", { name: "Sign me up" }).click();
  await expect(page.getByText("Too many attempts")).toBeVisible();
  const { data } = await db.from("guest_signups").select("email").eq("restaurant_id", limitId);
  expect(data).toHaveLength(5); // the sixth was not saved
});

test("one email cannot hold more than four upcoming reservations, and the message says what to do", async ({ page }) => {
  const email = "delivered+hoarder@resend.dev";
  const { data: tables } = await db.from("dining_tables").select("id").eq("restaurant_id", limitId).order("name").limit(4);
  for (const t of tables!) {
    const start = new Date(Date.now() + 26 * 3600_000);
    start.setMinutes(0, 0, 0);
    const { error } = await db.rpc("book_table", { p_restaurant: limitId, p_name: "Hoarder", p_email: email, p_phone: "", p_party: 2, p_starts: start.toISOString(), p_notes: "", p_source: "host", p_table: t.id });
    if (error) throw error;
  }
  await page.goto(`/${LIMIT_SLUG}?party=2&date=${tomorrow}`);
  await page.getByRole("link", { name: "9:00 PM", exact: true }).click();
  await page.getByLabel("Full name").fill("Hoarder Again");
  await page.getByLabel(/^Email/).first().fill(email);
  await page.getByRole("button", { name: "Confirm reservation" }).click();
  await expect(page.getByText(/already has 4 upcoming reservations/)).toBeVisible();
  const { count } = await db.from("reservations").select("id", { count: "exact", head: true }).eq("restaurant_id", limitId);
  expect(count).toBe(4);
});

test("the walk-in line allows a phone number three tries an hour", async ({ browser }) => {
  await db.from("restaurants").update({ queue_open: true }).eq("id", limitId);
  const messages: string[] = [];
  for (let i = 1; i <= 4; i++) {
    const p = await browser.newPage();
    await p.goto(`/${LIMIT_SLUG}/queue`);
    await p.getByLabel("Your name").fill(`Phil ${i}`);
    await p.getByLabel("Mobile number").fill("416 555 0166");
    await p.getByRole("button", { name: "Join the line" }).click();
    if (i === 1) await p.waitForURL(/\/queue\/[a-f0-9]{48}/);
    const message = p.locator("form [role=alert]");
    if (i > 1) await message.waitFor();
    messages.push(i === 1 ? "joined" : (await message.innerText()).trim());
    await p.close();
  }
  expect(messages[0]).toBe("joined");
  expect(messages[1]).toMatch(/already in line/);
  expect(messages[2]).toMatch(/already in line/);
  expect(messages[3]).toMatch(/Too many attempts/);
});
