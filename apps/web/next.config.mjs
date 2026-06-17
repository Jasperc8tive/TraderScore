/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Standalone output is only needed for the production Docker image (built on
  // Linux). It is gated behind BUILD_STANDALONE because the trace step requires
  // symlink privileges that are unavailable on a typical Windows dev machine.
  ...(process.env.BUILD_STANDALONE === "true" ? { output: "standalone" } : {}),
  // Workspace packages are shipped as TS source and transpiled by Next.
  transpilePackages: ["@tradescore/shared"],
  experimental: {
    // Allow importing from the monorepo root during local dev.
    externalDir: true,
  },
};

export default nextConfig;
