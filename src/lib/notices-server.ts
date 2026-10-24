import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ActiveNotice { id: string; message: string; ends_at: string }

/** Notices guests should see right now on the reservation page (which holds the waitlist) or on the walk-in line pages. */
export async function activeNotices(restaurantId: string, where: "reservations" | "queue"): Promise<ActiveNotice[]> {
  const now = new Date().toISOString();
  const { data } = await createAdminClient()
    .from("guest_notices")
    .select("id, message, ends_at")
    .eq("restaurant_id", restaurantId)
    .eq(where === "reservations" ? "show_reservations" : "show_queue", true)
    .lte("starts_at", now)
    .gt("ends_at", now)
    .order("created_at", { ascending: false })
    .limit(3);
  return data ?? [];
}
