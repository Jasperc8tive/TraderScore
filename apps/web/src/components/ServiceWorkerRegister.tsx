"use client";

import { useEffect } from "react";

/**
 * Registers the service worker after load so repeat visits are instant and
 * previously-seen pages work offline. No-op where service workers are unsupported.
 */
export function ServiceWorkerRegister(): null {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const register = (): void => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* registration is best-effort; the app works without it */
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}
