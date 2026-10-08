// The installed app's system bar (Android's status and navigation bars). The app
// launches standalone (public/manifest.webmanifest), bars showing; the Full screen
// setting hides them with the Fullscreen API, which needs a tap: so it applies on
// the first tap after launch, and when the setting is switched on. iOS can't do
// either, and in a browser tab full screen is the browser's business, so the
// setting only shows in an app installed on Android (or another non-iOS system).

/** iPhone or iPad, which can't go full screen. */
export function isIOS(ua: string, touchPoints: number): boolean {
  // iPadOS reports itself as a Mac; its touch points give it away.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1);
}

/** Installed (launched from the home screen) and able to go full screen. */
export function canHideSystemBar(): boolean {
  if (typeof document === "undefined" || !document.documentElement.requestFullscreen) return false;
  const installed = matchMedia("(display-mode: standalone)").matches || matchMedia("(display-mode: fullscreen)").matches;
  return installed && !isIOS(navigator.userAgent, navigator.maxTouchPoints);
}

/** Into or out of full screen, as the setting says; quietly does nothing when the browser won't. */
export function applySystemBar(hide: boolean): void {
  if (!canHideSystemBar()) return;
  if (hide && !document.fullscreenElement) document.documentElement.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
  else if (!hide && document.fullscreenElement) document.exitFullscreen().catch(() => {});
}
