import { getRestaurantContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayKey } from "@/lib/format";
import { Notice, PageHeader } from "@/components/ui/misc";
import { ClosureList, NewPeriod, PeriodEditor, RulesForm } from "./hours-client";
import type { Closure, ServicePeriod } from "@/lib/types";

export const metadata = { title: "Hours & rules" };

export default async function HoursPage(props: PageProps<"/o/[slug]/hours">) {
  const { slug } = await props.params;
  const { restaurant, isAdmin } = await getRestaurantContext(slug);
  const supabase = await createClient();
  const [{ data: periods }, { data: closures }] = await Promise.all([
    supabase.from("service_periods").select("*").eq("restaurant_id", restaurant.id).order("opens"),
    supabase.from("closures").select("*").eq("restaurant_id", restaurant.id).gte("on_date", todayKey(restaurant.timezone)).order("on_date"),
  ]);
  return (
    <>
      <PageHeader title="Hours & rules" subtitle="When guests can book, how long they keep a table, and how far ahead they can plan." />
      {!isAdmin && <div className="mb-4"><Notice tone="blue" live={false}>Only an owner or admin can change these settings.</Notice></div>}

      <h2 className="mb-1 text-[20px]">Services</h2>
      <p className="mb-3 text-[14px] text-label-2">Each service is an opening window on certain days. Guests can book any time from opening up to the last seating.</p>
      <div className="space-y-3">
        {((periods ?? []) as ServicePeriod[]).map((p) => <PeriodEditor key={p.id} slug={slug} period={p} disabled={!isAdmin} />)}
      </div>
      {isAdmin && <NewPeriod slug={slug} />}

      <h2 className="mt-10 mb-1 text-[20px]">Days closed</h2>
      <p className="mb-3 text-[14px] text-label-2">Holidays and private events. Guests cannot book online on these days.</p>
      <ClosureList slug={slug} closures={(closures ?? []) as Closure[]} disabled={!isAdmin} />

      <h2 className="mt-10 mb-1 text-[20px]">Booking rules</h2>
      <RulesForm slug={slug} r={restaurant} disabled={!isAdmin} />
    </>
  );
}
