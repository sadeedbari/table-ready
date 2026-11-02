export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  appUrl: (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, ""),
  resendApiKey: process.env.RESEND_API_KEY,
  emailFrom: process.env.EMAIL_FROM || "Table Ready <reservations@tableready.sulosystems.com>",
  cronSecret: process.env.CRON_SECRET,
  // Subscription billing (Stripe). Price of the Pro plan, the webhook signing secret, and the portal configuration made for Table Ready.
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  stripePricePro: process.env.STRIPE_PRICE_PRO,
  stripePortalConfiguration: process.env.STRIPE_PORTAL_CONFIGURATION,
  // Test hook: point Stripe at a local stand-in. Only honoured when TABLEREADY_E2E=1, which only the test server sets.
  stripeMockUrl: process.env.TABLEREADY_E2E === "1" ? process.env.STRIPE_MOCK_URL : undefined,
  vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,
  vapidSubject: process.env.VAPID_SUBJECT || "mailto:info@sulosystems.com",
};

export const features = {
  email: Boolean(env.resendApiKey),
  // Billing needs the key, the Pro price, the webhook secret and the service-role client (the webhook writes the plan).
  billing: Boolean(env.stripeSecretKey && env.stripePricePro && env.stripeWebhookSecret && env.supabaseServiceKey),
  // Push needs a VAPID key pair and the service-role client (to read everyone's devices).
  push: Boolean(env.vapidPublicKey && env.vapidPrivateKey && env.supabaseServiceKey),
};
