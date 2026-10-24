# Table Ready

Reservations and a waitlist for restaurants. Next.js 16 (App Router), Supabase (Postgres + Auth, row level security), Resend email, deployed on Vercel at https://tableready.sulosystems.com.

- Restaurants choose which tables and seat counts are open to online guests, set opening hours by weekday (several services per day), closures, and how long each party size keeps its table.
- Guests pick party size, day and time at `/<slug>`; the database function `book_table()` assigns the smallest free online table and an exclusion constraint prevents double-booking.
- Full times offer a waitlist; when a reservation is cancelled (or the daily cron runs) waiting guests whose window now has a table are emailed.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill it in (Supabase URL, publishable key, service-role key).
3. Apply `supabase/migrations/*.sql` to the Supabase project (SQL editor, in file order).
4. `npm run dev`, then `npm test` (unit tests) and `npm run typecheck`.

Without `RESEND_API_KEY`, emails are printed to the server log instead of sent.

## End-to-end tests

`npx playwright test` starts the app on port 3200, seeds a test restaurant ("E2E Bistro") with `e2e/seed.ts`, and removes it afterwards (`npx tsx e2e/cleanup.ts` removes it by hand). The tests use the installed Chrome and the same Supabase project as the app, and only touch rows tagged `e2e-` / `@tableready-e2e.test`.

## Walk-in queue

`/o/<slug>/queue` is the host's line: add a party (name, size, phone, optional email, quoted wait), mark "Table ready" (emails the party when an email was saved; Call and Text buttons use `tel:` / `sms:` links with the message pre-written, so no texting service is needed), then Seated or Left. Guests can join from `/<slug>/queue` (a QR code is shown on the host page) when the owner turns that on, and watch their place at `/queue/<token>`. Apply `supabase/migrations/20261025000000_walkin_queue.sql` before using it.

## Install and alerts

The site is an installable app (manifest, icons, service worker): on Android the dashboard offers "Install app", and on iPhone it explains Share → Add to Home Screen. When a guest books online, cancels, or joins the waitlist or the line, owners and admins get an email at the address on their account and a push notification on every device where they turned it on in Settings. Both can be switched off per restaurant in Settings. Push needs `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` (see `.env.example`) and the migration `20261026000000_notifications.sql`.

## Sign-up and password emails

Supabase Auth sends these through Resend (Authentication > Emails > SMTP Settings: host `smtp.resend.com`, port 465, username `resend`, password = the Resend API key, sender `reservations@tableready.sulosystems.com`, name "Table Ready"). The branded templates live in `supabase/email-templates/` (`node scripts/build-email-templates.mjs` rebuilds them; subjects are in `subjects.json`). Paste each into Authentication > Emails > Templates. Links go to `/auth/confirm?token_hash=...`, which asks the person to press Continue so mail scanners can't use up the link. Site URL must be `https://tableready.sulosystems.com`.
