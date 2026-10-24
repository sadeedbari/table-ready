import { formatDate, formatTime } from "@/lib/format";

export type GuestMode = "reservation" | "waitlist" | "walk_in" | "signup";
export type Tone = "green" | "red" | "gray" | "orange" | "blue";

export const MODES: { value: GuestMode; label: string }[] = [
  { value: "reservation", label: "Reservation" },
  { value: "waitlist", label: "Waitlist" },
  { value: "walk_in", label: "Walk-in line" },
  { value: "signup", label: "Signed up for updates" },
];

/** What happened to each entry. The codes come from the guest_log view. */
export const OUTCOMES: Record<string, { label: string; tone: Tone }> = {
  showed: { label: "Showed", tone: "green" },
  no_show: { label: "No-show", tone: "red" },
  cancelled: { label: "Cancelled", tone: "gray" },
  left: { label: "Left the line", tone: "gray" },
  upcoming: { label: "Upcoming", tone: "blue" },
  unmarked: { label: "Not marked yet", tone: "orange" },
  waiting: { label: "Waiting", tone: "orange" },
  notified: { label: "Told a table opened", tone: "orange" },
  booked: { label: "Booked a table", tone: "green" },
  expired: { label: "No table opened", tone: "gray" },
  subscribed: { label: "Subscribed", tone: "blue" },
};

export const modeLabel = (m: string) => MODES.find((x) => x.value === m)?.label ?? m;
export const outcomeLabel = (o: string) => OUTCOMES[o]?.label ?? o;

export interface GuestRow {
  id: string;
  mode: GuestMode;
  guest_name: string;
  email: string | null;
  phone: string | null;
  party_size: number | null;
  added_at: string;
  event_at: string | null;
  outcome: string;
  marketing_opt_in: boolean;
  source: string;
}

export interface GuestFilters {
  mode: GuestMode | "";
  outcome: string;
  marketing: boolean;
  q: string;
  from: string;
  to: string;
  page: number;
}

export const PAGE_SIZE = 50;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Turns the page address into filters, ignoring anything that is not a known value. */
export function parseFilters(sp: Record<string, string | string[] | undefined>): GuestFilters {
  const mode = one(sp.mode);
  const outcome = one(sp.outcome);
  const page = parseInt(one(sp.page), 10);
  return {
    mode: MODES.some((m) => m.value === mode) ? (mode as GuestMode) : "",
    outcome: outcome in OUTCOMES ? outcome : "",
    marketing: one(sp.marketing) === "1",
    // commas, parentheses and wildcards have special meaning in the search syntax, so they are dropped
    q: one(sp.q).replace(/[,()*%\\]/g, " ").trim().slice(0, 80),
    from: isDate(one(sp.from)) ? one(sp.from) : "",
    to: isDate(one(sp.to)) ? one(sp.to) : "",
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

/** The address for the same filters (used by paging and the CSV button). */
export function filterQuery(f: Partial<GuestFilters>, extra: Record<string, string> = {}): string {
  const p = new URLSearchParams();
  if (f.mode) p.set("mode", f.mode);
  if (f.outcome) p.set("outcome", f.outcome);
  if (f.marketing) p.set("marketing", "1");
  if (f.q) p.set("q", f.q);
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : "";
}

const csvCell = (v: string | number | null | undefined) => {
  let s = v === null || v === undefined ? "" : String(v);
  // A cell that starts with = + - or @ can run as a formula when the file is opened in a spreadsheet.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** The guest list as a CSV file (Excel and Google Sheets open it directly). */
export function toCsv(rows: GuestRow[], timeZone: string): string {
  const head = ["Date added", "Name", "How they came to you", "Outcome", "Party size", "Visit or requested date", "Email", "Phone", "Agreed to marketing emails"];
  const lines = rows.map((r) =>
    [
      `${formatDate(r.added_at, timeZone, { year: "numeric", month: "short", day: "numeric" })} ${formatTime(r.added_at, timeZone)}`,
      r.guest_name,
      modeLabel(r.mode),
      outcomeLabel(r.outcome),
      r.party_size,
      r.event_at ? formatDate(r.event_at, timeZone, { year: "numeric", month: "short", day: "numeric" }) : "",
      r.email,
      r.phone,
      r.marketing_opt_in ? "Yes" : "No",
    ].map(csvCell).join(","),
  );
  return [head.map(csvCell).join(","), ...lines].join("\r\n") + "\r\n";
}
