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

/**
 * What a reader gets by signing in, per tab. Written as the thing they gain,
 * not the door they hit: the gate is the best place this app ever has to
 * explain itself, and "sign in to continue" explains nothing.
 */
export interface SignInPitch {
  /** The tab's own name, for the eyebrow above the headline. */
  eyebrow: string;
  title: string;
  body: string;
  /** Three concrete gains, shortest first. */
  perks: [string, string, string];
}

export function signInPitchFor(tab: RepositoryTab): SignInPitch {
  switch (tab) {
    case "imports":
      return {
        eyebrow: "Imports",
        title: "Trace every import in this repo",
        body: "The import graph reads all source files and draws the edges between them — which module pulls which, and what moves when one of them does.",
        perks: [
          "5,000 GitHub requests an hour, not 60",
          "A full-repo scan instead of a sample",
          "File-level edges across every package",
        ],
      };
    case "files":
      return {
        eyebrow: "Files",
        title: "Read any file in this repo",
        body: "File contents arrive one blob at a time from the GitHub API. A guest's hourly budget is spent a few files into the tree.",
        perks: [
          "5,000 GitHub requests an hour, not 60",
          "Open any file, on any branch",
          "Syntax-highlighted, right beside the tree",
        ],
      };
    case "analysis":
      return {
        eyebrow: "AI Analysis",
        title: "Get an AI read on this monorepo",
        body: "The analysis walks the dependency graph, the workspace layout and the Turborepo config, then writes up what looks fragile and what to do about it.",
        perks: [
          "Dependency health and cycle warnings",
          "A review of your Turborepo pipeline",
          "A fix plan you can edit and re-run",
        ],
      };
    default:
      return {
        eyebrow: "Signed in",
        title: "Sign in to open this tab",
        body: "Signing in with GitHub raises your rate limit from 60 requests an hour to 5,000 and opens the tabs that need one.",
        perks: [
          "5,000 GitHub requests an hour, not 60",
          "Imports, Files and AI Analysis",
          "Private repositories you choose to connect",
        ],
      };
  }
}
