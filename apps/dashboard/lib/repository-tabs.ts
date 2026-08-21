/**
 * The repository page's tabs, and which of them need a signed-in user.
 *
 * Kept in one place because three things have to agree: the sidebar decides
 * what to offer, the page decides what to render, and the context decides what
 * to fetch. Disagreement shows up as a tab that opens onto a prompt after it has
 * already spent the reader's rate limit.
 */
export type RepositoryTab =
  | "files"
  | "commits"
  | "turborepo"
  | "imports"
  | "packages"
  | "analysis";

export const REPOSITORY_TABS: RepositoryTab[] = [
  "files",
  "commits",
  "turborepo",
  "imports",
  "packages",
  "analysis",
];

/**
 * Tabs held back from guests, and why:
 * - `imports` walks every source file in the repo, which a guest's 60 requests
 *   an hour cannot cover.
 * - `files` fetches file contents one blob at a time, against the same budget.
 * - `analysis` spends model credits per run.
 */
const SIGN_IN_REQUIRED: ReadonlySet<RepositoryTab> = new Set<RepositoryTab>([
  "imports",
  "files",
  "analysis",
]);

export function tabRequiresSignIn(tab: RepositoryTab): boolean {
  return SIGN_IN_REQUIRED.has(tab);
}

/** Short reason shown where a tab is offered but not available. */
export function signInReasonFor(tab: RepositoryTab): string {
  switch (tab) {
    case "imports":
      return "Scanning imports needs a signed-in GitHub rate limit";
    case "files":
      return "Reading file contents needs a signed-in GitHub rate limit";
    case "analysis":
      return "Sign in to run an AI analysis";
    default:
      return "Sign in to use this";
  }
}
