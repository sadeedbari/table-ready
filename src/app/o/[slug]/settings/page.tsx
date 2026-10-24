import { getRestaurantContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { noticeState } from "@/lib/notices";
import { env } from "@/lib/env";
import { Card, Notice, PageHeader } from "@/components/ui/misc";
import { buttonClass } from "@/components/ui/button-class";
import { PushDeviceCard } from "@/components/app/push-device";
import { NotificationSettings } from "./notification-settings";
import { NoticesSection, type NoticeRow } from "./notices-section";
import type { GuestNotice } from "@/lib/types";
import { ProfileForm } from "./profile-form";

export const metadata = { title: "Settings" };

/** Notices with where they stand now, worked out here so the page itself stays pure. */
async function loadNotices(restaurantId: string): Promise<NoticeRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("guest_notices").select("*").eq("restaurant_id", restaurantId).order("ends_at", { ascending: false }).limit(20);
  const now = Date.now();
  return ((data ?? []) as GuestNotice[]).map((n) => ({ ...n, state: noticeState(n, now) }));
}

export default async function SettingsPage(props: PageProps<"/o/[slug]/settings">) {
  const { slug } = await props.params;
  const { restaurant, isAdmin, me } = await getRestaurantContext(slug);
  const notices = await loadNotices(restaurant.id);
  const link = `${env.appUrl.includes("localhost") ? env.appUrl : "https://tableready.sulosystems.com"}/${slug}`;
  return (
    <>
      <PageHeader title="Settings" />
      <Card className="mb-6">
        <h2 className="text-[17px]">Your reservation link</h2>
        <p className="mt-1 text-[14px] text-label-2">Share this on your website, Instagram and Google Business Profile.</p>
        <p className="mt-3 rounded-[12px] bg-surface-2 px-3.5 py-2.5 font-mono text-[14px] break-all select-all">{link}</p>
      </Card>
      <div className="mb-8"><NoticesSection slug={slug} timeZone={restaurant.timezone} notices={notices} /></div>
      <h2 className="mb-2 text-[20px]">Notifications</h2>
      <div className="mb-3"><PushDeviceCard vapidKey={env.vapidPublicKey ?? ""} teamEnabled={restaurant.notify_push} /></div>
      <Card className="mb-6">
        <NotificationSettings slug={slug} push={restaurant.notify_push} email={restaurant.notify_email} disabled={!isAdmin} />
      </Card>
      {!isAdmin && <div className="mb-4"><Notice tone="blue" live={false}>Only an owner or admin can change these details.</Notice></div>}
      <Card>
        <h2 className="mb-3 text-[17px]">Restaurant details</h2>
        <ProfileForm slug={slug} r={restaurant} disabled={!isAdmin} />
      </Card>
      <Card className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-[17px]">Sign out</h2>
          <p className="mt-0.5 text-[14px] text-label-2">{me.display_name ? `Signed in as ${me.display_name}. ` : ""}Sign out of Table Ready on this device.</p>
        </div>
        <form action="/auth/signout" method="post"><button type="submit" className={buttonClass("gray", "md")}>Sign out</button></form>
      </Card>
    </>
  );
}
