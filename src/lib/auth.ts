import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Membership, Restaurant } from "@/lib/types";

export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});

export async function requireUser(next?: string) {
  const user = await getUser();
  if (!user) redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  return user;
}

export interface RestaurantContext {
  restaurant: Restaurant;
  me: Membership;
  isAdmin: boolean;
  isOwner: boolean;
}

/** Loads a restaurant by its link name and the signed-in person's membership in it (404 if they are not a member). */
export const getRestaurantContext = cache(async (slug: string): Promise<RestaurantContext> => {
  const user = await requireUser(`/o/${slug}`);
  const supabase = await createClient();
  const { data: restaurant } = await supabase.from("restaurants").select("*").eq("slug", slug).maybeSingle();
  if (!restaurant) notFound();
  const { data: me } = await supabase.from("memberships").select("*").eq("restaurant_id", restaurant.id).eq("user_id", user.id).maybeSingle();
  if (!me) notFound();
  return {
    restaurant: restaurant as Restaurant,
    me: me as Membership,
    isAdmin: me.role === "owner" || me.role === "admin",
    isOwner: me.role === "owner",
  };
});

export const getMyRestaurants = cache(async () => {
  const user = await getUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("memberships").select("role, restaurants(id, name, slug)").eq("user_id", user.id).order("created_at");
  return (data ?? [])
    .map((r) => ({ role: r.role as string, ...(r.restaurants as unknown as Pick<Restaurant, "id" | "name" | "slug">) }))
    .filter((o) => o.slug);
});
