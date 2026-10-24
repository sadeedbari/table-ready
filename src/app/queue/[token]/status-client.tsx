"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ActionForm } from "@/components/ui/action-form";
import { leaveQueue } from "@/app/[slug]/queue/actions";

/** Re-checks the line every 10 seconds, so "Your table is ready" appears without reloading. */
export function StatusPoller() {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, 10_000);
    return () => clearInterval(id);
  }, [router]);
  return null;
}

export function LeaveButton({ token }: { token: string }) {
  return (
    <ActionForm
      action={async () => {
        if (!window.confirm("Leave the line?")) return;
        return leaveQueue(token);
      }}
      submit="Leave the line"
      variant="gray"
    />
  );
}
