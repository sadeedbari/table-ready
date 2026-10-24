import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Logo } from "@/components/app/logo";
import { InstallBanner } from "@/components/app/pwa";
import { PushBanner } from "@/components/app/push-device";
import { env } from "@/lib/env";
import { getRestaurantContext } from "@/lib/auth";
import { DashNav } from "./nav";

export const metadata = { robots: { index: false, follow: false } };

export default async function DashboardLayout(props: LayoutProps<"/o/[slug]">) {
  const { slug } = await props.params;
  const { restaurant, me } = await getRestaurantContext(slug);
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 glass-strong hairline">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link href={`/o/${slug}`} className="flex min-h-11 items-center gap-3">
            <Logo mark className="text-[18px]" />
            <span className="text-[17px] font-semibold" style={{ fontFamily: "var(--font-display)" }}>{restaurant.name}</span>
          </Link>
          <div className="flex items-center gap-1">
            <Link href={`/${slug}`} target="_blank" className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-accent-text hover:bg-accent-soft">
              Public page <ExternalLink className="size-3.5" aria-hidden />
            </Link>
            <form action="/auth/signout" method="post"><button className="h-9 rounded-full px-3 text-[13px] font-medium text-label-2 hover:bg-surface-2" title={me.display_name || undefined}>Sign out</button></form>
          </div>
        </div>
        <DashNav slug={slug} />
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
        <InstallBanner />
        <PushBanner vapidKey={env.vapidPublicKey ?? ""} teamEnabled={restaurant.notify_push} />
        {props.children}
      </main>
    </div>
  );
}
