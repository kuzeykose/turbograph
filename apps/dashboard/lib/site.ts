/**
 * Shared site metadata used by the root layout, generated Open Graph images,
 * the web manifest, robots.txt and sitemap.xml.
 */
export const siteConfig = {
  name: "Turbograph",
  title: "Turbograph – Visualize Your Turborepo Workspace",
  shortDescription: "Interactive dependency graphs for Turborepo monorepos.",
  description:
    "Map every dependency, trace commit impact, and understand your Turborepo monorepo. Explore interactive dependency graphs from the terminal or the browser.",
  keywords: [
    "Turborepo",
    "monorepo",
    "dependency graph",
    "workspace visualization",
    "pnpm workspaces",
    "package dependencies",
    "impact analysis",
    "CLI",
    "trbgraph",
  ],
  repository: "https://github.com/kuzeykose/turbograph",
  themeColor: { light: "#fafafa", dark: "#000000" },
  brand: { from: "#8b5cf6", to: "#2dd4bf" },
} as const;

function withProtocol(host: string): string {
  return /^https?:\/\//.test(host) ? host : `https://${host}`;
}

/**
 * Absolute origin of the deployed site. Social crawlers need absolute URLs for
 * preview images, so this resolves, in order: an explicit NEXT_PUBLIC_SITE_URL,
 * Vercel's production domain, the per-deployment Vercel URL, then localhost.
 */
export function getSiteUrl(): URL {
  const candidate =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL;

  if (candidate) {
    try {
      return new URL(withProtocol(candidate));
    } catch {
      // Fall through to the local default on a malformed value.
    }
  }

  return new URL(`http://localhost:${process.env.PORT ?? 3000}`);
}
