# Billing setup (Stripe)

Table Ready has two plans: **Free** (50 reservations a month) and **Pro** ($29 CAD/month: unlimited reservations, guest list download, no Table Ready branding). Every new restaurant gets 30 days of Pro with no card. Plan rules live in `src/lib/plan.ts`.

## One-time setup in Stripe

1. **Product and price**: Products > Add product "Table Ready Pro", recurring, monthly, **$29.00 CAD**. Copy the price id (`price_...`).
2. **Webhook**: Developers > Webhooks > Add endpoint `https://tableready.sulosystems.com/api/stripe/webhook`, events from "Your account":
   `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.paid`. Copy the signing secret (`whsec_...`).
3. **Customer portal**: Settings > Billing > Customer portal. Create a configuration that allows updating the card, viewing invoices and cancelling. Copy its id (`bpc_...`) if you want it dedicated to Table Ready (recommended when the Stripe account is shared with other products).
4. **Vercel environment variables** (Production), then redeploy:
   - `STRIPE_SECRET_KEY` (`sk_live_...`, or `sk_test_...` while testing)
   - `STRIPE_PRICE_PRO`
   - `STRIPE_WEBHOOK_SECRET`
   - `STRIPE_PORTAL_CONFIGURATION` (optional)

Billing stays off (Upgrade buttons show "not switched on") until the secret key and price are set. Test mode and live mode must use matching keys; webhook events from the other mode are ignored.

## How it behaves

- Trial: 30 days from a restaurant's creation, then Free unless subscribed. Reminder email 3 days before (daily cron).
- Free limit: warning from 40 reservations a month, online booking pauses at 60 for the rest of that month. Reservations entered by staff are never blocked.
- Failed payment: Pro continues 7 days while Stripe retries; owners get one email.
- Cancelling keeps Pro until the paid period ends.
- Guest list download and removal of "Powered by Table Ready" are Pro-only.
- Plans are stored in `restaurant_plans`, readable only by the server, so a restaurant cannot grant itself Pro. To comp a restaurant, set `comped_until` on its row.
