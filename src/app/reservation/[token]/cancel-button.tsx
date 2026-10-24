"use client";
import { ActionForm } from "@/components/ui/action-form";
import { cancelByToken } from "@/app/[slug]/actions";

export function CancelButton({ token }: { token: string }) {
  return (
    <ActionForm
      action={async () => {
        if (!window.confirm("Cancel this reservation?")) return;
        return cancelByToken(token);
      }}
      submit="Cancel reservation"
      variant="destructive"
    />
  );
}
