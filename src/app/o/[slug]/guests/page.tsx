import Link from "next/link";
import { Check, Download, Mail, Phone, Search } from "lucide-react";
import { getRestaurantContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatTime } from "@/lib/format";
import { MODES, OUTCOMES, PAGE_SIZE, filterQuery, modeLabel, parseFilters } from "@/lib/guest-list";
import { guestCounts, loadGuestPage } from "@/lib/guest-query";
import { buttonClass } from "@/components/ui/button-class";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/misc";
import { Input, Select } from "@/components/ui/input";

export const metadata = { title: "Guests" };

export default async function GuestsPage(props: PageProps<"/o/[slug]/guests">) {
  const { slug } = await props.params;
  const { restaurant, isAdmin } = await getRestaurantContext(slug);
  const filters = parseFilters(await props.searchParams);
  const supabase = await createClient();
  const [{ rows, total }, counts] = await Promise.all([
    loadGuestPage(supabase, restaurant.id, restaurant.timezone, filters),
    guestCounts(supabase, restaurant.id),
  ]);
  const tz = restaurant.timezone;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = Boolean(filters.mode || filters.outcome || filters.marketing || filters.q || filters.from || filters.to);
  const page = (n: number) => `/o/${slug}/guests${filterQuery(filters, n > 1 ? { page: String(n) } : {})}`;

  return (
    <>
      <PageHeader
        title="Guests"
        subtitle="Everyone who reached you by reservation, the waitlist, the walk-in line, or by signing up for updates: when they came in, how, and what happened."
        actions={isAdmin ? <a href={`/o/${slug}/guests/export${filterQuery(filters)}`} className={buttonClass("tinted", "md")}><Download className="size-4" aria-hidden />Download CSV</a> : undefined}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Entries", value: counts.all },
          { label: "Showed", value: counts.showed },
          { label: "No-shows", value: counts.noShow },
          { label: "Agreed to marketing", value: counts.marketing },
        ].map((c) => (
          <Card key={c.label} className="!p-4"><div className="text-[13px] text-label-2">{c.label}</div><div className="mt-1 text-[26px] font-semibold" style={{ fontFamily: "var(--font-display)" }}>{c.value}</div></Card>
        ))}
      </div>

      <form method="get" className="mb-5 rounded-[18px] bg-surface p-4 shadow-sm hairline" role="search" aria-label="Filter guests">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block space-y-1.5 sm:col-span-2 lg:col-span-4">
            <span className="block px-1 text-[13px] font-medium text-label-2">Search name, email or phone</span>
            <span className="relative block"><Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-label-3" aria-hidden /><Input name="q" defaultValue={filters.q} className="pl-10" placeholder="Search guests" /></span>
          </label>
          <label className="block space-y-1.5"><span className="block px-1 text-[13px] font-medium text-label-2">How they came to you</span>
            <Select name="mode" defaultValue={filters.mode}><option value="">Everyone</option>{MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</Select></label>
          <label className="block space-y-1.5"><span className="block px-1 text-[13px] font-medium text-label-2">Outcome</span>
            <Select name="outcome" defaultValue={filters.outcome}><option value="">Any outcome</option>{Object.entries(OUTCOMES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select></label>
          <label className="block space-y-1.5"><span className="block px-1 text-[13px] font-medium text-label-2">Added from</span><Input name="from" type="date" defaultValue={filters.from} className="min-w-0" /></label>
          <label className="block space-y-1.5"><span className="block px-1 text-[13px] font-medium text-label-2">Added to</span><Input name="to" type="date" defaultValue={filters.to} className="min-w-0" /></label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-[15px]"><input type="checkbox" name="marketing" value="1" defaultChecked={filters.marketing} className="size-5 accent-[var(--accent)]" />Only people who agreed to marketing emails</label>
          <div className="flex gap-2">
            <button type="submit" className={buttonClass("filled", "md")}>Apply filters</button>
            {filtered && <Link href={`/o/${slug}/guests`} className={buttonClass("gray", "md")}>Clear</Link>}
          </div>
        </div>
      </form>

      <p className="mb-3 text-[14px] text-label-2" aria-live="polite">{total} {total === 1 ? "entry" : "entries"}{filtered ? " match your filters" : ""}{pages > 1 ? ` · page ${filters.page} of ${pages}` : ""}</p>

      {rows.length === 0 ? (
        <EmptyState title={filtered ? "No one matches those filters" : "No guests yet"} body={filtered ? "Try clearing a filter." : "People appear here as soon as they book, join the waitlist or the line, or sign up for updates."} />
      ) : (
        <>
          {/* A table on wide screens, cards on a phone */}
          <div className="hidden overflow-hidden rounded-[18px] bg-surface shadow-sm hairline md:block">
            <table className="w-full text-left text-[14px]">
              <thead className="bg-surface-2 text-[12px] uppercase tracking-wide text-label-2">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Date added</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Guest</th>
                  <th scope="col" className="px-4 py-3 font-semibold">How</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Outcome</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Contact</th>
                  <th scope="col" className="px-4 py-3 text-center font-semibold">Marketing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-separator">
                {rows.map((r) => (
                  <tr key={`${r.mode}-${r.id}`} className="align-top">
                    <td className="whitespace-nowrap px-4 py-3">{formatDate(r.added_at, tz, { month: "short", day: "numeric", year: "numeric" })}<div className="text-[12px] text-label-3">{formatTime(r.added_at, tz)}</div></td>
                    <td className="px-4 py-3"><div className="font-medium">{r.guest_name || "No name"}</div>{r.party_size ? <div className="text-[12px] text-label-3">Party of {r.party_size}{r.event_at ? ` · ${formatDate(r.event_at, tz, { month: "short", day: "numeric" })}` : ""}</div> : null}</td>
                    <td className="px-4 py-3">{modeLabel(r.mode)}{r.source === "host" ? <div className="text-[12px] text-label-3">Added by staff</div> : null}</td>
                    <td className="px-4 py-3"><Badge tone={OUTCOMES[r.outcome]?.tone ?? "gray"}>{OUTCOMES[r.outcome]?.label ?? r.outcome}</Badge></td>
                    <td className="px-4 py-3 break-all">{r.email ? <div>{r.email}</div> : null}{r.phone ? <div className="text-label-2">{r.phone}</div> : null}{!r.email && !r.phone ? <span className="text-label-3">None saved</span> : null}</td>
                    <td className="px-4 py-3 text-center">{r.marketing_opt_in ? <Check className="mx-auto size-5 text-green-text" aria-label="Agreed to marketing emails" /> : <span className="text-label-3" aria-label="Has not agreed">–</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="space-y-3 md:hidden">
            {rows.map((r) => (
              <li key={`${r.mode}-${r.id}`}>
                <Card className="!p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><div className="text-[16px] font-semibold">{r.guest_name || "No name"}</div><div className="text-[13px] text-label-2">{modeLabel(r.mode)}{r.party_size ? ` · party of ${r.party_size}` : ""}</div></div>
                    <Badge tone={OUTCOMES[r.outcome]?.tone ?? "gray"}>{OUTCOMES[r.outcome]?.label ?? r.outcome}</Badge>
                  </div>
                  <div className="mt-2 space-y-1 text-[14px] text-label-2">
                    <div>Added {formatDate(r.added_at, tz, { month: "short", day: "numeric", year: "numeric" })} at {formatTime(r.added_at, tz)}</div>
                    {r.email && <div className="flex items-center gap-1.5 break-all"><Mail className="size-4 shrink-0" aria-hidden />{r.email}</div>}
                    {r.phone && <div className="flex items-center gap-1.5"><Phone className="size-4 shrink-0" aria-hidden />{r.phone}</div>}
                    <div>{r.marketing_opt_in ? <span className="font-medium text-green-text">Agreed to marketing emails</span> : "Has not agreed to marketing emails"}</div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
          {pages > 1 && (
            <nav className="mt-5 flex items-center justify-between" aria-label="Pages">
              {filters.page > 1 ? <Link className={buttonClass("gray", "md")} href={page(filters.page - 1)}>Previous</Link> : <span />}
              {filters.page < pages ? <Link className={buttonClass("gray", "md")} href={page(filters.page + 1)}>Next</Link> : <span />}
            </nav>
          )}
        </>
      )}
    </>
  );
}
