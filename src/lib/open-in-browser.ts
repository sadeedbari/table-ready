/**
 * An installed web app treats every link on its own site as part of itself, so a plain "open in a new tab" link stays inside the
 * app. To send a page to the phone's own browser we use what each system offers:
 *  - a second address for the same site (`otherOrigin`): a link outside the app's own address always opens in a browser view;
 *  - iPhone: the `x-safari-https:` address, which asks Safari to open the page;
 *  - Android: an `intent:` address aimed at Chrome, falling back to the plain page if Chrome is not there.
 * Anything else (a desktop, an unknown phone) gets null, and the caller opens a normal new tab.
 */
export interface LaunchEnv { ios: boolean; android: boolean; otherOrigin?: string | null }

export function browserLaunchUrl(pageUrl: string, env: LaunchEnv): string | null {
  const u = new URL(pageUrl);
  if (env.otherOrigin) {
    const o = new URL(env.otherOrigin);
    if (o.origin !== u.origin) return `${o.origin}${u.pathname}${u.search}${u.hash}`;
  }
  if (env.ios) return pageUrl.replace(/^https?:/, (p) => `x-safari-${p}`);
  if (env.android) {
    const scheme = u.protocol.replace(":", "");
    return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${scheme};action=android.intent.action.VIEW;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(pageUrl)};end`;
  }
  return null;
}
