import { createClient } from "@supabase/supabase-js";
import { test, expect, type Page } from "@playwright/test";
import { OWNER, SLUG, seed } from "../seed";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const tomorrow = new Date(Date.now() + 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
let restaurantId = "";
let queueToken = "";
let reservationToken = "";

test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

test.beforeAll(async () => {
  restaurantId = await seed();
  await db.from("restaurants").update({ queue_open: true }).eq("id", restaurantId);
  const { data: w } = await db.from("walkins").insert({ restaurant_id: restaurantId, guest_name: "Walt Walkin", party_size: 4, phone: "+14165550123", email: null, notes: "Wants a booth", quoted_minutes: 20, status: "waiting", source: "host" }).select("token").single();
  queueToken = w!.token;
  const start = new Date(Date.now() + 26 * 3600_000);
  start.setMinutes(0, 0, 0);
  const { data: t } = await db.from("dining_tables").select("id").eq("restaurant_id", restaurantId).eq("name", "T1").single();
  const { data: res } = await db.rpc("book_table", { p_restaurant: restaurantId, p_name: "Gina Guest", p_email: "", p_phone: "+14165550101", p_party: 2, p_starts: start.toISOString(), p_notes: "Window seat", p_source: "host", p_table: t!.id });
  reservationToken = (Array.isArray(res) ? res[0] : res).token;
  await db.from("waitlist").insert({ restaurant_id: restaurantId, guest_name: "Wanda Waiting", email: "delivered+wanda@resend.dev", phone: null, party_size: 3, wanted_date: tomorrow, from_time: "17:00", to_time: "20:00", status: "waiting" });
});

test.afterAll(async () => {
  const { cleanup } = await import("../seed");
  await cleanup();
});

/** What goes wrong on a phone: the page scrolls sideways, fields smaller than 16px make iPhones zoom in, tiny tap targets. */
async function audit(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const visible = (e: Element) => (e as HTMLElement).offsetParent !== null || getComputedStyle(e).position === "fixed";
    const fields = [...document.querySelectorAll<HTMLElement>("input:not([type=checkbox]):not([type=radio]):not([type=hidden]), select, textarea")]
      .filter((e) => visible(e) && !e.closest("[aria-hidden=true]") && e.getBoundingClientRect().width > 4)
      .filter((e) => parseFloat(getComputedStyle(e).fontSize) < 16)
      .map((e) => e.getAttribute("name") || e.tagName);
    const tiny = [...document.querySelectorAll<HTMLElement>("main button, main a[href], header button, header a[href], nav a[href]")]
      // Switches use the standard 51x31 iPhone size, and links inside a sentence are as big as the text around them.
      .filter((e) => visible(e) && !e.closest("[aria-hidden=true]") && e.getAttribute("role") !== "switch" && !e.closest("p, li"))
      .map((e) => ({ text: (e.textContent || e.getAttribute("aria-label") || "").trim().slice(0, 24), h: Math.round(e.getBoundingClientRect().height), w: Math.round(e.getBoundingClientRect().width) }))
      .filter((x) => x.h > 0 && x.w > 0 && (x.h < 32 || (x.w < 32 && x.text.length > 0)));
    // Form controls drawn on top of each other (a layout that only breaks on a narrow screen).
    const controls = [...document.querySelectorAll<HTMLElement>("input:not([type=hidden]), select, textarea, button[role=switch]")]
      .filter((e) => visible(e) && e.getBoundingClientRect().width > 4 && e.getBoundingClientRect().height > 4);
    const overlaps: string[] = [];
    for (let i = 0; i < controls.length; i++) {
      for (let j = i + 1; j < controls.length; j++) {
        const a = controls[i].getBoundingClientRect();
        const b = controls[j].getBoundingClientRect();
        if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) {
          overlaps.push(`${controls[i].getAttribute("name") || controls[i].getAttribute("aria-label")} over ${controls[j].getAttribute("name") || controls[j].getAttribute("aria-label")}`);
        }
      }
    }
    // A control that sticks out past the form or card it sits in (the background box).
    const outside = controls
      .filter((c) => {
        const box = c.closest("form, [role=dialog]");
        if (!box) return false;
        const r = c.getBoundingClientRect();
        const f = box.getBoundingClientRect();
        return r.right > f.right + 1 || r.left < f.left - 1;
      })
      .map((c) => c.getAttribute("name") || c.getAttribute("aria-label") || c.tagName);
    return { overflow: doc.scrollWidth - doc.clientWidth, fields, tiny, overlaps, outside };
  });
}

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(OWNER.email);
  await page.getByLabel("Password").fill(OWNER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(new RegExp(`/o/${SLUG}`));
}

