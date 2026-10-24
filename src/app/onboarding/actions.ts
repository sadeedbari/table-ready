"use server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { friendlyDbError } from "@/lib/db-errors";
import { RESERVED_SLUGS, slugify } from "@/lib/utils";
import type { ActionResult } from "@/components/ui/action-form";

export async function createRestaurant(fd: FormData): Promise<ActionResult> {
  const user = await requireUser("/onboarding");
  const name = String(fd.get("name") || "").trim();
  const slug = slugify(String(fd.get("slug") || name));
  const timezone = String(fd.get("timezone") || "America/Toronto");
  const displayName = String(fd.get("display_name") || "").trim();
  if (!name) return { error: "Give your restaurant a name." };
  if (slug.length < 3) return { error: "Your link needs at least 3 letters or numbers." };
  if (RESERVED_SLUGS.has(slug)) return { error: "That link is reserved. Please try another." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_restaurant", { p_name: name, p_slug: slug, p_timezone: timezone, p_display_name: displayName });
  if (error) {
    if (error.code === "23505") return { error: "That link is already taken. Please try another." };
    return { error: friendlyDbError(error) };
  }
  void user;
  return { redirect: `/o/${slug}/tables` };
}
