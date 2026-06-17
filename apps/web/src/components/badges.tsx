import { cn } from "@/lib/utils";
import type { VerificationBadge } from "@/lib/api";

const BAND_STYLES: Record<string, { label: string; className: string }> = {
  NEW: { label: "New", className: "bg-muted text-muted-foreground" },
  BUILDING: { label: "Building", className: "bg-amber-100 text-amber-800" },
  ESTABLISHED: { label: "Established", className: "bg-sky-100 text-sky-800" },
  TRUSTED: { label: "Trusted", className: "bg-primary/15 text-primary" },
  HIGHLY_TRUSTED: { label: "Highly Trusted", className: "bg-emerald-100 text-emerald-800" },
};

export function TrustBadge({ band }: { band: string }): React.ReactElement {
  const style = BAND_STYLES[band] ?? BAND_STYLES.NEW!;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        style.className,
      )}
    >
      {style.label}
    </span>
  );
}

export function VerificationPill({ verification }: { verification: VerificationBadge }): React.ReactElement {
  if (!verification.verified) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        Unverified
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
      <span aria-hidden>✓</span>
      {verification.label}
    </span>
  );
}
