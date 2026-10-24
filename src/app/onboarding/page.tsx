import type { Metadata } from "next";
import { Logo } from "@/components/app/logo";
import { requireUser } from "@/lib/auth";
import { OnboardingForm } from "./form";

export const metadata: Metadata = { title: "Set up your restaurant", robots: { index: false } };

export default async function OnboardingPage() {
  const user = await requireUser("/onboarding");
  return (
    <main className="mx-auto flex min-h-dvh max-w-[520px] flex-col justify-center px-5 py-12">
      <Logo className="mb-8 text-[20px]" />
      <div className="rounded-[24px] bg-surface p-7 shadow-lg hairline sm:p-8">
        <h1 className="text-[28px]">Set up your restaurant</h1>
        <p className="mt-1 mb-6 text-[15px] text-label-2">We will start you with six tables and dinner hours. You can change everything next.</p>
        <OnboardingForm defaultName={String(user.user_metadata?.full_name ?? "")} />
      </div>
    </main>
  );
}
