import { renderOgImage, ogImageContentType, ogImageSize } from "@/lib/og-image";

export const alt = "Turborepo dependency graph on Turbograph";
export const size = ogImageSize;
export const contentType = ogImageContentType;

export default async function RepositoryOpengraphImage({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>;
}) {
  const { owner, repo } = await params;
  return renderOgImage({
    eyebrow: "Repository",
    title: `${decodeURIComponent(owner)}/${decodeURIComponent(repo)}`,
    subtitle: "Dependency graph, packages, imports and commit impact.",
  });
}
