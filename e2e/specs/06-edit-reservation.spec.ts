import { createClient } from "@supabase/supabase-js";
import { test, expect, type Page } from "@playwright/test";
import { OWNER, SLUG, seed } from "../seed";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const tomorrow = new Date(Date.now() + 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
let restaurantId = "";

/** Tomorrow at a local Toronto time, as an instant (EDT or EST: keep the offset that round-trips). */
function at(hhmm: string) {
  for (const off of ["-04:00", "-05:00"]) {
    const d = new Date(`${tomorrow}T${hhmm}:00${off}`);
    if (d.toLocaleTimeString("en-GB", { timeZone: "America/Toronto", hour: "2-digit", minute: "2-digit" }) === hhmm) return d.toISOString();
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

async function tableId(name: string) {
  const { data } = await db.from("dining_tables").select("id").eq("restaurant_id", restaurantId).eq("name", name).single();
  return data!.id as string;
}

async function book(name: string, party: number, time: string, table: string, extra: { email?: string; phone?: string } = {}) {
  const { data, error } = await db.rpc("book_table", {
    p_restaurant: restaurantId, p_name: name, p_email: extra.email ?? "", p_phone: extra.phone ?? "", p_party: party, p_starts: at(time), p_notes: "", p_source: "host", p_table: await tableId(table),
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row.reservation_id as string;
}

test.beforeEach(async () => {
  restaurantId = await seed();
});

test.afterAll(async () => {
  const { cleanup } = await import("../seed");
  await cleanup();
});

test("staff change the time and number of guests: the table is re-checked, the list updates, and the guest is emailed", async ({ browser }) => {
  const id = await book("Carl Caller", 2, "18:00", "T1", { email: "delivered+carl@resend.dev", phone: "+14165550142" });
  const ctx = await browser.newContext();
  const owner = await ctx.newPage();
  await signIn(owner);
  await owner.goto(`/o/${SLUG}?date=${tomorrow}`);
  const card = owner.locator("li", { hasText: "Carl Caller" });
  await expect(card).toContainText("6:00 PM");
  await card.getByRole("button", { name: "Edit" }).click();
  const dlg = owner.getByRole("dialog");
  await expect(dlg.getByLabel("Guest name")).toHaveValue("Carl Caller");
  await expect(dlg.getByLabel("Time", { exact: true })).toHaveValue("18:00");
  await dlg.getByLabel("Guests", { exact: true }).fill("4");
  await dlg.getByLabel("Time", { exact: true }).fill("19:30");
  await expect(dlg.getByRole("checkbox", { name: /Email the guest/ })).toBeChecked();
  await dlg.getByRole("button", { name: "Save changes" }).click();
  await expect(owner.getByText("Reservation updated and the guest was emailed")).toBeVisible();

  await expect(card).toContainText("7:30 PM");
  await expect(card).toContainText("until 9:00 PM"); // a party of 4 keeps its table 90 minutes
  const { data: r } = await db.from("reservations").select("party_size, starts_at, ends_at, table_id, reminder_sent_at, dining_tables(seats)").eq("id", id).single();
  expect(r!.party_size).toBe(4);
  expect(new Date(r!.starts_at).getTime()).toBe(new Date(at("19:30")).getTime());
  expect((new Date(r!.ends_at).getTime() - new Date(r!.starts_at).getTime()) / 60000).toBe(90);
  expect((r!.dining_tables as unknown as { seats: number }).seats).toBeGreaterThanOrEqual(4); // moved off the two-top
  expect(r!.reminder_sent_at).toBeNull(); // the day-before reminder will use the new time
  await ctx.close();
});

test("a change that clashes with another booking is refused and nothing changes", async ({ browser }) => {
  const id = await book("Cora Clash", 2, "18:00", "T1");
  for (const t of ["T1", "T2", "T3", "T4", "T5", "T6"]) await book(`Blocker ${t}`, 2, "20:00", t); // every table is taken at 8:00 PM
  const ctx = await browser.newContext();
  const owner = await ctx.newPage();
  await signIn(owner);
  await owner.goto(`/o/${SLUG}?date=${tomorrow}`);
  await owner.locator("li", { hasText: "Cora Clash" }).getByRole("button", { name: "Edit" }).click();
  const dlg = owner.getByRole("dialog");
  await dlg.getByLabel("Time", { exact: true }).fill("20:00");
  await dlg.getByRole("button", { name: "Save changes" }).click();
  await expect(dlg.getByText("No table is free at that time")).toBeVisible();
  const { data } = await db.from("reservations").select("starts_at").eq("id", id).single();
  expect(new Date(data!.starts_at).getTime()).toBe(new Date(at("18:00")).getTime());
  await ctx.close();
});

test("contact details and notes can be changed without emailing anyone, and a party can move to a chosen table", async ({ browser }) => {
  const id = await book("Nina Notes", 2, "18:00", "T1", { email: "delivered+nina@resend.dev" });
  const ctx = await browser.newContext();
  const owner = await ctx.newPage();
  await signIn(owner);
  await owner.goto(`/o/${SLUG}?date=${tomorrow}`);
  await owner.locator("li", { hasText: "Nina Notes" }).getByRole("button", { name: "Edit" }).click();
  let dlg = owner.getByRole("dialog");
  await dlg.getByLabel("Guest name").fill("Nina Notes-Smith");
  await dlg.getByLabel("Phone (optional)").fill("416 555 0177");
  await dlg.getByLabel("Notes (optional)").fill("Prefers the window");
  await dlg.getByRole("button", { name: "Save changes" }).click();
  await expect(owner.getByText("Reservation updated", { exact: true })).toBeVisible(); // no "guest was emailed": the time did not change
  const { data: a } = await db.from("reservations").select("guest_name, phone, notes, party_size").eq("id", id).single();
  expect(a).toEqual({ guest_name: "Nina Notes-Smith", phone: "+14165550177", notes: "Prefers the window", party_size: 2 });
  await expect(owner.locator("li", { hasText: "Nina Notes-Smith" })).toContainText("Prefers the window");

  // Choose a specific table.
  await owner.locator("li", { hasText: "Nina Notes-Smith" }).getByRole("button", { name: "Edit" }).click();
  dlg = owner.getByRole("dialog");
  await dlg.getByLabel("Table").selectOption({ label: "T5 (seats 4)" });
  await dlg.getByRole("button", { name: "Save changes" }).click();
  await expect(owner.getByText("Table T5")).toBeVisible();
  // Without an email address the "email the guest" option is switched off.
  await owner.locator("li", { hasText: "Nina Notes-Smith" }).getByRole("button", { name: "Edit" }).click();
  dlg = owner.getByRole("dialog");
  await dlg.getByLabel("Email (optional)").fill("");
  await expect(dlg.getByRole("checkbox", { name: /Email the guest/ })).toBeDisabled();
  await ctx.close();
});
