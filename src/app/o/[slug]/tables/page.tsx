import { getRestaurantContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, Notice, PageHeader } from "@/components/ui/misc";
import { NewTable, TableEditor } from "./tables-client";
import type { DiningTable } from "@/lib/types";

export const metadata = { title: "Tables" };

export default async function TablesPage(props: PageProps<"/o/[slug]/tables">) {
  const { slug } = await props.params;
  const { restaurant, isAdmin } = await getRestaurantContext(slug);
  const supabase = await createClient();
  const { data } = await supabase.from("dining_tables").select("*").eq("restaurant_id", restaurant.id).order("position").order("name");
  const tables = (data ?? []) as DiningTable[];
  const live = tables.filter((t) => t.active);
  const online = live.filter((t) => t.online);
  const seats = (list: DiningTable[]) => list.reduce((n, t) => n + t.seats, 0);

  return (
    <>
      <PageHeader title="Tables" subtitle="Choose which tables guests can book online. Tables you leave off stay free for walk-ins and phone bookings." />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Card><div className="text-[13px] text-label-2">Open to online guests</div><div className="mt-1 text-[28px] font-semibold" style={{ fontFamily: "var(--font-display)" }}>{online.length} <span className="text-[15px] font-normal text-label-2">tables · {seats(online)} seats</span></div></Card>
        <Card><div className="text-[13px] text-label-2">Held for walk-ins and phone</div><div className="mt-1 text-[28px] font-semibold" style={{ fontFamily: "var(--font-display)" }}>{live.length - online.length} <span className="text-[15px] font-normal text-label-2">tables · {seats(live) - seats(online)} seats</span></div></Card>
        <Card><div className="text-[13px] text-label-2">Largest party online</div><div className="mt-1 text-[28px] font-semibold" style={{ fontFamily: "var(--font-display)" }}>{Math.min(restaurant.max_party_size, Math.max(0, ...online.map((t) => t.seats)))} <span className="text-[15px] font-normal text-label-2">guests</span></div></Card>
      </div>
      {!isAdmin && <div className="mb-4"><Notice tone="blue" live={false}>Only an owner or admin can change tables.</Notice></div>}
      {online.length === 0 && live.length > 0 && <div className="mb-4"><Notice tone="blue" live={false}>No table is open to online guests, so your public page will show no times. Switch at least one on.</Notice></div>}
      <div className="space-y-3">
        {tables.map((t) => <TableEditor key={t.id} slug={slug} table={t} disabled={!isAdmin} />)}
      </div>
      {isAdmin && <NewTable slug={slug} />}
    </>
  );
}
