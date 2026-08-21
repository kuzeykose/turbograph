import type { GraphNode } from "@workspace/graph";

/** A node offered as a search result. */
export interface SearchableNode {
  id: string;
  name: string;
  type: GraphNode["type"];
}

/** Most results anyone reads before retyping; keeps a 1500-node scan cheap. */
export const MAX_SEARCH_RESULTS = 8;

/**
 * Rank so the file name beats the folder path.
 *
 * Searching an import graph for "utils" should surface `src/utils.ts` ahead of
 * `packages/turbo-utils/src/index.ts`, which only matches deep in its path.
 */
function scoreOf(name: string, query: string): number | null {
  const lower = name.toLowerCase();
  const basename = lower.slice(lower.lastIndexOf("/") + 1);

  if (basename === query) return 0;
  if (basename.startsWith(query)) return 1;
  if (basename.includes(query)) return 2;
  if (lower.includes(query)) return 3;
  return null;
}

/**
 * Nodes matching `query`, best first. An empty query matches nothing rather
 * than everything: the list is a way to reach one node, not to browse them all.
 */
export function searchNodes(
  nodes: readonly SearchableNode[],
  query: string,
  limit = MAX_SEARCH_RESULTS,
): SearchableNode[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return [];

  const scored: { node: SearchableNode; score: number }[] = [];
  for (const node of nodes) {
    const score = scoreOf(node.name, needle);
    if (score !== null) scored.push({ node, score });
  }

  scored.sort(
    (a, b) =>
      a.score - b.score ||
      a.node.name.length - b.node.name.length ||
      a.node.name.localeCompare(b.node.name),
  );

  return scored.slice(0, limit).map((entry) => entry.node);
}
