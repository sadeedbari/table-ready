import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BellRing, Clock, Phone } from "lucide-react";
import { Card } from "@/components/ui/misc";
import { Logo } from "@/components/app/logo";
import { createAdminClient } from "@/lib/supabase/admin";
import { minutesLeft, partiesAhead } from "@/lib/queue";
import { activeNotices } from "@/lib/notices-server";
import { NoticeBanner } from "@/components/app/notice-banner";
import { LeaveButton, StatusPoller } from "./status-client";
import type { Restaurant, Walkin } from "@/lib/types";

export const metadata: Metadata = { title: "Your place in line", robots: { index: false, follow: false } };

/** Where this party stands, worked out on the server so rendering stays pure. */
function standing(w: Walkin, all: Pick<Walkin, "id" | "status" | "joined_at">[]) {
  return { ahead: partiesAhead(all, w.id), left: minutesLeft(w.quoted_minutes, w.joined_at, Date.now()) };
}

export default async function QueueStatusPage(props: PageProps<"/queue/[token]">) {
  const { token } = await props.params;
  if (!/^[a-f0-9]{48}$/.test(token)) notFound();
  const db = createAdminClient();
  const { data: row } = await db.from("walkins").select("*").eq("token", token).maybeSingle();
  if (!row) notFound();
  const w = row as Walkin;
  const { data: rest } = await db.from("restaurants").select("*").eq("id", w.restaurant_id).single();
  if (!rest) notFound();
  const r = rest as Restaurant;
  const { data: open } = await db.from("walkins").select("id, status, joined_at").eq("restaurant_id", r.id).in("status", ["waiting", "ready"]);
  const { ahead, left } = standing(w, open ?? []);
  const live = w.status === "waiting" || w.status === "ready";
  const notices = live ? await activeNotices(r.id, "queue") : [];

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      {live && <StatusPoller />}
      {notices.length > 0 && <div className="mb-4"><NoticeBanner notices={notices} timeZone={r.timezone} /></div>}
      <Card className="!p-7 text-center">
        <p className="text-[15px] font-medium text-label-2">{r.name}</p>
        {w.status === "ready" && (
          <>
            <div className="mx-auto mt-4 grid size-16 place-items-center rounded-full bg-accent-fill text-white"><BellRing className="size-8" aria-hidden /></div>
            <h1 className="mt-4 text-[32px]">Your table is ready</h1>
            <p className="mt-2 text-[16px] text-label-2">{w.guest_name}, please check in with the host now.</p>
          </>
        )}
        {w.status === "waiting" && (
          <>
            <h1 className="mt-3 text-[28px]">You&apos;re in line, {w.guest_name.split(" ")[0]}</h1>
            <div className="my-6 rounded-[18px] bg-accent-soft px-4 py-6">
              <div className="text-[56px] font-semibold leading-none text-accent-text" style={{ fontFamily: "var(--font-display)" }}>{ahead === 0 ? "Next" : ahead}</div>
              <div className="mt-2 text-[15px] text-label-2">{ahead === 0 ? "You are next up" : ahead === 1 ? "party ahead of you" : "parties ahead of you"}</div>
            </div>
            {left !== null && <p className="inline-flex items-center gap-2 text-[15px] text-label-2"><Clock className="size-4" aria-hidden />{left > 0 ? `About ${left} more minutes` : "Any minute now"}</p>}
            <p className="mt-3 text-[14px] text-label-2">Keep this page open, or stay nearby: the restaurant will reach you by phone{w.email ? " and email" : ""} when your table is ready.</p>
          </>
        )}
        {w.status === "seated" && (<><h1 className="mt-3 text-[28px]">Enjoy your meal</h1><p className="mt-2 text-[15px] text-label-2">You have been seated. Thank you for waiting.</p></>)}
        {w.status === "cancelled" && (
          <>
            <h1 className="mt-3 text-[28px]">You&apos;re no longer in line</h1>
            <p className="mt-3"><Link className="text-accent-text underline" href={`/${r.slug}/queue`}>Join the line again</Link>{" · "}<Link className="text-accent-text underline" href={`/${r.slug}`}>Reserve a table</Link></p>
          </>
        )}
        {live && <div className="mt-6"><LeaveButton token={token} /></div>}
        {r.phone && live && <p className="mt-4 text-[14px] text-label-2"><Phone className="mr-1 inline size-4" aria-hidden />Questions? <a className="underline" href={`tel:${r.phone}`}>{r.phone}</a></p>}
      </Card>
      <p className="mt-6 text-center"><Logo className="text-[14px]" /></p>
    </main>
  );
}
