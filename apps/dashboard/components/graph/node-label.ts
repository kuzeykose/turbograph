/**
 * Split a node id into the label lines drawn on its card. Shared by the SVG and
 * canvas renderers so both truncate identically.
 */
export function formatNodeLabel(fullName: string): {
  primary: string;
  secondary: string | null;
} {
  const segments = fullName.split("/");
  const primaryRaw = segments[segments.length - 1] ?? fullName;
  const primary =
    primaryRaw.length > 26 ? `${primaryRaw.slice(0, 24)}…` : primaryRaw;

  let secondary: string | null = null;
  if (fullName.startsWith("@") && fullName.includes("/")) {
    const i = fullName.indexOf("/");
    const scope = fullName.slice(0, i + 1);
    secondary = scope.length > 30 ? `${scope.slice(0, 28)}…` : scope;
  } else if (segments.length > 1) {
    const prefix = segments.slice(0, -1).join("/");
    secondary = prefix.length > 30 ? `${prefix.slice(0, 28)}…` : prefix;
  }

  return { primary, secondary };
}

/** Sub-label shown under the node name: truncated path plus dependency counts. */
export function formatNodeSubline(
  secondary: string | null,
  dependencies: number,
  dependents: number,
): string {
  const meta = `${dependencies}d / ${dependents}r`;
  const raw = [secondary, meta].filter(Boolean).join(" · ");
  return raw.length > 46 ? `${raw.slice(0, 44)}…` : raw;
}

/**
 * Label for a node's tab, made unique against the other open tabs.
 *
 * A monorepo is full of files called `index.ts`, so the last path segment on
 * its own leaves two tabs looking identical. This walks back up the path until
 * the suffix tells them apart, then collapses the middle so the file name — the
 * part being read — still fits.
 */
export function formatTabLabel(
  nodeId: string,
  openTabs: readonly string[],
): string {
  const segments = segmentsOf(nodeId);
  const suffixOf = (id: string, take: number) =>
    segmentsOf(id).slice(-take).join("/");

  let take = 1;
  while (take < segments.length) {
    const mine = suffixOf(nodeId, take);
    const clashes = openTabs.some(
      (other) => other !== nodeId && suffixOf(other, take) === mine,
    );
    if (!clashes) break;
    take++;
  }

  const parts = segments.slice(-take);
  if (parts.length <= 2) return parts.join("/");
  return `${parts[0]}/…/${parts[parts.length - 1]}`;
}

/**
 * Path segments, with a package scope kept whole: `@repo/ui` is one name rather
 * than a directory called `@repo` holding a file called `ui`.
 */
function segmentsOf(nodeId: string): string[] {
  const segments = nodeId.split("/");
  if (nodeId.startsWith("@") && segments.length > 1) {
    return [`${segments[0]}/${segments[1]}`, ...segments.slice(2)];
  }
  return segments;
}
