import { getRestaurantContext } from "@/lib/auth";
import { env } from "@/lib/env";
import { Card, Notice, PageHeader } from "@/components/ui/misc";
import { ProfileForm } from "./profile-form";

export const metadata = { title: "Settings" };

export default async function SettingsPage(props: PageProps<"/o/[slug]/settings">) {
  const { slug } = await props.params;
  const { restaurant, isAdmin } = await getRestaurantContext(slug);
  const link = `${env.appUrl.includes("localhost") ? env.appUrl : "https://tableready.sulosystems.com"}/${slug}`;
  return (
    <>
      <PageHeader title="Settings" />
      <Card className="mb-6">
        <h2 className="text-[17px]">Your reservation link</h2>
        <p className="mt-1 text-[14px] text-label-2">Share this on your website, Instagram and Google Business Profile.</p>
        <p className="mt-3 rounded-[12px] bg-surface-2 px-3.5 py-2.5 font-mono text-[14px] break-all select-all">{link}</p>
      </Card>
      {!isAdmin && <div className="mb-4"><Notice tone="blue" live={false}>Only an owner or admin can change these details.</Notice></div>}
      <Card>
        <h2 className="mb-3 text-[17px]">Restaurant details</h2>
        <ProfileForm slug={slug} r={restaurant} disabled={!isAdmin} />
      </Card>
    </>
  );
}
