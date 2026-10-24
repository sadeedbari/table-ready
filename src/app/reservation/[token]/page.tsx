import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarCheck, MapPin, Phone, Users } from "lucide-react";
import { Badge, Card, statusTone } from "@/components/ui/misc";
import { Logo } from "@/components/app/logo";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate, formatTime, STATUS_LABEL } from "@/lib/format";
import { CancelButton } from "./cancel-button";
import type { Reservation, Restaurant } from "@/lib/types";

export const metadata: Metadata = { title: "Your reservation", robots: { index: false, follow: false } };

/** Where this reservation stands against the clock (kept out of the component so rendering stays pure). */
function timing(res: Reservation, rest: Restaurant) {
  const now = Date.now();
  const cutoff = new Date(res.starts_at).getTime() - rest.cancellation_window_hours * 3600_000;
  return { canCancel: res.status === "confirmed" && now <= cutoff, past: new Date(res.ends_at).getTime() < now };
}

export default async function ReservationPage(props: PageProps<"/reservation/[token]">) {
  const { token } = await props.params;
  if (!/^[a-f0-9]{48}$/.test(token)) notFound();
  const db = createAdminClient();
  const { data: reservation } = await db.from("reservations").select("*").eq("token", token).maybeSingle();
  if (!reservation) notFound();
  const { data: r } = await db.from("restaurants").select("*").eq("id", reservation.restaurant_id).single();
  if (!r) notFound();
  const res = reservation as Reservation;
  const rest = r as Restaurant;
  const { canCancel, past } = timing(res, rest);

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <Card className="!p-7">
        <div className="mb-1 flex items-center gap-2"><Badge tone={statusTone(res.status)}>{STATUS_LABEL[res.status]}</Badge></div>
        <h1 className="text-[28px]">{res.status === "cancelled" ? "Reservation cancelled" : past ? "Thanks for dining with us" : "You're booked"}</h1>
        <p className="mt-1 text-[16px] font-medium">{rest.name}</p>
        <ul className="mt-5 space-y-2.5 text-[15px] text-label-2">
          <li className="flex items-center gap-2.5"><CalendarCheck className="size-[18px]" aria-hidden />{formatDate(res.starts_at, rest.timezone)} at {formatTime(res.starts_at, rest.timezone)}</li>
          <li className="flex items-center gap-2.5"><Users className="size-[18px]" aria-hidden />{res.party_size} {res.party_size === 1 ? "guest" : "guests"} · under {res.guest_name}</li>
          {rest.address && <li className="flex items-center gap-2.5"><MapPin className="size-[18px]" aria-hidden />{rest.address}</li>}
          {rest.phone && <li className="flex items-center gap-2.5"><Phone className="size-[18px]" aria-hidden /><a className="underline" href={`tel:${rest.phone}`}>{rest.phone}</a></li>}
        </ul>
        {canCancel && <div className="mt-6"><CancelButton token={token} /></div>}
        {res.status === "confirmed" && !canCancel && !past && (
          <p className="mt-6 text-[14px] text-label-2">It is too late to cancel online{rest.phone ? `. Please call ${rest.phone}` : ""}.</p>
        )}
        {res.status === "cancelled" && <p className="mt-6"><Link className="text-accent-text underline" href={`/${rest.slug}`}>Book another table</Link></p>}
      </Card>
      <p className="mt-6 text-center"><Logo className="text-[14px] opacity-60" /></p>
    </main>
  );
}
