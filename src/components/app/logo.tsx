import { cn } from "@/lib/utils";

/** The brand mark: the same drawing as the app icon, favicon and email header (public/icons, src/app/icon.svg), always in full colour. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" role="img" aria-label="Table Ready" className={cn("size-[1.5em] shrink-0", className)}>
      <rect width="64" height="64" rx="14" fill="#b4491f" />
      <g transform="translate(14 14) scale(1.5)">
        <g fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m16 2-2.3 2.3a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 0 0 4.2 0L22 8" />
          <path d="M15 15 3.3 3.3a4.2 4.2 0 0 0 0 6l7.3 7.3c.7.7 2 .7 2.8 0L15 15Zm0 0 7 7" />
          <path d="m2.1 21.8 6.4-6.3" />
          <path d="m19 5-7 7" />
        </g>
      </g>
    </svg>
  );
}

export function Logo({ className, mark = false }: { className?: string; mark?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-display font-semibold tracking-tight text-label", className)} style={{ fontFamily: "var(--font-display)" }}>
      <LogoMark />
      {!mark && <span>Table Ready</span>}
    </span>
  );
}
