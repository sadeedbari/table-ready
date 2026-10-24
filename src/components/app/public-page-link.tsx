"use client";
import type { ReactNode } from "react";
import { browserLaunchUrl } from "@/lib/open-in-browser";

/**
 * A link to a public page that opens in a new tab in a normal browser, and in the phone's own browser (outside the app) when
 * it is clicked from the installed app.
 */
export function PublicPageLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={(e) => {
        const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
        if (!standalone) return; // a normal browser: the default new tab is right
        const ua = navigator.userAgent;
        const target = browserLaunchUrl(new URL(href, window.location.origin).toString(), {
          ios: /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
          android: /android/i.test(ua),
          otherOrigin: process.env.NEXT_PUBLIC_BROWSER_ORIGIN,
        });
        if (!target) return;
        e.preventDefault();
        window.location.href = target;
      }}
    >
      {children}
    </a>
  );
}
