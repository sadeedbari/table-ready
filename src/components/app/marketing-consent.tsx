/**
 * The marketing agreement shown on guest forms. It is never ticked for the guest, and saying no changes nothing about their booking.
 * Without it the restaurant should only contact the guest about the booking itself.
 */
export function MarketingConsent({ restaurant }: { restaurant: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-[12px] bg-surface-2 px-3.5 py-3 text-[14px] leading-snug text-label-2">
      <input type="checkbox" name="marketing" className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]" />
      <span>
        <span className="font-medium text-label">Send me offers and news from {restaurant} (optional)</span>
        <span className="block">For example a thank-you, a coupon, or a note when we miss you. You can opt out at any time by replying to any of our emails.</span>
      </span>
    </label>
  );
}
