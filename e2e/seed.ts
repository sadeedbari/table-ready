// Creates (or resets) the tagged test data: one confirmed owner and one restaurant "E2E Bistro" with the starter tables and dinner hours.
// Run with: npx tsx e2e/seed.ts   (needs .env.local). Remove everything with: npx tsx e2e/cleanup.ts
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
}
export const OWNER = { email: "owner@tableready-e2e.test", password: "E2e-Passw0rd!" };
export const SLUG = "e2e-bistro";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

export async function cleanup() {
  await admin.from("restaurants").delete().like("slug", "e2e-%");
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const u of data?.users ?? []) if (u.email?.endsWith("@tableready-e2e.test")) await admin.auth.admin.deleteUser(u.id);
}

export async function seed() {
  await cleanup();
  const { error: ue } = await admin.auth.admin.createUser({ email: OWNER.email, password: OWNER.password, email_confirm: true, user_metadata: { full_name: "Olivia Owner" } });
  if (ue) throw ue;
  const user = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const { error: se } = await user.auth.signInWithPassword(OWNER);
  if (se) throw se;
  const { data: id, error } = await user.rpc("create_restaurant", { p_name: "E2E Bistro", p_slug: SLUG, p_timezone: "America/Toronto", p_display_name: "Olivia Owner" });
  if (error) throw error;
  return id as string;
}

if (process.argv[1]?.endsWith("seed.ts")) {
  seed().then((id) => console.log("seeded restaurant", id)).catch((e) => { console.error(e); process.exit(1); });
}
