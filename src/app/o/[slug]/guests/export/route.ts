import { NextResponse, type NextRequest } from "next/server";
import { getRestaurantContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseFilters, toCsv } from "@/lib/guest-list";
import { loadGuestExport } from "@/lib/guest-query";

/** The guest list (with the same filters as the page) as a CSV file. Owners and admins only: it holds guests' contact details. */
export async function GET(request: NextRequest, ctx: RouteContext<"/o/[slug]/guests/export">) {
  const { slug } = await ctx.params;
  const { restaurant, isAdmin } = await getRestaurantContext(slug);
  if (!isAdmin) return new NextResponse("Only an owner or admin can download the guest list.", { status: 403 });
  const filters = parseFilters(Object.fromEntries(new URL(request.url).searchParams));
  const rows = await loadGuestExport(await createClient(), restaurant.id, restaurant.timezone, filters);
  const stamp = new Date().toLocaleDateString("en-CA", { timeZone: restaurant.timezone });
  return new NextResponse("﻿" + toCsv(rows, restaurant.timezone), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}-guests-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
