/**
 * Server-side API base URL.
 *
 * Inside Docker, the browser reaches the API at NEXT_PUBLIC_API_URL (localhost),
 * but server components fetch over the Docker network at INTERNAL_API_URL
 * (the `api` service name). Falls back to the public URL when not in Docker.
 */
export const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
export const INTERNAL_API_URL = process.env.INTERNAL_API_URL ?? PUBLIC_API_URL;

export interface ApiHealth {
  status: string;
  checks: { database: boolean };
}

export interface VerificationBadge {
  verified: boolean;
  label: string;
  level: string;
}

export interface DiscoveryListItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  marketName: string | null;
  assuranceLevel: string;
  verification: VerificationBadge;
  score: number;
  band: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ScoreFactor {
  key: string;
  direction: string;
  weight: number;
  detail: Record<string, unknown>;
}

export interface TrustProfile extends DiscoveryListItem {
  phone: string | null;
  email: string | null;
  scoreComputedAt: string;
  algorithmVersion: string;
  factors: ScoreFactor[];
}

async function getData<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${INTERNAL_API_URL}/api/v1${path}`, { cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json()) as { data: T };
    return body.data;
  } catch {
    return null;
  }
}

/** Best-effort readiness probe for the landing page. Never throws. */
export async function fetchApiHealth(): Promise<ApiHealth | null> {
  return getData<ApiHealth>("/health/ready");
}

export async function fetchDiscovery(
  params: Record<string, string | undefined>,
): Promise<Paginated<DiscoveryListItem> | null> {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") search.set(k, v);
  }
  const qs = search.toString();
  return getData<Paginated<DiscoveryListItem>>(`/discovery${qs ? `?${qs}` : ""}`);
}

export async function fetchTrustProfile(slug: string): Promise<TrustProfile | null> {
  return getData<TrustProfile>(`/discovery/${encodeURIComponent(slug)}`);
}
