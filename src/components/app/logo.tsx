import { UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className, mark = false }: { className?: string; mark?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-display font-semibold tracking-tight text-label", className)} style={{ fontFamily: "var(--font-display)" }}>
      <span className="grid size-[1.5em] place-items-center rounded-[0.45em] bg-accent-fill text-white">
        <UtensilsCrossed className="size-[0.85em]" aria-hidden />
      </span>
      {!mark && <span>Table Ready</span>}
    </span>
  );
}