test("public pages fit a 375px phone: no sideways scroll, fields at least 16px, tap targets at least 32px", async ({ page }) => {
  const urls = [
    "/", "/login", "/signup", "/privacy", "/terms",
    `/${SLUG}?party=2&date=${tomorrow}`,
    `/${SLUG}?party=12&date=${tomorrow}`,
    `/${SLUG}/queue`,
    `/queue/${queueToken}`,
    `/reservation/${reservationToken}`,
  ];
  const problems: string[] = [];
  for (const u of urls) {
    await page.goto(u);
    await page.waitForLoadState("networkidle");
    const a = await audit(page);
    if (a.overflow > 1) problems.push(`${u}: scrolls sideways by ${a.overflow}px`);
    if (a.fields.length) problems.push(`${u}: fields under 16px: ${a.fields.join(", ")}`);
    if (a.tiny.length) problems.push(`${u}: small tap targets: ${a.tiny.map((t) => `${t.text} ${t.w}x${t.h}`).join("; ")}`);
  }
  // The details step of the booking form.
  await page.goto(`/${SLUG}?party=2&date=${tomorrow}`);
  await page.getByRole("link", { name: "6:00 PM", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your details" })).toBeVisible();
  const a = await audit(page);
  if (a.overflow > 1) problems.push(`details step: scrolls sideways by ${a.overflow}px`);
  if (a.fields.length) problems.push(`details step: fields under 16px: ${a.fields.join(", ")}`);
  if (a.tiny.length) problems.push(`details step: small tap targets: ${a.tiny.map((t) => `${t.text} ${t.w}x${t.h}`).join("; ")}`);
  expect(problems, problems.join("\n")).toEqual([]);
});

test("the restaurant's screens fit a 375px phone", async ({ page }) => {
  await signIn(page);
  const problems: string[] = [];
  for (const path of ["", "/queue", "/tables", "/hours", "/waitlist", "/settings"]) {
    await page.goto(`/o/${SLUG}${path}?date=${tomorrow}`);
    await page.waitForLoadState("networkidle");
    const a = await audit(page);
    if (a.overflow > 1) problems.push(`${path || "/"}: scrolls sideways by ${a.overflow}px`);
    if (a.fields.length) problems.push(`${path || "/"}: fields under 16px: ${a.fields.join(", ")}`);
    if (a.tiny.length) problems.push(`${path || "/"}: small tap targets: ${a.tiny.map((t) => `${t.text} ${t.w}x${t.h}`).join("; ")}`);
    if (a.overlaps.length) problems.push(`${path || "/"}: controls overlap: ${a.overlaps.join("; ")}`);
    if (a.outside.length) problems.push(`${path || "/"}: controls stick out of their box: ${a.outside.join(", ")}`);
  }
  expect(problems, problems.join("\n")).toEqual([]);
});

test("the app can be installed: manifest, icons and service worker are served", async ({ request, page }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.status()).toBe(200);
  const m = await res.json();
  expect(m).toMatchObject({ name: "Table Ready", display: "standalone", start_url: "/app" });
  const sizes = m.icons.map((i: { sizes: string; purpose: string }) => `${i.sizes}:${i.purpose}`);
  expect(sizes).toEqual(expect.arrayContaining(["192x192:any", "512x512:any", "512x512:maskable"]));
  for (const icon of m.icons) {
    const r = await request.get(icon.src);
    expect(r.status(), icon.src).toBe(200);
    expect(r.headers()["content-type"]).toContain("image/png");
  }
  const sw = await request.get("/sw.js");
  expect(sw.status()).toBe(200);
  expect(await sw.text()).toContain('addEventListener("push"');
  await page.goto("/");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", /apple-touch-180/);
});

test("the owner can switch alerts off and on from Settings", async ({ page }) => {
  await signIn(page);
  await page.goto(`/o/${SLUG}/settings`);
  await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
  await expect(page.getByText("Notifications on this device")).toBeVisible();
  await page.getByRole("switch", { name: "Email alerts" }).click();
  await page.getByRole("button", { name: "Save", exact: true }).first().click();
  await expect(page.getByText("Notification settings saved")).toBeVisible();
  const { data } = await db.from("restaurants").select("notify_email, notify_push").eq("id", restaurantId).single();
  expect(data).toEqual({ notify_email: false, notify_push: true });
});

test("Sign out lives at the bottom of Settings, not in the top bar, and it signs the person out", async ({ page }) => {
  await signIn(page);
  await page.goto(`/o/${SLUG}`);
  await expect(page.locator("header").getByRole("button", { name: "Sign out" })).toHaveCount(0);
  await page.goto(`/o/${SLUG}/settings`);
  const button = page.getByRole("button", { name: "Sign out" });
  await expect(button).toBeVisible();
  const lastCard = (await page.locator("main > *").last().boundingBox())!;
  const buttonBox = (await button.boundingBox())!;
  expect(buttonBox.y).toBeGreaterThan(lastCard.y - 1); // it is in the last section of the page
  await button.click();
  await page.waitForURL((u) => u.pathname === "/");
  await page.goto(`/o/${SLUG}`);
  await expect(page).toHaveURL(/\/login/);
});

test("'Public page' opens a new tab in a browser, but is taken over for the phone's own browser when clicked from the installed app", async ({ browser }) => {
  const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
  const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
  /** Opens the dashboard as a phone (installed or not) and says whether the app cancelled the link's own new-tab behaviour. */
  async function takenOver(userAgent: string, installed: boolean) {
    const ctx = await browser.newContext({ userAgent, viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true });
    await ctx.addInitScript((standalone: boolean) => {
      if (standalone) {
        const original = window.matchMedia.bind(window);
        window.matchMedia = (q: string) => (q.includes("display-mode: standalone") ? ({ ...original(q), matches: true } as MediaQueryList) : original(q));
      }
      // runs after the app's own click handler, so it sees whether the app cancelled the link
      window.addEventListener("click", (e) => { (window as unknown as { __cancelled: boolean }).__cancelled = e.defaultPrevented; });
    }, installed);
    const page = await ctx.newPage();
    await signIn(page);
    const link = page.getByRole("link", { name: /Public page/ });
    await expect(link).toHaveAttribute("href", `/${SLUG}`);
    await expect(link).toHaveAttribute("target", "_blank");
    await link.click({ noWaitAfter: true }).catch(() => {});
    const cancelled = await page.evaluate(() => (window as unknown as { __cancelled?: boolean }).__cancelled).catch(() => undefined);
    await ctx.close();
    return cancelled;
  }
  expect(await takenOver(IPHONE, true)).toBe(true); // installed on an iPhone: handed to Safari
  expect(await takenOver(ANDROID, true)).toBe(true); // installed on Android: handed to Chrome
  expect(await takenOver(IPHONE, false)).toBe(false); // an ordinary browser tab: the normal new tab
  expect(await takenOver(ANDROID, false)).toBe(false);
});
