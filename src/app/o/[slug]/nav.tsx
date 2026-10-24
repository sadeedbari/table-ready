"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "", label: "Today" },
  { href: "/queue", label: "Walk-ins" },
  { href: "/tables", label: "Tables" },
  { href: "/hours", label: "Hours & rules" },
  { href: "/waitlist", label: "Waitlist" },
  { href: "/guests", label: "Guests" },
  { href: "/settings", label: "Settings" },
];

export function DashNav({ slug }: { slug: string }) {
  const path = usePathname();
  const base = `/o/${slug}`;
  return (
    <nav aria-label="Restaurant" className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-3 pb-2 scrollbar-none">
      {ITEMS.map((i) => {
        const href = base + i.href;
        const active = i.href === "" ? path === base : path.startsWith(href);
        return (
          <Link
            key={i.href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn("inline-flex h-10 shrink-0 items-center rounded-full px-4 text-[14px] font-medium transition-colors", active ? "bg-accent-fill text-white" : "text-label-2 hover:bg-surface-2")}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
