import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchTrustProfile } from "@/lib/api";
import { TrustBadge, VerificationPill } from "@/components/badges";
import { cn } from "@/lib/utils";

const FACTOR_LABELS: Record<string, string> = {
  CONFIRMED_TRADE_VOLUME: "Confirmed trade volume",
  COUNTERPARTY_DIVERSITY: "Counterparty diversity",
  CONFIRMATION_RELIABILITY: "Confirmation reliability",
  IDENTITY_ASSURANCE: "Identity assurance",
  DISPUTE_PENALTY: "Disputes & rejections",
};

export default async function BusinessProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<React.ReactElement> {
  const { slug } = await params;
  const profile = await fetchTrustProfile(slug);
  if (!profile) notFound();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-12">
      <Link href="/discover" className="text-sm text-primary hover:underline">
        ← Back to discovery
      </Link>

      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">{profile.name}</h1>
          <VerificationPill verification={profile.verification} />
        </div>
        {profile.marketName ? (
          <p className="text-muted-foreground">{profile.marketName}</p>
        ) : null}
        {profile.description ? <p>{profile.description}</p> : null}
      </header>

      <section className="rounded-xl border border-muted bg-muted/30 p-6">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              TradeScore
            </p>
            <p className="text-5xl font-bold tabular-nums">{profile.score}</p>
            <p className="text-xs text-muted-foreground">out of 1000</p>
          </div>
          <TrustBadge band={profile.band} />
        </div>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${Math.min(100, (profile.score / 1000) * 100)}%` }}
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Why this score</h2>
        <ul className="flex flex-col divide-y divide-muted rounded-lg border border-muted">
          {profile.factors.map((f) => (
            <li key={f.key} className="flex items-center justify-between p-3 text-sm">
              <span>{FACTOR_LABELS[f.key] ?? f.key}</span>
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  f.direction === "NEGATIVE" ? "text-red-600" : "text-primary",
                )}
              >
                {f.direction === "NEGATIVE" ? "−" : "+"}
                {f.weight}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Algorithm v{profile.algorithmVersion} · computed{" "}
          {new Date(profile.scoreComputedAt).toLocaleString()}
        </p>
      </section>
    </main>
  );
}
