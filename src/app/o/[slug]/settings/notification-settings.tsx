"use client";
import { ActionForm } from "@/components/ui/action-form";
import { Switch } from "@/components/ui/switch";
import { saveNotificationSettings } from "../actions";

export function NotificationSettings({ slug, push, email, disabled }: { slug: string; push: boolean; email: boolean; disabled?: boolean }) {
  return (
    <ActionForm action={saveNotificationSettings.bind(null, slug)} submit={disabled ? null : "Save"} size="sm">
      <p className="text-[14px] text-label-2">
        Alerts go to owners and admins when a guest books a table online, cancels, joins the waitlist, or joins the line. Reservations you add yourself never alert you.
      </p>
      <div className="flex items-center justify-between gap-4 rounded-[12px] bg-surface-2 px-4 py-3">
        <div><div className="text-[15px] font-medium">Email alerts</div><div className="text-[13px] text-label-2">Sent to the email address on each owner&apos;s and admin&apos;s account.</div></div>
        <Switch name="notify_email" defaultChecked={email} label="Email alerts" disabled={disabled} />
      </div>
      <div className="flex items-center justify-between gap-4 rounded-[12px] bg-surface-2 px-4 py-3">
        <div><div className="text-[15px] font-medium">Phone alerts</div><div className="text-[13px] text-label-2">Push notifications to every device where someone turned them on above.</div></div>
        <Switch name="notify_push" defaultChecked={push} label="Phone alerts" disabled={disabled} />
      </div>
    </ActionForm>
  );
}
