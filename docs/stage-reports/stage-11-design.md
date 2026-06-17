# Stage 11 — Mobile Optimization (PWA): Design Note (pre-build)

> Produced before code. Defines the PWA, the offline caching strategy, and the
> low-bandwidth mode for the smartphone-first, often low-connectivity trader
> audience. Web-only stage (no API/DB changes).

## Goal

Make TradeScore usable on a cheap Android phone over a flaky 3G connection:
installable, fast to load, viewable offline for things already seen, and lean on
data when the user asks.

## PWA

- **Web app manifest** (`/manifest.webmanifest`): name, standalone display,
  theme/background colours, start URL, and a maskable icon — making the app
  installable to the home screen.
- **Metadata**: `theme-color`, viewport, and manifest link wired via Next.js
  metadata/viewport exports.
- **Service worker** registered on the client after load.

## Offline caching strategy (service worker)

A hand-rolled service worker (no heavy dependency), versioned cache:

- **Precache the app shell** on install: `/`, `/discover`, `/offline`, the
  manifest, and the icon.
- **Navigations:** network-first → fall back to cache → fall back to `/offline`.
  So a previously visited business profile or the discover page is viewable
  offline; anything never seen shows a friendly offline page.
- **Static assets** (`/_next/static/*`): stale-while-revalidate (instant loads,
  refreshed in the background).
- **Discovery reads:** network-first with cache fallback, so a trader can still
  see the last-known trust data when offline.
- **Cache hygiene:** old cache versions are deleted on `activate`; only GET
  requests are cached.

## Low-bandwidth mode

A user-toggleable mode (persisted in a `lowbw` cookie) that the **server reads**
to render a lighter page:

- smaller result pages (fewer rows per fetch),
- omit non-essential content (descriptions),
- still show the essentials — name, market, trust band, score.

Because it is server-driven via a cookie, the lighter payload is produced on the
server (less data over the wire), not just hidden on the client.

## Verification approach (honest)

Service-worker *runtime* behaviour is a browser concern not fully exercisable via
HTTP probes. We verify: the build succeeds; the manifest, service worker, icon, and
offline page are served (HTTP 200); the SW is valid JS with the expected caching
logic; registration code is present; and low-bandwidth mode changes the
server-rendered output (fewer rows, no descriptions) based on the cookie.

## UX & performance principles

- **Mobile-first, responsive** layouts (Tailwind) — already in use; verified at
  small widths.
- **Fast first paint**: server-rendered, minimal JS; SW makes repeat visits instant.
- **Respect the user's data**: low-bandwidth mode is explicit and persistent.

## Out of scope (named stages)

Push notifications (needs provider + opt-in; Stage 13), background sync of queued
actions, full offline *write* support, app-store packaging, store-grade PNG icon
set (an SVG maskable icon is used now).
