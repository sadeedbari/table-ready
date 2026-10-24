import Link from "next/link";
import { ChevronLeft, ChevronRight, Mail, Phone, StickyNote, Users } from "lucide-react";
import { getRestaurantContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addDaysToKey, formatDate, formatTime, startOfDayInZone, todayKey } from "@/lib/format";
import { Badge, Card, EmptyState, PageHeader, statusTone } from "@/components/ui/misc";
import { STATUS_LABEL } from "@/lib/format";
import { toLocalInput } from "@/lib/notices";
import { AddReservation, RowActions } from "./today-client";
import type { DiningTable, Reservation } from "@/lib/types";

export const metadata = { title: "Today" };

export default async function TodayPage(props: PageProps<"/o/[slug]">) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const { restaurant } = await getRestaurantContext(slug);
  const today = todayKey(restaurant.timezone);
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;

  const supabase = await createClient();
  const from = startOfDayInZone(date, restaurant.timezone).toISOString();
  const to = startOfDayInZone(addDaysToKey(date, 1), restaurant.timezone).toISOString();
  const [{ data: rows }, { data: tables }] = await Promise.all([
    supabase.from("reservations").select("*").eq("restaurant_id", restaurant.id).gte("starts_at", from).lt("starts_at", to).order("starts_at"),
    supabase.from("dining_tables").select("*").eq("restaurant_id", restaurant.id).order("position").order("name"),
  ]);
  const reservations = (rows ?? []) as Reservation[];
  const allTables = (tables ?? []) as DiningTable[];
  const tableName = new Map(allTables.map((t) => [t.id, t.name]));
  const live = reservations.filter((r) => r.status === "confirmed" || r.status === "seated");
  const covers = live.reduce((n, r) => n + r.party_size, 0);
  const noon = new Date(startOfDayInZone(date, restaurant.timezone).getTime() + 12 * 3600_000);
  const nav = (d: string) => `/o/${slug}?date=${d}`;

  return (
    <>
      <PageHeader
        title={date === today ? "Today" : formatDate(noon, restaurant.timezone, { weekday: "long", month: "long", day: "numeric" })}
        subtitle={`${live.length} ${live.length === 1 ? "reservation" : "reservations"} · ${covers} ${covers === 1 ? "guest" : "guests"}${date === today ? " · " + formatDate(noon, restaurant.timezone, { weekday: "long", month: "long", day: "numeric" }) : ""}`}
        actions={<AddReservation slug={slug} date={date} tables={allTables.filter((t) => t.active)} />}
      />
      <div className="mb-5 flex items-center gap-2">
        <Link href={nav(addDaysToKey(date, -1))} aria-label="Previous day" className="grid size-10 place-items-center rounded-full bg-surface shadow-sm hairline"><ChevronLeft className="size-5" /></Link>
        <Link href={nav(today)} className="inline-flex h-10 items-center rounded-full bg-surface px-4 text-[14px] font-medium shadow-sm hairline">Today</Link>
        <Link href={nav(addDaysToKey(date, 1))} aria-label="Next day" className="grid size-10 place-items-center rounded-full bg-surface shadow-sm hairline"><ChevronRight className="size-5" /></Link>
      </div>
      {reservations.length === 0 ? (
        <EmptyState
          title="No reservations yet"
          body={<>Guests book at <span className="font-medium text-label">/{slug}</span>. You can also add a phone or walk-up booking.</>}
        />
      ) : (
        <ul className="space-y-3">
          {reservations.map((r) => (
            <li key={r.id}>
              <Card className="flex flex-wrap items-start gap-x-5 gap-y-3 !p-4">
                <div className="w-[76px] shrink-0">
                  <div className="text-[20px] font-semibold leading-tight" style={{ fontFamily: "var(--font-display)" }}>{formatTime(r.starts_at, restaurant.timezone)}</div>
                  <div className="text-[12px] text-label-3">until {formatTime(r.ends_at, restaurant.timezone)}</div>
                </div>
                <div className="min-w-[180px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[16px] font-semibold">{r.guest_name}</span>
                    <Badge tone={statusTone(r.status)}>{STATUS_LABEL[r.status]}</Badge>
                    {r.source === "host" && <Badge>Added by host</Badge>}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] text-label-2">
                    <span className="inline-flex items-center gap-1"><Users className="size-4" aria-hidden />{r.party_size}</span>
                    <span>{r.table_id ? `Table ${tableName.get(r.table_id) ?? "?"}` : "No table"}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] text-label-2">
                    {r.phone && <a href={`tel:${r.phone.replace(/[^\d+]/g, "")}`} className="inline-flex min-h-8 items-center gap-1.5 underline-offset-2 hover:underline"><Phone className="size-4 shrink-0" aria-hidden />{r.phone}</a>}
                    {r.email && <a href={`mailto:${r.email}`} className="inline-flex min-h-8 items-center gap-1.5 break-all underline-offset-2 hover:underline"><Mail className="size-4 shrink-0" aria-hidden />{r.email}</a>}
                    {!r.phone && !r.email && <span className="text-label-3">No contact details saved</span>}
                  </div>
                  {r.notes && <p className="mt-1.5 inline-flex items-start gap-1.5 text-[14px] text-label-2"><StickyNote className="mt-0.5 size-4 shrink-0" aria-hidden />{r.notes}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2"><RowActions
                    slug={slug}
                    id={r.id}
                    status={r.status}
                    tables={allTables.filter((t) => t.active || t.id === r.table_id)}
                    edit={{ name: r.guest_name, party: r.party_size, startLocal: toLocalInput(new Date(r.starts_at), restaurant.timezone), email: r.email ?? "", phone: r.phone ?? "", notes: r.notes ?? "", tableId: r.table_id ?? "" }}
                  /></div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
