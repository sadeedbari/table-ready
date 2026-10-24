import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadRestaurantData } from "@/lib/reservations";
import { createAdminClient } from "@/lib/supabase/admin";
import { openQueue } from "@/lib/queue";
import { activeNotices } from "@/lib/notices-server";
import { NoticeBanner } from "@/components/app/notice-banner";
import { JoinForm } from "./join-form";

export const metadata: Metadata = { title: "Join the line", robots: { index: false, follow: false } };

export default async function JoinQueuePage(props: PageProps<"/[slug]/queue">) {
  const { slug } = await props.params;
  const data = await loadRestaurantData(slug);
  if (!data) notFound();
  const r = data.restaurant;
  const notices = await activeNotices(r.id, "queue");
  let ahead = 0;
  if (r.queue_open) {
    const { data: rows } = await createAdminClient().from("walkins").select("id, status, joined_at").eq("restaurant_id", r.id).in("status", ["waiting", "ready"]);
    ahead = openQueue(rows ?? []).filter((w) => w.status === "waiting").length;
  }
  return (
    <main className="mx-auto max-w-md px-4 pb-16">
      <header className="pt-10 pb-6">
        <h1 className="text-[32px] leading-tight sm:text-[40px]">{r.name}</h1>
        <p className="mt-2 text-[16px] text-label-2">Join the line and we will tell you when your table is ready.</p>
      </header>
      <div className="mb-4"><NoticeBanner notices={notices} timeZone={r.timezone} /></div>
      <section className="rounded-[24px] bg-surface p-5 shadow-md hairline sm:p-7">
        {r.queue_open ? (
          <>
            <p className="mb-5 rounded-[12px] bg-accent-soft px-3.5 py-2.5 text-[14px] font-medium text-accent-text" aria-live="polite">
              {ahead === 0 ? "No one is waiting right now." : `${ahead} ${ahead === 1 ? "party is" : "parties are"} waiting ahead of you.`}
            </p>
            <JoinForm slug={slug} maxParty={r.max_party_size} restaurant={r.name} />
          </>
        ) : (
          <div className="py-4 text-center">
            <h2 className="text-[22px]">The line is not open online</h2>
            <p className="mt-2 text-[15px] text-label-2">Please check in with the host{r.phone ? <> or call <a className="underline" href={`tel:${r.phone}`}>{r.phone}</a></> : ""}.</p>
            <p className="mt-4"><Link className="text-accent-text underline" href={`/${slug}`}>Reserve a table instead</Link></p>
          </div>
        )}
      </section>
    </main>
  );
}
