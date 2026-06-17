"use client";

import { useTransition } from "react";
import { LOW_BANDWIDTH_COOKIE } from "@/lib/prefs";

/**
 * Toggles low-bandwidth mode by setting the `lowbw` cookie and reloading so the
 * server re-renders a lighter page. Explicit and persistent — the user controls
 * their data usage.
 */
export function LowBandwidthToggle({ enabled }: { enabled: boolean }): React.ReactElement {
  const [pending, startTransition] = useTransition();

  function toggle(): void {
    const next = enabled ? "0" : "1";
    // 1-year persistent cookie.
    document.cookie = `${LOW_BANDWIDTH_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => {
      window.location.reload();
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={enabled}
      className="rounded-md border border-muted px-3 py-1.5 text-xs font-medium"
    >
      Low-bandwidth mode: {enabled ? "On" : "Off"}
    </button>
  );
}
