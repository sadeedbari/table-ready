import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarCheck, MapPin, Phone } from "lucide-react";
import { Logo } from "@/components/app/logo";
import { Notice } from "@/components/ui/misc";
import { addDaysToKey, formatDate, formatTime, todayKey } from "@/lib/format";
import { openDays } from "@/lib/hours";
import { loadRestaurantData, slotsFor } from "@/lib/reservations";
import { activeNotices } from "@/lib/notices-server";
import { NoticeBanner } from "@/components/app/notice-banner";
import { SITE_NAME } from "@/lib/site";
import { DetailsForm, Picker, SignupForm, WaitlistForm } from "./reserve-client";

export async function generateMetadata(props: PageProps<"/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const data = await loadRestaurantData(slug);
  if (!data) return { title: "Not found", robots: { index: false } };
  const r = data.restaurant;
  const description = r.description?.trim() || `Reserve a table at ${r.name}. Pick your party size, day and time.`;
  return {
    title: `Reserve a table at ${r.name}`,
    description,
    alternates: { canonical: `/${r.slug}` },
    robots: r.online_enabled ? { index: true, follow: true } : { index: false },
    openGraph: { type: "website", siteName: SITE_NAME, title: `Reserve a table at ${r.name}`, description },
  };
}

export default async function ReservePage(props: PageProps<"/[slug]">) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const data = await loadRestaurantData(slug);
  if (!data) notFound();
  const { restaurant: r } = data;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);

  const days = openDays(r, data.periods, data.closures);
  const party = Math.min(Math.max(parseInt(one("party") ?? "2", 10) || 2, 1), r.max_party_size);
  const requested = one("date");
  const date = requested && days.includes(requested) ? requested : days[0];
  const slots = r.online_enabled && date ? await slotsFor(data, date, party) : [];
  const chosen = slots.find((s) => s.startsAt === one("time"));
  const dayLabel = (key: string, long = false) => formatDate(`${key}T12:00:00Z`, "UTC", long ? { weekday: "long", month: "long", day: "numeric" } : { weekday: "short", month: "short", day: "numeric" });
  const today = todayKey(r.timezone);
  const notices = await activeNotices(r.id, "reservations");

  return (
    <main className="mx-auto max-w-2xl px-4 pb-20">
      <header className="pt-10 pb-6">
        <h1 className="text-[34px] leading-tight sm:text-[44px]">{r.name}</h1>
        {r.description && <p className="mt-3 text-[16px] text-label-2">{r.description}</p>}
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[14px] text-label-2">
          {r.address && <span className="inline-flex items-center gap-1.5"><MapPin className="size-4" aria-hidden />{r.address}</span>}
          {r.phone && <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1.5 underline"><Phone className="size-4" aria-hidden />{r.phone}</a>}
        </div>
      </header>

      <div className="mb-4"><NoticeBanner notices={notices} timeZone={r.timezone} /></div>

      {one("subscribed") && <div className="mb-4"><Notice tone="green" live>Thank you! You are signed up for offers and news from {r.name}.</Notice></div>}
      {one("waitlisted") && <div className="mb-4"><Notice tone="green" live>You are on the waitlist. We will email you the moment a table opens up.</Notice></div>}

      <section className="rounded-[24px] bg-surface p-5 shadow-md hairline sm:p-7">
        {!r.online_enabled ? (
          <div className="py-6 text-center">
            <h2 className="text-[22px]">Online reservations are paused</h2>
            <p className="mt-2 text-[15px] text-label-2">{r.phone ? <>Please call us on <a className="underline" href={`tel:${r.phone}`}>{r.phone}</a> to book a table.</> : "Please contact the restaurant to book a table."}</p>
          </div>
        ) : days.length === 0 ? (
          <div className="py-6 text-center"><h2 className="text-[22px]">No reservations available</h2><p className="mt-2 text-[15px] text-label-2">The restaurant has not set its opening hours yet.</p></div>
        ) : chosen ? (
          <>
            <h2 className="text-[22px]">Your details</h2>
            <p className="mt-1 mb-5 inline-flex items-center gap-2 text-[15px] text-label-2"><CalendarCheck className="size-4" aria-hidden />{dayLabel(date!, true)} at {formatTime(chosen.startsAt, r.timezone)} · {party} {party === 1 ? "guest" : "guests"}</p>
            <DetailsForm slug={slug} party={party} startsAt={chosen.startsAt} restaurant={r.name} />
            <p className="mt-4 text-center text-[13px]"><Link className="inline-flex min-h-11 items-center px-2 text-accent-text underline" href={`/${slug}?party=${party}&date=${date}`}>Pick a different time</Link></p>
          </>
        ) : (
          <>
            <h2 className="mb-4 text-[22px]">Reserve a table</h2>
            <Picker slug={slug} party={party} date={date!} maxParty={r.max_party_size} days={days.slice(0, 120).map((d) => ({ value: d, label: d === today ? `Today, ${dayLabel(d)}` : d === addDaysToKey(today, 1) ? `Tomorrow, ${dayLabel(d)}` : dayLabel(d) }))} />
            <div className="mt-6" aria-live="polite">
              {slots.length > 0 ? (
                <>
                  <h3 className="mb-3 text-[15px] font-medium text-label-2">Available times</h3>
                  <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {slots.map((s) => (
                      <li key={s.startsAt}>
                        <Link href={`/${slug}?party=${party}&date=${date}&time=${encodeURIComponent(s.startsAt)}`} scroll={false} className="flex h-12 items-center justify-center rounded-[12px] bg-accent-soft text-[15px] font-semibold text-accent-text transition-colors hover:bg-accent-fill hover:text-white">
                          {formatTime(s.startsAt, r.timezone)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <div className="rounded-[16px] bg-surface-2 p-5">
                  <h3 className="text-[17px]">No tables for {party} {party === 1 ? "guest" : "guests"} on {dayLabel(date!)}</h3>
                  <p className="mt-1 mb-4 text-[14px] text-label-2">Try another day or party size, or join the waitlist and we will email you if a table opens.</p>
                  <WaitlistForm slug={slug} party={party} date={date!} restaurant={r.name} />
                </div>
              )}
            </div>
          </>
        )}
      </section>
      {r.online_enabled && !chosen && (
        <section className="mt-6 rounded-[24px] bg-surface p-5 shadow-sm hairline sm:p-6" aria-labelledby="updates-heading">
          <h2 id="updates-heading" className="text-[19px]">Get offers and news</h2>
          <p className="mt-1 mb-4 text-[14px] text-label-2">Not booking right now? Leave your email and {r.name} will keep in touch.</p>
          <SignupForm slug={slug} restaurant={r.name} />
        </section>
      )}
      <p className="mt-6 text-center text-[13px] text-label-3"><Link href="/" className="inline-flex min-h-11 items-center"><Logo className="text-[14px]" /></Link></p>
    </main>
  );
}
