import Link from "next/link";
import { fetchApiHealth, PUBLIC_API_URL } from "@/lib/api";
import { cn } from "@/lib/utils";

export default async function HomePage(): Promise<React.ReactElement> {
  const health = await fetchApiHealth();
  const apiOnline = health !== null;
  const dbOnline = health?.checks.database ?? false;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-20">
      <header className="flex flex-col gap-4">
        <span className="text-sm font-semibold uppercase tracking-widest text-primary">
          TradeScore
        </span>
        <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
          The trust layer for African commerce
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Nigeria runs on trust — but trust has no infrastructure. TradeScore turns
          informal trust signals into structured, portable, verifiable reputation so
          businesses can decide who to extend credit to with confidence.
        </p>
        <div>
          <Link
            href="/discover"
            className="inline-flex rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Discover businesses →
          </Link>
        </div>
      </header>

      <section className="rounded-xl border border-muted bg-muted/40 p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          System status
        </h2>
        <ul className="flex flex-col gap-3">
          <StatusRow label="Web app" online />
          <StatusRow label="API service" online={apiOnline} />
          <StatusRow label="Database" online={dbOnline} />
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">
          API base: <code>{PUBLIC_API_URL}/api/v1</code>
        </p>
      </section>

      <footer className="text-sm text-muted-foreground">
        Stage 1 — Foundation &amp; Architecture. Identity, trade logging, confirmation,
        and reputation engines arrive in later stages.
      </footer>
    </main>
  );
}

function StatusRow({ label, online }: { label: string; online: boolean }): React.ReactElement {
  return (
    <li className="flex items-center justify-between">
      <span>{label}</span>
      <span
        className={cn(
          "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
          online ? "bg-primary/15 text-primary" : "bg-red-100 text-red-700",
        )}
      >
        <span
          className={cn("h-2 w-2 rounded-full", online ? "bg-primary" : "bg-red-500")}
          aria-hidden
        />
        {online ? "Online" : "Offline"}
      </span>
    </li>
  );
}
