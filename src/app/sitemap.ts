import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = ["", "/privacy", "/terms"].map((p) => ({ url: `${SITE_URL}${p}` }));
  try {
    const { data } = await createAdminClient().from("restaurants").select("slug").eq("online_enabled", true);
    return [...pages, ...(data ?? []).map((r) => ({ url: `${SITE_URL}/${r.slug}` }))];
  } catch {
    return pages;
  }
}
