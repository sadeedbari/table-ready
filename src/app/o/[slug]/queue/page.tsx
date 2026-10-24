import QRCode from "qrcode";
import { getRestaurantContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { openQueue, suggestQuote } from "@/lib/queue";
import { Card, EmptyState, PageHeader } from "@/components/ui/misc";
import { AddWalkin, JoinLinkCard, Poller, QueueRow } from "./queue-client";
import type { Walkin } from "@/lib/types";

export const metadata = { title: "Walk-ins" };

export default async function QueuePage(props: PageProps<"/o/[slug]/queue">) {
  const { slug } = await props.params;
  const { restaurant, isAdmin } = await getRestaurantContext(slug);
  const supabase = await createClient();
  const { data } = await supabase.from("walkins").select("*").eq("restaurant_id", restaurant.id).in("status", ["waiting", "ready"]).order("joined_at");
  const line = openQueue((data ?? []) as Walkin[]);
  const waiting = line.filter((w) => w.status === "waiting");
  const guests = waiting.reduce((n, w) => n + w.party_size, 0);
  const base = env.appUrl.includes("localhost") ? env.appUrl : "https://tableready.sulosystems.com";
  const joinUrl = `${base}/${slug}/queue`;
  const qr = await QRCode.toString(joinUrl, { type: "svg", margin: 1, color: { dark: "#2a211c", light: "#ffffff" } });

  return (
    <>
      <PageHeader
        title="Walk-ins"
        subtitle="Parties waiting at the door. Mark a party ready when their table is set; we email them if you took an email, and you can call or text from here."
        actions={<AddWalkin slug={slug} suggested={suggestQuote(waiting.length)} />}
      />
      <Poller />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Card><div className="text-[13px] text-label-2">Parties waiting</div><div className="mt-1 text-[28px] font-semibold" style={{ fontFamily: "var(--font-display)" }}>{waiting.length}</div></Card>
        <Card><div className="text-[13px] text-label-2">Guests waiting</div><div className="mt-1 text-[28px] font-semibold" style={{ fontFamily: "var(--font-display)" }}>{guests}</div></Card>
        <Card><div className="text-[13px] text-label-2">Called, not yet seated</div><div className="mt-1 text-[28px] font-semibold" style={{ fontFamily: "var(--font-display)" }}>{line.length - waiting.length}</div></Card>
      </div>
      {line.length === 0 ? (
        <EmptyState title="Nobody is waiting" body="Add a party when someone walks in, or let guests join the line from their phone with the QR code below." />
      ) : (
        <ul className="space-y-3">
          {line.map((w, i) => (
            <li key={w.id}><QueueRow slug={slug} restaurant={restaurant.name} walkin={w} place={w.status === "waiting" ? waiting.indexOf(w) + 1 : null} last={i === line.length - 1} /></li>
          ))}
        </ul>
      )}
      <JoinLinkCard slug={slug} url={joinUrl} qrSvg={qr} open={restaurant.queue_open} canEdit={isAdmin} />
    </>
  );
}
