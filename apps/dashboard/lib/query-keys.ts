export const queryKeys = {
  repositories: {
    userRepos: () => ["repositories", "user"] as const,
  },
  repository: {
    detail: (owner: string, repo: string) =>
      ["repository", owner, repo] as const,
    turborepo: (owner: string, repo: string, branch?: string) =>
      ["repository", owner, repo, "turborepo", branch] as const,
    imports: (owner: string, repo: string, branch?: string) =>
      ["repository", owner, repo, "imports", branch] as const,
  },
  contents: {
    dir: (owner: string, repo: string, path: string, branch?: string) =>
      ["contents", owner, repo, path, branch] as const,
  },
  commits: {
    list: (
      owner: string,
      repo: string,
      page: number,
      branch?: string,
    ) => ["commits", owner, repo, page, branch] as const,
  },
};
