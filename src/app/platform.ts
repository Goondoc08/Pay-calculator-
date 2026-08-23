export type InstallPlatform = "ios" | "android" | "desktop";

/**
 * Coarse platform detection for install instructions only — never used for
 * anything that affects pay math. iOS Safari has no install-prompt API at
 * all, so "Add to Home Screen" instructions are the only option there;
 * Android Chrome can trigger a native prompt, but the manual steps work
 * everywhere and don't need the browser's cooperation.
 */
export function detectPlatform(userAgent: string): InstallPlatform {
  const ua = userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  // iPadOS 13+ reports as "Macintosh" but exposes touch support.
  if (/macintosh/.test(ua) && /mobile|touch/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return "desktop";
}

/** True if already launched from a home-screen icon (standalone display
 * mode) — the install card has nothing useful to say at that point. */
export function isStandalone(nav: {
  standalone?: boolean;
  matchesStandaloneMediaQuery?: boolean;
}): boolean {
  return nav.standalone === true || nav.matchesStandaloneMediaQuery === true;
}

/** Reads the real browser environment — kept separate from isStandalone's
 * logic so that logic stays unit-testable without a DOM. */
export function isStandaloneNow(): boolean {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return isStandalone({
    standalone: nav.standalone ?? false,
    matchesStandaloneMediaQuery:
      window.matchMedia?.("(display-mode: standalone)").matches ?? false,
  });
}
