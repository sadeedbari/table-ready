import type { Metadata } from "next";
import { H2, LegalPage } from "@/components/legal/legal-page";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Terms of Service", description: "The terms for using Table Ready." };

export default function TermsPage() {
  const email = <a className="text-accent underline" href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>;
  return (
    <LegalPage title="Terms of Service">
      <p>These terms apply to your use of {LEGAL.product}, an online reservation and waitlist service operated by {LEGAL.operator}. By using it you agree to them.</p>
      <H2>For guests</H2>
      <p>
        {LEGAL.product} lets you ask a restaurant for a table. A reservation is an agreement between you and the restaurant, not with {LEGAL.operator}.
        The restaurant sets its own hours, table availability and cancellation rules. Please cancel if you cannot come, so another guest can have the table.
      </p>
      <H2>For restaurants</H2>
      <p>
        You are responsible for the accuracy of your hours, tables and rules, for the reservations you take, and for how you treat your guests.
        Use the service lawfully and only to contact guests about their reservations or waitlist requests. Do not send unrelated or promotional messages through it.
      </p>
      <H2>The service</H2>
      <p>
        We work to keep {LEGAL.product} available and accurate, but we do not guarantee it will be uninterrupted or error free. Check important
        reservations with your guests as you normally would. To the extent the law allows, {LEGAL.operator} is not liable for missed or lost bookings,
        or indirect losses arising from use of the service.
      </p>
      <H2>Accounts</H2>
      <p>Keep your sign-in details private. You are responsible for activity under your account. We may suspend accounts that break these terms.</p>
      <H2>Changes and contact</H2>
      <p>We may update these terms and will show the date above when we do. Questions: {email}.</p>
    </LegalPage>
  );
}
