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

const setPlan = (fields: Record<string, unknown>) => db.from("restaurant_plans").update(fields).eq("restaurant_id", restaurantId);
const past = () => new Date(Date.now() - 86_400_000).toISOString();

test.beforeEach(async () => {
  restaurantId = await seed();
});

test.afterAll(async () => {
  const { cleanup } = await import("../seed");
  await cleanup();
});

test("a new restaurant starts on a Pro trial", async ({ page }) => {
  await signIn(page);
  await page.goto(`/o/${SLUG}/settings`);
  await expect(page.getByText("Table Ready Pro")).toBeVisible();
  await expect(page.getByText(/left of your 30-day Pro trial/)).toBeVisible();
  const csv = await page.request.get(`/o/${SLUG}/guests/export`);
  expect(csv.status()).toBe(200);
});

test("on Free the guest list download is Pro-only and guest pages carry the branding; Pro removes both limits", async ({ page, request }) => {
  await setPlan({ trial_ends_at: past() });
  await signIn(page);
  await page.goto(`/o/${SLUG}/settings`);
  await expect(page.getByText("Table Ready Free")).toBeVisible();
  await expect(page.getByTestId("free-usage")).toContainText("of 50");
  const blocked = await page.request.get(`/o/${SLUG}/guests/export`);
  expect(blocked.status()).toBe(402);
  await page.goto(`/o/${SLUG}/guests`);
  await expect(page.getByRole("link", { name: /Download CSV · Pro/ })).toBeVisible();
  await page.goto(`/${SLUG}`);
  await expect(page.getByRole("link", { name: /table ready/i }).last()).toBeVisible();

  await setPlan({ status: "active", current_period_end: new Date(Date.now() + 20 * 86_400_000).toISOString() });
  const ok = await page.request.get(`/o/${SLUG}/guests/export`);
  expect(ok.status()).toBe(200);
  await page.goto(`/${SLUG}`);
  await expect(page.locator("main a[href='/']")).toHaveCount(0);
  void request;
});
