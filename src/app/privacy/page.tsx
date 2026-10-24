import type { Metadata } from "next";
import { H2, LegalPage, UL } from "@/components/legal/legal-page";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Privacy Policy", description: "How Table Ready handles reservation and account information." };

export default function PrivacyPage() {
  const email = <a className="text-accent underline" href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>;
  return (
    <LegalPage title="Privacy Policy">
      <p>
        {LEGAL.product} is an online reservation and waitlist service operated by {LEGAL.operator}. Restaurants use it to take reservations
        from their guests. This page explains what information we handle and why.
      </p>
      <H2>Who is responsible</H2>
      <p>
        When you book a table, the restaurant you booked with decides what to do with your reservation details. {LEGAL.operator} provides the
        service and handles the information on the restaurant&apos;s behalf. When a restaurant signs up, {LEGAL.operator} is responsible for that
        account information.
      </p>
      <H2>What we collect</H2>
      <UL>
        <li><strong className="text-label">Guests:</strong> your name, email address, phone number if you give one, party size, the time you booked, and any note you add.</li>
        <li><strong className="text-label">Updates sign-up:</strong> your email address and name if you give one, and the fact that you agreed to receive offers and news from that restaurant.</li>
        <li><strong className="text-label">Waitlist:</strong> your name, email, phone number if you give one, and the day, time window and party size you asked for.</li>
        <li><strong className="text-label">Restaurants:</strong> your name, email, restaurant details, tables, opening hours and the reservations you manage.</li>
      </UL>
      <H2>How we use it</H2>
      <UL>
        <li>To make, show and manage reservations, and to email you a confirmation, a reminder and any change or cancellation.</li>
        <li>To tell you when a table opens up, if you joined a waitlist.</li>
        <li>To keep the restaurant&apos;s guest list: when you booked or joined, how, and whether you came. The restaurant uses it to thank you, follow up after a missed visit, and, only if you ticked the box or signed up, to send you offers and news. You can opt out at any time by replying to any of its emails.</li>
        <li>To keep the service secure and working. We do not sell your information and we do not use it for advertising.</li>
      </UL>
      <H2>Who sees it</H2>
      <p>
        The restaurant you booked with can see your reservation and contact details. We use service providers to run {LEGAL.product}: Supabase
        (database and sign-in), Vercel (hosting) and Resend (email). They handle information only to provide their service to us.
      </p>
      <H2>How long we keep it</H2>
      <p>We keep reservation records for as long as the restaurant keeps its account, so it can see its history. Ask us or the restaurant to delete your details and we will remove them unless we must keep them by law.</p>
      <H2>Your choices</H2>
      <p>You can ask to see, correct or delete your information, or to stop emails, by writing to {email}. To cancel a reservation, use the link in your confirmation email.</p>
      <H2>Contact</H2>
      <p>{LEGAL.operator}, {email}.</p>
    </LegalPage>
  );
}
