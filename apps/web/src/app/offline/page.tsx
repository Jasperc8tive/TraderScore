export const metadata = { title: "Offline — TradeScore" };

export default function OfflinePage(): React.ReactElement {
  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-24 text-center">
      <h1 className="text-2xl font-bold">You&apos;re offline</h1>
      <p className="text-muted-foreground">
        TradeScore can&apos;t reach the network right now. Pages and businesses you&apos;ve already
        viewed are still available; reconnect to see the latest trust data.
      </p>
      <a href="/discover" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
        Try discovery
      </a>
    </main>
  );
}
