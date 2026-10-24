export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  appUrl: (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, ""),
  resendApiKey: process.env.RESEND_API_KEY,
  emailFrom: process.env.EMAIL_FROM || "Table Ready <reservations@tableready.sulosystems.com>",
  cronSecret: process.env.CRON_SECRET,
};

export const features = {
  email: Boolean(env.resendApiKey),
};
