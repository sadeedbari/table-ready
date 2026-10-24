import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export const TOO_MANY = "Too many attempts. Please wait a few minutes and try again, or call the restaurant.";

/** Restaurants whose address starts with this are the automated tests' own. They are never limited, so the test suite can run quickly. */
export const TEST_SLUG_PREFIX = "e2e-";

/** A short hash of a visitor (address, email or phone). Raw values are never stored in the limits table. */
export function visitorKey(value: string): string {
  return createHash("sha256").update(`${env.supabaseServiceKey ?? "tableready"}:${value.trim().toLowerCase()}`).digest("hex").slice(0, 32);
}

/** The visitor's network address as the hosting platform reports it. */
export async function clientAddress(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}

export interface Limit {
  /** What is being limited, for example "reserve". The restaurant's address is added, so each restaurant has its own counts. */
  name: string;
  slug: string;
  max: number;
  windowSeconds: number;
  /** Who is counted. Defaults to the visitor's network address; pass an email or phone number to count that instead. */
  who?: string;
}

/**
 * May this visitor do this again? Returns false when they have used up their allowance in the time window.
 * If the limits table itself cannot be reached it says yes: a hiccup must not stop real guests from booking.
 */
export async function allow(limit: Limit): Promise<boolean> {
  if (limit.slug.startsWith(TEST_SLUG_PREFIX)) return true;
  try {
    const who = limit.who ?? (await clientAddress());
    const { data, error } = await createAdminClient().rpc("hit_rate_limit", {
      p_bucket: `${limit.name}:${limit.slug}`,
      p_key: visitorKey(who),
      p_max: limit.max,
      p_window_seconds: limit.windowSeconds,
    });
    if (error) {
      console.error("[rate-limit]", error.message);
      return true;
    }
    return data !== false;
  } catch (e) {
    console.error("[rate-limit]", e);
    return true;
  }
}

const MINUTE = 60;
const HOUR = 3600;

/** The allowances for each public form. Network-address limits for the walk-in line are generous because guests share the restaurant's Wi-Fi. */
export const LIMITS = {
  reserveByAddress: (slug: string): Limit => ({ name: "reserve", slug, max: 8, windowSeconds: 10 * MINUTE }),
  reserveByEmail: (slug: string, email: string): Limit => ({ name: "reserve-email", slug, max: 5, windowSeconds: HOUR, who: email }),
  waitlistByAddress: (slug: string): Limit => ({ name: "waitlist", slug, max: 8, windowSeconds: HOUR }),
  waitlistByEmail: (slug: string, email: string): Limit => ({ name: "waitlist-email", slug, max: 4, windowSeconds: HOUR, who: email }),
  signupByAddress: (slug: string): Limit => ({ name: "signup", slug, max: 5, windowSeconds: HOUR }),
  queueByAddress: (slug: string): Limit => ({ name: "queue", slug, max: 40, windowSeconds: 15 * MINUTE }),
  queueByPhone: (slug: string, phone: string): Limit => ({ name: "queue-phone", slug, max: 3, windowSeconds: HOUR, who: phone }),
  cancelByAddress: (slug: string): Limit => ({ name: "cancel", slug, max: 30, windowSeconds: 10 * MINUTE }),
};

/** The most upcoming reservations one email address may hold at a restaurant, so nobody can hoard tables. */
export const MAX_UPCOMING_PER_EMAIL = 4;
