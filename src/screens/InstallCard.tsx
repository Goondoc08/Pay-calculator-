import { useAppData } from "../app/AppData";
import { detectPlatform, isStandaloneNow } from "../app/platform";

export function Steps({
  platform,
}: {
  platform: "ios" | "android" | "desktop";
}) {
  if (platform === "ios") {
    return (
      <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-300">
        <li>
          Tap the <span className="text-slate-100">Share</span> button (the
          square with an arrow) in Safari's toolbar
        </li>
        <li>
          Scroll down and tap{" "}
          <span className="text-slate-100">Add to Home Screen</span>
        </li>
        <li>Tap Add — it now opens like any other app, even offline</li>
      </ol>
    );
  }
  if (platform === "android") {
    return (
      <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-300">
        <li>
          Tap the <span className="text-slate-100">⋮</span> menu in Chrome's
          toolbar
        </li>
        <li>
          Tap <span className="text-slate-100">Add to Home screen</span> (or{" "}
          <span className="text-slate-100">Install app</span> if offered)
        </li>
        <li>Confirm — it now opens like any other app, even offline</li>
      </ol>
    );
  }
  return (
    <p className="text-sm text-slate-300">
      Open this page on your phone to install it there — look for "Add to Home
      Screen" (iPhone/Safari) or "Install app" (Android/Chrome) in the browser's
      menu.
    </p>
  );
}

export function InstallCard() {
  const { installCardDismissed, dismissInstallCard } = useAppData();

  if (installCardDismissed || isStandaloneNow()) return null;

  const platform = detectPlatform(navigator.userAgent);

  return (
    <div className="mx-4 mt-4 flex flex-col gap-3 rounded-lg border border-emerald-800 bg-emerald-950/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-medium text-emerald-300">
          Install this on your phone
        </h2>
        <button
          type="button"
          onClick={dismissInstallCard}
          className="text-xs text-slate-400"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
      <Steps platform={platform} />
      <p className="text-xs text-slate-500">
        Works fully offline once installed — nothing here needs a signal. Find
        these steps again anytime in Settings.
      </p>
    </div>
  );
}
