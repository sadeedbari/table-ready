import { Info } from "lucide-react";
import { formatTime } from "@/lib/format";
import type { ActiveNotice } from "@/lib/notices-server";

/** The restaurant's own message at the top of a guest page (for example "The kitchen is backed up"). Renders nothing when there are none. */
export function NoticeBanner({ notices, timeZone, staff }: { notices: ActiveNotice[]; timeZone: string; staff?: boolean }) {
  if (!notices.length) return null;
  return (
    <div className="space-y-2" data-testid="guest-notices">
      {notices.map((n) => (
        <div key={n.id} role="status" className="flex items-start gap-3 rounded-[16px] bg-[color-mix(in_srgb,var(--orange)_16%,transparent)] px-4 py-3 text-orange-text">
          <Info className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="min-w-0 text-[15px] leading-snug">
            {staff && <span className="font-semibold">Guests see: </span>}
            <span className="font-medium">{n.message}</span>
            <span className="ml-1 whitespace-nowrap text-[13px] opacity-80">· until {formatTime(n.ends_at, timeZone)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
