import { createClient } from "@supabase/supabase-js";
import { test, expect, type Page } from "@playwright/test";
import { OWNER, SLUG, seed } from "../seed";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const tomorrow = new Date(Date.now() + 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
let restaurantId = "";

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(OWNER.email);
  await page.getByLabel("Password").fill(OWNER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(new RegExp(`/o/${SLUG}`));
}

const ago = (hours: number) => new Date(Date.now() - hours * 3600_000).toISOString();

/** One person for each way in and each outcome, so the list has something to tell apart. */
async function seedGuests() {
  const { data: t } = await db.from("dining_tables").select("id").eq("restaurant_id", restaurantId).eq("name", "T1").single();
  const base = { restaurant_id: restaurantId, table_id: null, email: null, phone: null, notes: null, source: "online", marketing_opt_in: false };
  const res = (name: string, status: string, startHoursAgo: number, extra: Record<string, unknown> = {}) => ({
    ...base, guest_name: name, party_size: 2, status, starts_at: ago(startHoursAgo), ends_at: ago(startHoursAgo - 1), created_at: ago(startHoursAgo + 24), ...extra,
  });
  await db.from("reservations").insert([
    res("Sam Showed", "completed", 48, { email: "sam@example.com", marketing_opt_in: true, table_id: t!.id }),
    res("Nora NoShow", "no_show", 30, { email: "nora@example.com", phone: "+14165550111" }),
    res("Cleo Cancelled", "cancelled", 20, { email: "cleo@example.com" }),
    res("Mark Unmarked", "confirmed", 10, { email: "mark@example.com" }),
  ]);
  const wl = (name: string, status: string, extra: Record<string, unknown> = {}) => ({
    restaurant_id: restaurantId, guest_name: name, email: `${name.split(" ")[0].toLowerCase()}@example.com`, phone: null, party_size: 3, wanted_date: tomorrow,
    from_time: "17:00", to_time: "20:00", status, marketing_opt_in: false, ...extra,
  });
  await db.from("waitlist").insert([wl("Wanda Waitlisted", "notified", { marketing_opt_in: true }), wl("Wes Waiting", "waiting")]);
  const q = (name: string, status: string, extra: Record<string, unknown> = {}) => ({
    restaurant_id: restaurantId, guest_name: name, party_size: 2, phone: "+14165550199", email: null, notes: null, quoted_minutes: 20, status, source: "host",
    joined_at: ago(5), ready_at: null, closed_at: null, marketing_opt_in: false, ...extra,
  });
  await db.from("walkins").insert([
    q("Walt Seated", "seated", { closed_at: ago(4) }),
    q("Lena Left", "cancelled", { closed_at: ago(4) }),
    q("Rita NoShowLine", "cancelled", { ready_at: ago(4), closed_at: ago(3) }),
  ]);
  await db.from("guest_signups").insert({ restaurant_id: restaurantId, guest_name: "Sue Subscriber", email: "sue@example.com", marketing_opt_in: true });
}

test.beforeEach(async () => {
  restaurantId = await seed();
});

test.afterAll(async () => {
  const { cleanup } = await import("../seed");
  await cleanup();
});

test("the guest list shows every way in, with date added, how, and what happened", async ({ browser }) => {
  await seedGuests();
  const ctx = await browser.newContext();
  const owner = await ctx.newPage();
  await signIn(owner);
  await owner.goto(`/o/${SLUG}/guests`);
  await expect(owner.getByRole("heading", { name: "Guests" })).toBeVisible();
  const row = (name: string) => owner.locator("tbody tr", { hasText: name });

  await expect(row("Sam Showed")).toContainText("Reservation");
  await expect(row("Sam Showed")).toContainText("Showed");
  await expect(row("Nora NoShow")).toContainText("No-show");
  await expect(row("Cleo Cancelled")).toContainText("Cancelled");
  await expect(row("Mark Unmarked")).toContainText("Not marked yet");
  await expect(row("Wanda Waitlisted")).toContainText("Waitlist");
  await expect(row("Wanda Waitlisted")).toContainText("Told a table opened");
  await expect(row("Wes Waiting")).toContainText("Waiting");
  await expect(row("Walt Seated")).toContainText("Walk-in line");
  await expect(row("Walt Seated")).toContainText("Showed");
  await expect(row("Lena Left")).toContainText("Left the line");
  await expect(row("Rita NoShowLine")).toContainText("No-show"); // called, then never came
  await expect(row("Sue Subscriber")).toContainText("Signed up for updates");
  await expect(row("Sue Subscriber")).toContainText("Subscribed");
  await expect(row("Sam Showed")).toContainText("sam@example.com");
  await expect(row("Nora NoShow")).toContainText("+14165550111");
  // date added is shown (the seeded rows were added a few days ago)
  await expect(row("Sam Showed").locator("td").first()).toContainText(/\d{4}/);
  // the marketing tick appears only for people who agreed
  await expect(row("Sam Showed").getByLabel("Agreed to marketing emails")).toBeVisible();
  await expect(row("Nora NoShow").getByLabel("Agreed to marketing emails")).toHaveCount(0);

  await ctx.close();
});

test("filters narrow the list by how they came, outcome, marketing, text and dates", async ({ browser }) => {
  await seedGuests();
  const ctx = await browser.newContext();
  const owner = await ctx.newPage();
  await signIn(owner);
  const names = async () => (await owner.locator("tbody tr td:nth-child(2) .font-medium").allInnerTexts()).sort();

  await owner.goto(`/o/${SLUG}/guests?mode=waitlist`);
  expect(await names()).toEqual(["Wanda Waitlisted", "Wes Waiting"]);

  await owner.goto(`/o/${SLUG}/guests?outcome=no_show`);
  expect(await names()).toEqual(["Nora NoShow", "Rita NoShowLine"]);

  await owner.goto(`/o/${SLUG}/guests?marketing=1`);
  expect(await names()).toEqual(["Sam Showed", "Sue Subscriber", "Wanda Waitlisted"]);

  await owner.goto(`/o/${SLUG}/guests?q=nora`);
  expect(await names()).toEqual(["Nora NoShow"]);
  await owner.goto(`/o/${SLUG}/guests?q=${encodeURIComponent("+1416555")}`);
  expect((await names()).length).toBeGreaterThanOrEqual(3);

  // The form itself: pick a mode and outcome, apply, and the address and list follow.
  await owner.goto(`/o/${SLUG}/guests`);
  await owner.getByLabel("How they came to you").selectOption("walk_in");
  await owner.getByLabel("Outcome").selectOption("showed");
  await owner.getByRole("button", { name: "Apply filters" }).click();
  await expect(owner).toHaveURL(/mode=walk_in/);
  expect(await names()).toEqual(["Walt Seated"]);
  await owner.getByRole("link", { name: "Clear" }).click();
  await expect(owner).toHaveURL(/\/guests$/);
  await expect.poll(async () => (await names()).length).toBeGreaterThan(8);

  // A date range with nothing in it
  await owner.goto(`/o/${SLUG}/guests?from=2000-01-01&to=2000-01-02`);
  await expect(owner.getByText("No one matches those filters")).toBeVisible();
  await ctx.close();
});

test("an admin can download the filtered list as CSV, and it carries the same columns", async ({ browser }) => {
  await seedGuests();
  const ctx = await browser.newContext();
  const owner = await ctx.newPage();
  await signIn(owner);
  const res = await ctx.request.get(`/o/${SLUG}/guests/export?outcome=no_show`);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("text/csv");
  expect(res.headers()["content-disposition"]).toContain(`${SLUG}-guests-`);
  const csv = await res.text();
  expect(csv).toContain("Date added,Name,How they came to you,Outcome");
  expect(csv).toContain("Nora NoShow");
  expect(csv).toContain("Rita NoShowLine");
  expect(csv).not.toContain("Sam Showed"); // filtered out
  // a guest who is not signed in gets nothing
  const anon = await browser.newContext();
  const denied = await anon.request.get(`/o/${SLUG}/guests/export`, { maxRedirects: 0 });
  expect([307, 308, 302, 401, 403, 404]).toContain(denied.status());
  await anon.close();
  await ctx.close();
});

test("guests are added to the list as they book, join the waitlist, and sign up, and a waitlisted guest who then books shows as having booked", async ({ page, browser }) => {
  // A guest books and agrees to marketing.
  await page.goto(`/${SLUG}?party=2&date=${tomorrow}`);
  await page.getByRole("link", { name: "6:00 PM", exact: true }).click();
  await page.getByLabel("Full name").fill("Bea Booker");
  await page.getByLabel(/^Email/).fill("delivered+bea@resend.dev");
  const consent = page.getByRole("checkbox", { name: /Send me offers and news/ });
  await expect(consent).not.toBeChecked(); // never ticked for them
  await consent.check();
  await page.getByRole("button", { name: "Confirm reservation" }).click();
  await page.waitForURL(/\/reservation\//);

  // Another books without ticking it.
  const other = await browser.newPage();
  await other.goto(`/${SLUG}?party=2&date=${tomorrow}`);
  await other.getByRole("link", { name: "7:00 PM", exact: true }).click();
  await other.getByLabel("Full name").fill("Ned NoConsent");
  await other.getByLabel(/^Email/).fill("delivered+ned@resend.dev");
  await other.getByRole("button", { name: "Confirm reservation" }).click();
  await other.waitForURL(/\/reservation\//);
  await other.close();

  // Someone signs up for updates from the public page.
  await page.goto(`/${SLUG}?party=2&date=${tomorrow}`);
  await page.getByRole("heading", { name: "Get offers and news" }).scrollIntoViewIfNeeded();
  await page.getByLabel("Name (optional)").fill("Una Updates");
  await page.locator('#updates-heading ~ form').getByLabel("Email").fill("delivered+una@resend.dev");
  await page.getByRole("button", { name: "Sign me up" }).click();
  await expect(page.getByText("You are signed up for offers and news")).toBeVisible();
  // signing up twice is harmless
  await page.locator('#updates-heading ~ form').getByLabel("Email").fill("DELIVERED+UNA@resend.dev");
  await page.getByRole("button", { name: "Sign me up" }).click();
  await expect(page.getByText("You are signed up for offers and news")).toBeVisible();

  // A waitlisted guest who later books is marked as having booked a table.
  await db.from("waitlist").insert({
    restaurant_id: restaurantId, guest_name: "Will Waitlisted", email: "delivered+will@resend.dev", phone: null, party_size: 2, wanted_date: tomorrow,
    from_time: "17:00", to_time: "20:00", status: "notified", marketing_opt_in: false,
  });
  const will = await browser.newPage();
  await will.goto(`/${SLUG}?party=2&date=${tomorrow}`);
  await will.getByRole("link", { name: "8:00 PM", exact: true }).click();
  await will.getByLabel("Full name").fill("Will Waitlisted");
  await will.getByLabel(/^Email/).fill("delivered+will@resend.dev");
  await will.getByRole("button", { name: "Confirm reservation" }).click();
  await will.waitForURL(/\/reservation\//);
  await will.close();

  const ctx = await browser.newContext();
  const owner = await ctx.newPage();
  await signIn(owner);
  await owner.goto(`/o/${SLUG}/guests`);
  const row = (name: string) => owner.locator("tbody tr", { hasText: name });
  await expect(row("Bea Booker")).toContainText("Reservation");
  await expect(row("Bea Booker")).toContainText("Upcoming");
  await expect(row("Bea Booker").getByLabel("Agreed to marketing emails")).toBeVisible();
  await expect(row("Ned NoConsent").getByLabel("Agreed to marketing emails")).toHaveCount(0);
  await expect(row("Una Updates")).toContainText("Signed up for updates");
  await expect(owner.locator("tbody tr", { hasText: "delivered+una@resend.dev" })).toHaveCount(1); // the second sign-up added nothing
  // the waitlist entry is now "Booked a table" (the guest's new reservation is a separate, upcoming row)
  await expect(owner.locator("tbody tr", { hasText: "Will Waitlisted" }).filter({ hasText: "Booked a table" })).toHaveCount(1);
  await expect(owner.locator("tbody tr", { hasText: "Will Waitlisted" }).filter({ hasText: "Told a table opened" })).toHaveCount(0);
  await ctx.close();
});
