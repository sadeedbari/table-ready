import { getRestaurantContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, todayKey } from "@/lib/format";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/misc";
import { ActionButton } from "@/components/ui/action-form";
import { checkWaitlist, removeWaitlistEntry } from "../actions";
import type { WaitlistEntry } from "@/lib/types";

export const metadata = { title: "Waitlist" };

const hhmm = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

export default async function WaitlistPage(props: PageProps<"/o/[slug]/waitlist">) {
  const { slug } = await props.params;
  const { restaurant } = await getRestaurantContext(slug);
  const supabase = await createClient();
  const { data } = await supabase
    .from("waitlist").select("*").eq("restaurant_id", restaurant.id).in("status", ["waiting", "notified"])
    .gte("wanted_date", todayKey(restaurant.timezone)).order("wanted_date").order("created_at");
  const entries = (data ?? []) as WaitlistEntry[];
  return (
    <>
      <PageHeader
        title="Waitlist"
        subtitle="Guests who wanted a time that was full. When a table opens, they are emailed automatically."
        actions={<ActionButton action={() => checkWaitlist(slug)} variant="tinted" size="md">Check for openings</ActionButton>}
      />
      {entries.length === 0 ? (
        <EmptyState title="Nobody is waiting" body="When a guest asks for a day with no free times, they can join the waitlist from your public page." />
      ) : (
        <ul className="space-y-3">
          {entries.map((w) => (
            <li key={w.id}>
              <Card className="flex flex-wrap items-center gap-x-6 gap-y-3 !p-4">
                <div className="min-w-[200px] flex-1">
                  <div className="flex items-center gap-2"><span className="text-[16px] font-semibold">{w.guest_name}</span><Badge tone={w.status === "notified" ? "green" : "orange"}>{w.status === "notified" ? "Told a table opened" : "Waiting"}</Badge></div>
                  <div className="mt-1 text-[14px] text-label-2">
                    {w.party_size} {w.party_size === 1 ? "guest" : "guests"} · {formatDate(`${w.wanted_date}T12:00:00Z`, "UTC", { weekday: "short", month: "short", day: "numeric" })} · {hhmm(w.from_time)} to {hhmm(w.to_time)}
                  </div>
                  <div className="mt-0.5 text-[14px] text-label-2">{w.email}{w.phone ? ` · ${w.phone}` : ""}</div>
                </div>
                <ActionButton action={() => removeWaitlistEntry(slug, w.id)} variant="plain">Remove</ActionButton>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
