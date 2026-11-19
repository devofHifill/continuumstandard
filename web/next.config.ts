import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  // Keep the dev badge clear of the user menu (top right) and the demo toolbar (bottom right).
  devIndicators: { position: "bottom-left" },
  experimental: {
    instantInsights: {
      // Signed-in pages sit behind a *client-side* guard while auth is mocked in the browser,
      // so the server can't prerender them and automatic validation reports every one as
      // "dropped". Validate only segments that opt in with `export const instant`.
      // Revisit when the real backend moves session checks to the server.
      validationLevel: "manual-warning",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
