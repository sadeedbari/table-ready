import { createClient } from "@supabase/supabase-js";
import { test, expect, type Page } from "@playwright/test";
import { OWNER, SLUG, seed } from "../seed";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
let restaurantId = "";

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(OWNER.email);
  await page.getByLabel("Password").fill(OWNER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(new RegExp(`/o/${SLUG}`));
}

test.beforeEach(async () => {
  restaurantId = await seed();
});

test.afterAll(async () => {
  const { cleanup } = await import("../seed");
  await cleanup();
});

test("the host adds a party with a phone number, can call or text them, and marks the table ready", async ({ browser }) => {
  const ctx = await browser.newContext();
  const owner = await ctx.newPage();
  await signIn(owner);
  await owner.goto(`/o/${SLUG}/queue`);
  await expect(owner.getByText("Nobody is waiting")).toBeVisible();

  await owner.getByRole("button", { name: "Add a party" }).click();
  const dlg = owner.getByRole("dialog");
  await dlg.getByLabel("Name").fill("Walt Walkin");
  await dlg.getByLabel("Guests").fill("4");
  await dlg.getByLabel("Phone").fill("416 555 0123");
  await dlg.getByLabel(/Email/).fill("delivered+walt@resend.dev");
  await dlg.getByRole("button", { name: "Add to line" }).click();

  const row = owner.locator("li", { hasText: "Walt Walkin" });
  await expect(row).toBeVisible();
  await expect(row.getByText("+14165550123")).toBeVisible(); // saved in international form
  await expect(row.getByRole("link", { name: "Call" })).toHaveAttribute("href", "tel:+14165550123");
  const text = await row.getByRole("link", { name: "Text" }).getAttribute("href");
  expect(text).toMatch(/^sms:\+14165550123\?&body=/);
  expect(decodeURIComponent(text!.split("body=")[1])).toBe("E2E Bistro: your table for 4 is ready. Please check in with the host.");

  const { data: saved } = await db.from("walkins").select("phone, party_size, status").eq("restaurant_id", restaurantId);
  expect(saved).toEqual([{ phone: "+14165550123", party_size: 4, status: "waiting" }]);

  await row.getByRole("button", { name: "Table ready" }).click();
  await expect(row.getByText("Table ready").first()).toBeVisible();
  await expect(owner.getByText("Marked ready and emailed")).toBeVisible();
  const { data: after } = await db.from("walkins").select("status, ready_at").eq("restaurant_id", restaurantId);
  expect(after![0].status).toBe("ready");
  expect(after![0].ready_at).not.toBeNull();

  await row.getByRole("button", { name: "Seated" }).click();
  await expect(owner.getByText("Nobody is waiting")).toBeVisible();
  await ctx.close();
});

test("a guest joins from the QR link, sees their place, and is told when the table is ready", async ({ page, browser }) => {
  // Closed by default: the page says so and nobody can join.
  await page.goto(`/${SLUG}/queue`);
  await expect(page.getByText("The line is not open online")).toBeVisible();

  // The owner opens the line from the Walk-ins page.
  const ctx = await browser.newContext();
  const owner = await ctx.newPage();
  await signIn(owner);
  await owner.goto(`/o/${SLUG}/queue`);
  await owner.getByRole("switch", { name: "Guests can join the line online" }).click();
  await owner.getByRole("button", { name: "Save", exact: true }).click();
  await expect(owner.getByText("Saved")).toBeVisible();

  // A first party is already waiting, so the guest sees one ahead.
  await db.from("walkins").insert({ restaurant_id: restaurantId, guest_name: "Early Bird", party_size: 2, phone: "+14165550100", source: "host" });
  await page.goto(`/${SLUG}/queue`);
  await expect(page.getByText("1 party is waiting ahead of you.")).toBeVisible();
  await page.getByLabel("Your name").fill("Quinn Queue");
  await page.getByLabel("Guests in your party").fill("3");
  await page.getByLabel("Mobile number").fill("416 555 0199");
  await page.getByLabel(/Email/).fill("delivered+quinn@resend.dev");
  await page.getByRole("button", { name: "Join the line" }).click();
  await page.waitForURL(/\/queue\/[a-f0-9]{48}/);
  const statusUrl = page.url();
  await expect(page.getByRole("heading", { name: /You're in line, Quinn/ })).toBeVisible();
  await expect(page.getByText("party ahead of you")).toBeVisible();

  // The same number cannot join twice.
  const again = await browser.newPage();
  await again.goto(`/${SLUG}/queue`);
  await again.getByLabel("Your name").fill("Quinn Again");
  await again.getByLabel("Mobile number").fill("(416) 555-0199");
  await again.getByRole("button", { name: "Join the line" }).click();
  await expect(again.getByText(/already in line/)).toBeVisible();
  await again.close();

  // The host sees the online party with its number, and calls them.
  await owner.goto(`/o/${SLUG}/queue`);
  const row = owner.locator("li", { hasText: "Quinn Queue" });
  await expect(row.getByText("Joined online")).toBeVisible();
  await expect(row.getByText("+14165550199")).toBeVisible();
  await row.getByRole("button", { name: "Table ready" }).click();
  await expect(owner.getByText("Marked ready and emailed")).toBeVisible(); // saved: only then can the guest see it

  await page.reload();
  await expect(page.getByRole("heading", { name: "Your table is ready" })).toBeVisible();

  await row.getByRole("button", { name: "Seated" }).click();
  await expect(owner.locator("li", { hasText: "Quinn Queue" })).toHaveCount(0);
  await page.goto(statusUrl);
  await expect(page.getByRole("heading", { name: "Enjoy your meal" })).toBeVisible();
  await ctx.close();
});

test("a guest can leave the line, and a party called but not seated can go back in line", async ({ page, browser }) => {
  await db.from("restaurants").update({ queue_open: true }).eq("id", restaurantId);
  await page.goto(`/${SLUG}/queue`);
  await page.getByLabel("Your name").fill("Lena Leaving");
  await page.getByLabel("Mobile number").fill("416 555 0155");
  await page.getByRole("button", { name: "Join the line" }).click();
  await page.waitForURL(/\/queue\/[a-f0-9]{48}/);
  await expect(page.getByText("You are next up")).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Leave the line" }).click();
  await expect(page.getByRole("heading", { name: "You're no longer in line" })).toBeVisible();

  const ctx = await browser.newContext();
  const owner = await ctx.newPage();
  await signIn(owner);
  await db.from("walkins").insert({ restaurant_id: restaurantId, guest_name: "Rita Ready", party_size: 2, phone: "+14165550177", status: "ready", ready_at: new Date().toISOString() });
  await owner.goto(`/o/${SLUG}/queue`);
  const row = owner.locator("li", { hasText: "Rita Ready" });
  await row.getByRole("button", { name: "Back in line" }).click();
  await expect(row.getByText("Waiting", { exact: true })).toBeVisible();
  await ctx.close();
});
