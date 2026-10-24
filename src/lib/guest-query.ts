import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDaysToKey } from "@/lib/format";
import { instantAt } from "@/lib/hours";
import { PAGE_SIZE, type GuestFilters, type GuestRow } from "@/lib/guest-list";

const COLUMNS = "id, mode, guest_name, email, phone, party_size, added_at, event_at, outcome, marketing_opt_in, source";

/** The guest list for a restaurant with the chosen filters, newest first. Runs as the signed-in person, so team-only rules apply. */
export function guestQuery(supabase: SupabaseClient, restaurantId: string, timeZone: string, f: GuestFilters) {
  let q = supabase.from("guest_log").select(COLUMNS, { count: "exact" }).eq("restaurant_id", restaurantId);
  if (f.mode) q = q.eq("mode", f.mode);
  if (f.outcome) q = q.eq("outcome", f.outcome);
  if (f.marketing) q = q.eq("marketing_opt_in", true);
  if (f.q) q = q.or(`guest_name.ilike.%${f.q}%,email.ilike.%${f.q}%,phone.ilike.%${f.q}%`);
  if (f.from) q = q.gte("added_at", instantAt(f.from, 0, timeZone).toISOString());
  if (f.to) q = q.lt("added_at", instantAt(addDaysToKey(f.to, 1), 0, timeZone).toISOString());
  return q.order("added_at", { ascending: false });
}

export async function loadGuestPage(supabase: SupabaseClient, restaurantId: string, timeZone: string, f: GuestFilters) {
  const from = (f.page - 1) * PAGE_SIZE;
  const { data, count } = await guestQuery(supabase, restaurantId, timeZone, f).range(from, from + PAGE_SIZE - 1);
  return { rows: (data ?? []) as GuestRow[], total: count ?? 0 };
}

/** Everything that matches (up to a limit), for the CSV file. */
export async function loadGuestExport(supabase: SupabaseClient, restaurantId: string, timeZone: string, f: GuestFilters, limit = 10000) {
  const { data } = await guestQuery(supabase, restaurantId, timeZone, f).range(0, limit - 1);
  return (data ?? []) as GuestRow[];
}

/** Headline numbers for the cards at the top (not affected by the filters). */
export async function guestCounts(supabase: SupabaseClient, restaurantId: string) {
  const count = async (apply: (q: ReturnType<typeof base>) => ReturnType<typeof base>) => {
    const { count: n } = await apply(base());
    return n ?? 0;
  };
  const base = () => supabase.from("guest_log").select("id", { count: "exact", head: true }).eq("restaurant_id", restaurantId);
  const [all, showed, noShow, marketing] = await Promise.all([
    count((q) => q),
    count((q) => q.eq("outcome", "showed")),
    count((q) => q.eq("outcome", "no_show")),
    count((q) => q.eq("marketing_opt_in", true)),
  ]);
  return { all, showed, noShow, marketing };
}
