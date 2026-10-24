import clsx, { type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** Slugs that can't be used for restaurants because they collide with app routes. */
export const RESERVED_SLUGS = new Set([
  "api", "app", "o", "login", "signup", "logout", "auth", "onboarding", "invite", "booking", "reservation", "reserve",
  "settings", "admin", "dashboard", "waitlist", "sms", "help", "support", "pricing", "about", "terms", "privacy",
  "blog", "docs", "preview", "static", "_next", "favicon", "tableready", "www", "mail", "embed",
  "forgot", "reset", "sitemap", "robots", "manifest", "icon", "icons", "opengraph-image", "twitter-image",
]);

