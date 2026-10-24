import "server-only";
import { Resend } from "resend";
import { env, features } from "@/lib/env";
import { formatDate, formatTime } from "@/lib/format";
import type { Reservation, Restaurant, WaitlistEntry } from "@/lib/types";

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function shell(title: string, body: string, button?: { href: string; label: string }) {
  return `<div style="font-family:Georgia,'Times New Roman',serif;background:#faf6f0;padding:32px 16px"><div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px 28px;color:#2a211c"><h1 style="font-size:24px;margin:0 0 12px">${esc(title)}</h1><div style="font-family:-apple-system,Segoe UI,Inter,sans-serif;font-size:15px;line-height:1.55;color:#5a4a3f">${body}</div>${button ? `<a href="${button.href}" style="display:inline-block;margin-top:20px;background:#b4491f;color:#ffffff;text-decoration:none;font-family:-apple-system,Segoe UI,sans-serif;font-weight:600;padding:12px 22px;border-radius:999px">${esc(button.label)}</a>` : ""}</div><p style="text-align:center;font-family:-apple-system,Segoe UI,sans-serif;font-size:12px;color:#8a7a6e;margin-top:16px">Sent by Table Ready on behalf of the restaurant.</p></div>`;
}

/** Sends an email; without a Resend key it is printed to the server log (so local development works). Never throws. */
export async function sendEmail(opts: { to: string; subject: string; html: string; text: string; replyTo?: string | null }) {
  if (!features.email) {
    console.info(`[email] to ${opts.to}: ${opts.subject}\n${opts.text}`);
    return;
  }
  try {
    const resend = new Resend(env.resendApiKey);
    await resend.emails.send({ from: env.emailFrom, to: opts.to, subject: opts.subject, html: opts.html, text: opts.text, replyTo: opts.replyTo ?? undefined });
  } catch (e) {
    console.error("[email]", e);
  }
}

type R = Pick<Restaurant, "name" | "timezone" | "phone" | "address">;
type Res = Pick<Reservation, "guest_name" | "email" | "party_size" | "starts_at" | "token">;

const when = (r: R, x: Pick<Reservation, "starts_at">) => `${formatDate(x.starts_at, r.timezone)} at ${formatTime(x.starts_at, r.timezone)}`;
const party = (n: number) => `${n} ${n === 1 ? "guest" : "guests"}`;
export const manageUrl = (token: string) => `${env.appUrl}/reservation/${token}`;

export async function sendConfirmation(r: R, x: Res) {
  if (!x.email) return;
  const lines = [`${esc(x.guest_name)}, your table is booked.`, `<strong>${esc(r.name)}</strong><br>${esc(when(r, x))}<br>${party(x.party_size)}`];
  if (r.address) lines.push(esc(r.address));
  if (r.phone) lines.push(`Questions? Call ${esc(r.phone)}.`);
  await sendEmail({
    to: x.email,
    subject: `Reservation confirmed at ${r.name}`,
    html: shell("You're booked", lines.map((l) => `<p style="margin:0 0 12px">${l}</p>`).join(""), { href: manageUrl(x.token), label: "View or cancel" }),
    text: `Your table at ${r.name} is booked: ${when(r, x)}, ${party(x.party_size)}.\nView or cancel: ${manageUrl(x.token)}`,
  });
}

export async function sendCancellation(r: R, x: Res) {
  if (!x.email) return;
  await sendEmail({
    to: x.email,
    subject: `Reservation cancelled at ${r.name}`,
    html: shell("Reservation cancelled", `<p style="margin:0 0 12px">Your reservation at <strong>${esc(r.name)}</strong> for ${esc(when(r, x))} (${party(x.party_size)}) has been cancelled.</p>`),
    text: `Your reservation at ${r.name} for ${when(r, x)} has been cancelled.`,
  });
}

export async function sendReminder(r: R, x: Res) {
  if (!x.email) return;
  await sendEmail({
    to: x.email,
    subject: `Reminder: ${r.name} ${formatDate(x.starts_at, r.timezone, { weekday: "long" })} at ${formatTime(x.starts_at, r.timezone)}`,
    html: shell("See you soon", `<p style="margin:0 0 12px">${esc(x.guest_name)}, this is a reminder of your table at <strong>${esc(r.name)}</strong>: ${esc(when(r, x))}, ${party(x.party_size)}.</p><p style="margin:0">Can't make it? Please cancel so another guest can have the table.</p>`, { href: manageUrl(x.token), label: "View or cancel" }),
    text: `Reminder: your table at ${r.name} is ${when(r, x)}, ${party(x.party_size)}. Manage: ${manageUrl(x.token)}`,
  });
}

export async function sendWaitlistOpening(r: Pick<Restaurant, "name" | "slug" | "timezone">, w: WaitlistEntry) {
  const url = `${env.appUrl}/${r.slug}?party=${w.party_size}&date=${w.wanted_date}`;
  await sendEmail({
    to: w.email,
    subject: `A table opened up at ${r.name}`,
    html: shell("A table just opened", `<p style="margin:0 0 12px">${esc(w.guest_name)}, a table for ${party(w.party_size)} is now available at <strong>${esc(r.name)}</strong> on ${esc(formatDate(w.wanted_date + "T12:00:00Z", "UTC"))}. Tables go quickly, so book soon.</p>`, { href: url, label: "Pick a time" }),
    text: `A table for ${party(w.party_size)} opened at ${r.name} on ${w.wanted_date}. Book: ${url}`,
  });
}
