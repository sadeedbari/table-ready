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

const minutes = (m: number) => new Date(Date.now() + m * 60_000).toISOString();
const notice = (message: string, start: number, end: number, reservations = true, queue = true) =>
  ({ restaurant_id: restaurantId, message, starts_at: minutes(start), ends_at: minutes(end), show_reservations: reservations, show_queue: queue });

test.beforeEach(async () => {
  restaurantId = await seed();
});

test.afterAll(async () => {
  const { cleanup } = await import("../seed");
  await cleanup();
});

test("the restaurant posts a notice from Settings, guests see it at the top, and it can be ended early", async ({ page, browser }) => {
  const ctx = await browser.newContext();
  const owner = await ctx.newPage();
  await signIn(owner);
  await owner.goto(`/o/${SLUG}/settings`);
  await expect(owner.getByRole("heading", { name: "Guest notice" })).toBeVisible();
  await owner.getByLabel("Message guests will see").fill("The kitchen is backed up tonight, so waits are longer than quoted.");
  await owner.getByRole("button", { name: "In 1 hour" }).click();
  await expect(owner.getByLabel("Ends (it disappears then)")).not.toHaveValue("");
  await owner.getByRole("button", { name: "Show this notice" }).click();
  await expect(owner.getByText("Notice is showing to guests")).toBeVisible();
  await expect(owner.getByText("Showing now")).toBeVisible();

  // Guests see it at the top of the reservation page and the walk-in line.
  await page.goto(`/${SLUG}?party=2&date=${tomorrow}`);
  const banner = page.getByTestId("guest-notices");
  await expect(banner).toContainText("The kitchen is backed up tonight");
  await expect(banner).toContainText("until");
  const bannerY = (await banner.boundingBox())!.y;
  const formY = (await page.getByRole("heading", { name: "Reserve a table" }).boundingBox())!.y;
  expect(bannerY).toBeLessThan(formY); // above the booking section
  await page.goto(`/${SLUG}/queue`);
  await expect(page.getByTestId("guest-notices")).toContainText("The kitchen is backed up tonight");

  // Staff see what guests currently see.
  await owner.goto(`/o/${SLUG}`);
  await expect(owner.getByTestId("guest-notices")).toContainText("Guests see:");

  // Ending it early takes it down straight away.
  await owner.goto(`/o/${SLUG}/settings`);
  await owner.getByRole("button", { name: "End now" }).click();
  await expect(owner.getByText("Notice ended")).toBeVisible();
  await page.goto(`/${SLUG}?party=2&date=${tomorrow}`);
  await expect(page.getByTestId("guest-notices")).toHaveCount(0);
  await ctx.close();
});

test("only notices that are in their time window show, and each one only where it was meant to", async ({ page, browser }) => {
  await db.from("guest_notices").insert([
    notice("Expired notice", -120, -1),
    notice("Scheduled notice", 120, 240),
    notice("Reservations only notice", -5, 60, true, false),
    notice("Line only notice", -5, 60, false, true),
  ]);
  await page.goto(`/${SLUG}?party=2&date=${tomorrow}`);
  await expect(page.getByTestId("guest-notices")).toContainText("Reservations only notice");
  await expect(page.getByText("Expired notice")).toHaveCount(0);
  await expect(page.getByText("Scheduled notice")).toHaveCount(0);
  await expect(page.getByText("Line only notice")).toHaveCount(0);
  await page.goto(`/${SLUG}/queue`);
  await expect(page.getByTestId("guest-notices")).toContainText("Line only notice");
  await expect(page.getByText("Reservations only notice")).toHaveCount(0);

  // Settings lists all of them with their state.
  const ctx = await browser.newContext();
  const owner = await ctx.newPage();
  await signIn(owner);
  await owner.goto(`/o/${SLUG}/settings`);
  await expect(owner.locator("li", { hasText: "Expired notice" }).getByText("Ended")).toBeVisible();
  await expect(owner.locator("li", { hasText: "Scheduled notice" }).getByText("Scheduled", { exact: true })).toBeVisible();
  await expect(owner.locator("li", { hasText: "Line only notice" }).getByText("Showing now")).toBeVisible();
  await owner.locator("li", { hasText: "Expired notice" }).getByRole("button", { name: "Delete" }).click();
  await expect(owner.getByText("Expired notice")).toHaveCount(0);
  await ctx.close();
});

test("a notice that ends in the past, or before it starts, is refused with a plain message", async ({ browser }) => {
  const ctx = await browser.newContext();
  const owner = await ctx.newPage();
  await signIn(owner);
  await owner.goto(`/o/${SLUG}/settings`);
  await owner.getByLabel("Message guests will see").fill("Testing the checks");
  await owner.getByLabel("Ends (it disappears then)").fill("2020-01-01T10:00");
  await owner.getByRole("button", { name: "Show this notice" }).click();
  await expect(owner.getByText("The end time has already passed")).toBeVisible();
  await owner.getByLabel("Starts").fill("2099-01-02T10:00");
  await owner.getByLabel("Ends (it disappears then)").fill("2099-01-01T10:00");
  await owner.getByRole("button", { name: "Show this notice" }).click();
  await expect(owner.getByText("The notice has to end after it starts")).toBeVisible();
  const { data } = await db.from("guest_notices").select("id").eq("restaurant_id", restaurantId);
  expect(data).toEqual([]);
  await ctx.close();
});
