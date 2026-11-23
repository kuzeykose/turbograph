import type { Metadata } from "next";
import { siteConfig } from "@/lib/site";
import { RepositoryProvider } from "@/contexts/repository-context";
import { RepositoryHeader } from "@/components/repository-header";

type RepositoryRouteParams = { owner: string; repo: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<RepositoryRouteParams>;
}): Promise<Metadata> {
  const { owner, repo } = await params;
  const fullName = `${decodeURIComponent(owner)}/${decodeURIComponent(repo)}`;
  const description = `Explore the Turborepo dependency graph, packages, imports and commit impact of ${fullName}.`;
  const path = `/repository/${owner}/${repo}`;

  return {
    title: fullName,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: siteConfig.name,
      title: fullName,
      description,
      url: path,
    },
    twitter: { card: "summary_large_image", title: fullName, description },
  };
}

export default function RepositoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RepositoryProvider>
      <div className="h-screen flex flex-col bg-zinc-50 dark:bg-black overflow-hidden">
        <RepositoryHeader />
        <div className="flex flex-1 overflow-hidden">{children}</div>
      </div>
    </RepositoryProvider>
  );
}
