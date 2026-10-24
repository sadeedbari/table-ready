"use client";
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { submitForm, useSafeTransition } from "@/components/ui/use-server-action";
import { cn } from "@/lib/utils";

export type ActionResult = { error?: string; message?: string; redirect?: string } | void;

/**
 * A form that runs a server action, keeps what the person typed when something fails, shows the error in place and a toast on
 * success. The action returns { error } or { message }, or throws redirect().
 */
export function ActionForm({
  action,
  children,
  submit = "Save",
  className,
  variant = "filled",
  size = "md",
  onDone,
  resetOnSuccess,
  footer,
}: {
  action: (fd: FormData) => Promise<ActionResult>;
  children?: ReactNode;
  submit?: string | null;
  className?: string;
  variant?: "filled" | "tinted" | "gray" | "plain" | "destructive";
  size?: "sm" | "md" | "lg";
  onDone?: () => void;
  resetOnSuccess?: boolean;
  footer?: ReactNode;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useSafeTransition(setError);
  const toast = useToast();
  const router = useRouter();
  return (
    <form
      className={cn("space-y-3", className)}
      onSubmit={(e) => {
        const form = e.currentTarget;
        submitForm((fd) =>
          start(async () => {
            const r = await action(fd);
            if (r && r.error) return setError(r.error);
            setError(null);
            if (r && r.message) toast(r.message);
            if (resetOnSuccess) form.reset();
            if (r && r.redirect) router.push(r.redirect);
            onDone?.();
          }),
        )(e);
      }}
    >
      {children}
      {error && <Notice tone="red">{error}</Notice>}
      {(submit || footer) && (
        <div className="flex flex-wrap items-center gap-2">
          {submit && <Button type="submit" variant={variant} size={size} loading={pending}>{submit}</Button>}
          {footer}
        </div>
      )}
    </form>
  );
}

/** A single button that runs a server action with no fields (for example "Seat" or "No-show"). */
export function ActionButton({
  action,
  children,
  variant = "gray",
  size = "sm",
  confirm,
  className,
}: {
  action: () => Promise<ActionResult>;
  children: ReactNode;
  variant?: "filled" | "tinted" | "gray" | "plain" | "destructive";
  size?: "sm" | "md";
  confirm?: string;
  className?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useSafeTransition(setError);
  const toast = useToast();
  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        loading={pending}
        className={className}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          start(async () => {
            const r = await action();
            if (r && r.error) setError(r.error);
            else {
              setError(null);
              if (r && r.message) toast(r.message);
            }
          });
        }}
      >
        {children}
      </Button>
      {error && <span role="alert" className="text-[12px] text-red-text">{error}</span>}
    </>
  );
}
