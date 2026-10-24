import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Logo } from "@/components/app/logo";
import { InstallBanner } from "@/components/app/pwa";
import { PushBanner } from "@/components/app/push-device";
import { env } from "@/lib/env";
import { NoticeBanner } from "@/components/app/notice-banner";
import { activeNotices } from "@/lib/notices-server";
import { getRestaurantContext } from "@/lib/auth";
import { DashNav } from "./nav";

export const metadata = { robots: { index: false, follow: false } };

export default async function DashboardLayout(props: LayoutProps<"/o/[slug]">) {
  const { slug } = await props.params;
  const { restaurant, me } = await getRestaurantContext(slug);
  const showing = await activeNotices(restaurant.id, "reservations").then(async (a) => {
    const q = await activeNotices(restaurant.id, "queue");
    return [...a, ...q.filter((x) => !a.some((y) => y.id === x.id))];
  });
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
        {showing.length > 0 && (
          <div className="mb-4">
            <NoticeBanner notices={showing} timeZone={restaurant.timezone} staff />
            <p className="mt-1.5 px-1 text-[13px] text-label-2"><Link className="underline" href={`/o/${slug}/settings`}>Change or end a notice in Settings</Link></p>
          </div>
        )}
        <PushBanner vapidKey={env.vapidPublicKey ?? ""} teamEnabled={restaurant.notify_push} />
        {props.children}
      </main>
    </div>
  );
}
