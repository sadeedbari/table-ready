import { NextResponse } from "next/server";
import { env, features } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Answers "is this deployment set up right?" without exposing any value: which settings exist, and whether the database answers. */
export async function GET() {
  const settings = {
    NEXT_PUBLIC_SUPABASE_URL: Boolean(env.supabaseUrl),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: Boolean(env.supabaseKey),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(env.supabaseServiceKey),
    NEXT_PUBLIC_APP_URL: Boolean(process.env.NEXT_PUBLIC_APP_URL),
    RESEND_API_KEY: features.email,
    EMAIL_FROM: Boolean(process.env.EMAIL_FROM),
    CRON_SECRET: Boolean(env.cronSecret),
  };
  let database: string = "not checked";
  if (settings.NEXT_PUBLIC_SUPABASE_URL && settings.SUPABASE_SERVICE_ROLE_KEY) {
    const { error } = await createAdminClient().from("restaurants").select("id", { head: true, count: "exact" });
    database = error ? `error: ${error.code ?? ""} ${error.message}`.trim() : "ok";
  }
  const ok = Object.values(settings).every(Boolean) && database === "ok";
  return NextResponse.json({ ok, settings, database }, { status: ok ? 200 : 503 });
}
