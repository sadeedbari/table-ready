import type { Walkin } from "@/lib/types";

/** Parties still in line (waiting, or called and not yet seated), oldest first. */
export function openQueue<T extends Pick<Walkin, "status" | "joined_at">>(entries: T[]): T[] {
  return entries
    .filter((w) => w.status === "waiting" || w.status === "ready")
    .sort((a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime());
}

/** How many open parties joined before this one (0 = next up). */
export function partiesAhead(entries: Pick<Walkin, "id" | "status" | "joined_at">[], id: string): number {
  const open = openQueue(entries);
  const i = open.findIndex((w) => w.id === id);
  return i < 0 ? 0 : open.slice(0, i).filter((w) => w.status === "waiting").length;
}

/** A starting wait quote for the next party: about 8 minutes per waiting party, in steps of 5, at least 5. */
export function suggestQuote(waiting: number): number {
  return Math.max(5, Math.round((waiting * 8) / 5) * 5);
}

/** Minutes left on a quote, never below zero; null when no quote was given. */
export function minutesLeft(quoted: number | null, joinedAt: string, now: number): number | null {
  if (quoted === null) return null;
  return Math.max(0, quoted - Math.floor((now - new Date(joinedAt).getTime()) / 60_000));
}

/** Opens the phone's messaging app with the text already written (no texting service needed). */
export function smsLink(phone: string, body: string): string {
  return `sms:${phone.replace(/[^\d+]/g, "")}?&body=${encodeURIComponent(body)}`;
}

export const telLink = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

export const readyMessage = (restaurant: string, party: number) =>
  `${restaurant}: your table for ${party} is ready. Please check in with the host.`;
