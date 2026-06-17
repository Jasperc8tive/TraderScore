import Link from "next/link";
import { cookies } from "next/headers";
import { fetchDiscovery } from "@/lib/api";
import { TrustBadge, VerificationPill } from "@/components/badges";
import { LowBandwidthToggle } from "@/components/LowBandwidthToggle";
import { LOW_BANDWIDTH_COOKIE, parseLowBandwidth, pageSizeFor } from "@/lib/prefs";

export const metadata = {
  title: "Discover businesses — TradeScore",
};

const BANDS = ["", "NEW", "BUILDING", "ESTABLISHED", "TRUSTED", "HIGHLY_TRUSTED"];

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.ReactElement> {
  const sp = await searchParams;
  const query = typeof sp.query === "string" ? sp.query : undefined;
  const band = typeof sp.band === "string" ? sp.band : undefined;
  const sort = typeof sp.sort === "string" ? sp.sort : "score";

  const cookieStore = await cookies();
  const lowBandwidth = parseLowBandwidth(cookieStore.get(LOW_BANDWIDTH_COOKIE)?.value);

  const results = await fetchDiscovery({
    query,
    band,
    sort,
    pageSize: String(pageSizeFor(lowBandwidth)),
  });

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <Link href="/" className="text-sm text-primary hover:underline">
          ← TradeScore
        </Link>
        <h1 className="text-3xl font-bold">Discover businesses</h1>
        <p className="text-muted-foreground">
          Check a business&apos;s trust score before you extend credit or trade.
        </p>
        <div>
          <LowBandwidthToggle enabled={lowBandwidth} />
        </div>
      </header>

      <form className="flex flex-wrap items-end gap-3" action="/discover" method="get">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          <span className="font-medium">Search</span>
          <input
            type="text"
            name="query"
            defaultValue={query ?? ""}
            placeholder="Business name…"
            className="rounded-md border border-muted bg-background px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Trust band</span>
          <select
            name="band"
            defaultValue={band ?? ""}
            className="rounded-md border border-muted bg-background px-3 py-2"
          >
            {BANDS.map((b) => (
              <option key={b || "any"} value={b}>
                {b === "" ? "Any" : b.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Sort</span>
          <select
            name="sort"
            defaultValue={sort}
            className="rounded-md border border-muted bg-background px-3 py-2"
          >
            <option value="score">Highest trust</option>
            <option value="name">Name</option>
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Search
        </button>
      </form>

      {results === null ? (
        <p className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          Unable to reach the directory right now. Please try again shortly.
        </p>
      ) : results.items.length === 0 ? (
        <p className="text-muted-foreground">No businesses match your search.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-muted rounded-lg border border-muted">
          {results.items.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-4 p-4">
              <div className="flex flex-col gap-1">
                <Link href={`/business/${b.slug}`} className="font-semibold hover:underline">
                  {b.name}
                </Link>
                {lowBandwidth ? null : (
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {b.marketName ? <span>{b.marketName}</span> : null}
                    <VerificationPill verification={b.verification} />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold tabular-nums">{b.score}</span>
                <TrustBadge band={b.band} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {results ? (
        <p className="text-xs text-muted-foreground">
          {results.total} business{results.total === 1 ? "" : "es"} found.
        </p>
      ) : null}
    </main>
  );
}
