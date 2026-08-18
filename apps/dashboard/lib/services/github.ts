import { Repository, ContentItem, FileContent } from "@/types/repository";
import {
  GitHubRepository,
  GitHubBranch,
  GitHubCommit,
  GitHubCommitDetail,
  GitHubAPIError,
  GitHubRateLimitError,
  GitHubInstallation,
  GitHubInstallationRepositoriesResponse,
  GetContentsOptions,
  GetBranchesOptions,
  GetCommitsOptions,
  GetUserRepositoriesOptions,
  GitHubTreeItem,
  GitHubTreeResponse,
  GitBlobRef,
  GraphQLResponse,
  PaginatedResponse,
} from "@/types/github";
import type { PackageInfo } from "@workspace/graph";

interface CacheEntry {
  data: any;
  expiresAt: number;
}

class GitHubService {
  private token?: string;
  private baseUrl = "https://api.github.com";
  private cache = new Map<string, CacheEntry>();

  // Cache TTLs in milliseconds
  private readonly CACHE_TTL = {
    REPOSITORY: 5 * 60 * 1000, // 5 minutes
    BRANCHES: 2 * 60 * 1000, // 2 minutes
    CONTENTS: 2 * 60 * 1000, // 2 minutes
    TREE: 2 * 60 * 1000, // 2 minutes
    COMMITS: 1 * 60 * 1000, // 1 minute
  };

  constructor(token?: string) {
    this.token = token;
  }

  /**
   * Get authentication token from constructor or gh_provider_token cookie
   */
  private async getToken(): Promise<string | undefined> {
    if (this.token) {
      return this.token;
    }

    if (typeof document === "undefined") {
      return undefined;
    }

    const cookies = document.cookie.split(";").map((cookie) => cookie.trim());
    const tokenCookie = cookies.find((cookie) =>
      cookie.startsWith("gh_provider_token="),
    );

    if (!tokenCookie) {
      return undefined;
    }

    const [, value] = tokenCookie.split("=");
    return value || undefined;
  }

  /**
   * Build headers for GitHub API requests
   */
  private async buildHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };

    const token = await this.getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return headers;
  }

  /**
   * Track rate limit from response headers
   */
  private trackRateLimit(response: Response): void {
    const limit = response.headers.get("X-RateLimit-Limit");
    const remaining = response.headers.get("X-RateLimit-Remaining");
    const reset = response.headers.get("X-RateLimit-Reset");

    if (remaining && parseInt(remaining) < 100) {
      const resetDate = reset ? new Date(parseInt(reset) * 1000) : null;
      console.warn(
        `GitHub API rate limit low: ${remaining}/${limit} remaining` +
          (resetDate ? ` (resets at ${resetDate.toLocaleTimeString()})` : ""),
      );
    }
  }

  /**
   * Parse Link header for pagination info
   */
  private parseLinkHeader(linkHeader: string | null): {
    hasMore: boolean;
    totalPages?: number;
  } {
    if (!linkHeader) {
      return { hasMore: false };
    }

    const lastPageMatch = linkHeader.match(/[?&]page=(\d+)[^>]*>;\s*rel="last"/);
    const hasNext = linkHeader.includes('rel="next"');

    return {
      hasMore: hasNext,
      totalPages: lastPageMatch ? parseInt(lastPageMatch[1]) : undefined,
    };
  }

  /**
   * Decode base64 content from GitHub API
   */
  private decodeBase64Content(content: string): string {
    return atob(content.replace(/\n/g, ""));
  }

  /**
   * Generic request method with error handling and rate limit tracking
   */
  private async request<T>(
    endpoint: string,
    options?: RequestInit,
  ): Promise<Response> {
    try {
      const headers = await this.buildHeaders();
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: { ...headers, ...options?.headers },
      });

      // Track rate limits
      this.trackRateLimit(response);

      // Check for rate limit error
      if (response.status === 403) {
        const rateLimitRemaining = response.headers.get(
          "X-RateLimit-Remaining",
        );
        if (rateLimitRemaining === "0") {
          const resetTime = response.headers.get("X-RateLimit-Reset");
          const limit = response.headers.get("X-RateLimit-Limit");
          throw new GitHubRateLimitError(
            new Date(parseInt(resetTime || "0") * 1000),
            parseInt(limit || "0"),
            0,
          );
        }
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new GitHubAPIError(
          error.message || `GitHub API error: ${response.statusText}`,
          response.status,
          error,
        );
      }

      return response;
    } catch (error) {
      if (error instanceof GitHubAPIError) {
        throw error;
      }
      throw new GitHubAPIError(
        error instanceof Error ? error.message : "Unknown error occurred",
      );
    }
  }

  /**
   * Get cached data or fetch new data
   */
  private async getCached<T>(
    key: string,
    ttl: number,
    fetcher: () => Promise<T>,
  ): Promise<T> {
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data as T;
    }

    const data = await fetcher();
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttl,
    });

    return data;
  }

  /**
   * Get repository details
   */
  async getRepository(owner: string, repo: string): Promise<GitHubRepository> {
    const cacheKey = `repo:${owner}/${repo}`;
    return this.getCached(cacheKey, this.CACHE_TTL.REPOSITORY, async () => {
      const response = await this.request(`/repos/${owner}/${repo}`);
      return await response.json();
    });
  }

  /**
   * Ensure a valid GitHub token is available
   */
  private async ensureAuthenticated(): Promise<void> {
    const token = await this.getToken();
    if (!token) {
      throw new GitHubAPIError(
        "GitHub authentication token is missing or expired. Please sign out and sign in again.",
        401,
      );
    }
  }

  /**
   * Get user repositories
   */
  async getUserRepositories(
    options?: GetUserRepositoriesOptions,
  ): Promise<GitHubRepository[]> {
    // This endpoint requires authentication
    await this.ensureAuthenticated();

    const params = new URLSearchParams();
    if (options?.sort) params.append("sort", options.sort);
    if (options?.direction) params.append("direction", options.direction);
    if (options?.perPage) params.append("per_page", options.perPage.toString());
    if (options?.page) params.append("page", options.page.toString());
    if (options?.type) params.append("type", options.type);

    const queryString = params.toString();
    const endpoint = `/user/repos${queryString ? `?${queryString}` : ""}`;

    const response = await this.request(endpoint);
    return await response.json();
  }

  /**
   * Get the user's GitHub App installations.
   * Returns installations of the TurboGraph app for the authenticated user.
   */
  async getUserInstallations(): Promise<GitHubInstallation[]> {
    await this.ensureAuthenticated();

    const response = await this.request("/user/installations");
    const data = await response.json();
    return data.installations || [];
  }

  /**
   * Get repositories accessible through a specific GitHub App installation.
   * Handles pagination to fetch all repositories.
   */
  async getInstallationRepositories(
    installationId: number,
    options?: { sort?: string; perPage?: number },
  ): Promise<GitHubRepository[]> {
    await this.ensureAuthenticated();

    const allRepos: GitHubRepository[] = [];
    let page = 1;
    const perPage = options?.perPage || 100;

    while (true) {
      const params = new URLSearchParams();
      params.append("per_page", perPage.toString());
      params.append("page", page.toString());

      const response = await this.request(
        `/user/installations/${installationId}/repositories?${params.toString()}`,
      );
      const data: GitHubInstallationRepositoriesResponse =
        await response.json();

      allRepos.push(...data.repositories);

      if (allRepos.length >= data.total_count) break;
      page++;
    }

    return allRepos;
  }

  /**
   * Get all repositories the user has granted access to via GitHub App installations.
   * Aggregates repos across all installations.
   */
  async getAccessibleRepositories(
    options?: { sort?: string },
  ): Promise<GitHubRepository[]> {
    const installations = await this.getUserInstallations();

    if (installations.length === 0) {
      return [];
    }

    const allRepos: GitHubRepository[] = [];

    for (const installation of installations) {
      const repos = await this.getInstallationRepositories(installation.id);
      allRepos.push(...repos);
    }

    if (options?.sort === "updated") {
      allRepos.sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );
    }

    return allRepos;
  }

  /**
   * Get repository contents (file or directory)
   */
  async getContents(
    owner: string,
    repo: string,
    path: string = "",
    options?: GetContentsOptions,
  ): Promise<ContentItem[] | FileContent> {
    const params = new URLSearchParams();
    if (options?.ref) params.append("ref", options.ref);

    const queryString = params.toString();
    const endpoint = `/repos/${owner}/${repo}/contents/${path}${queryString ? `?${queryString}` : ""}`;

    const cacheKey = `contents:${owner}/${repo}:${path}:${queryString}`;
    return this.getCached(cacheKey, this.CACHE_TTL.CONTENTS, async () => {
      const response = await this.request(endpoint);
      const data = await response.json();

      // If it's a file with base64 content, decode it
      if (!Array.isArray(data) && data.encoding === "base64" && data.content) {
        return {
          ...data,
          content: this.decodeBase64Content(data.content),
        };
      }

      return data;
    });
  }

  /**
   * Check if a file exists in the repository
   */
  async checkFileExists(
    owner: string,
    repo: string,
    path: string,
  ): Promise<boolean> {
    try {
      await this.request(`/repos/${owner}/${repo}/contents/${path}`);
      return true;
    } catch (error) {
      if (error instanceof GitHubAPIError && error.status === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get and parse package.json from a specific path
   */
  async getPackageJson(
    owner: string,
    repo: string,
    packagePath: string,
  ): Promise<PackageInfo | null> {
    try {
      const data = await this.getContents(
        owner,
        repo,
        `${packagePath}/package.json`,
      );

      if (!Array.isArray(data) && "content" in data) {
        const packageJson = JSON.parse(data.content);
        return {
          name: packageJson.name || packagePath.split("/").pop() || "unknown",
          path: packagePath,
          dependencies: packageJson.dependencies || {},
          devDependencies: packageJson.devDependencies || {},
        };
      }

      return null;
    } catch (error) {
      if (error instanceof GitHubAPIError && error.status === 404) {
        return null;
      }
      console.error(`Error fetching package.json from ${packagePath}:`, error);
      return null;
    }
  }

  /**
   * Get branches with pagination
   */
  async getBranches(
    owner: string,
    repo: string,
    options?: GetBranchesOptions,
  ): Promise<PaginatedResponse<GitHubBranch[]>> {
    const params = new URLSearchParams();
    const perPage = options?.perPage || 100;
    const page = options?.page || 1;

    params.append("per_page", perPage.toString());
    params.append("page", page.toString());

    const endpoint = `/repos/${owner}/${repo}/branches?${params.toString()}`;
    const cacheKey = `branches:${owner}/${repo}:${params.toString()}`;

    return this.getCached(cacheKey, this.CACHE_TTL.BRANCHES, async () => {
      const response = await this.request(endpoint);
      const branches = await response.json();
      const linkHeader = response.headers.get("Link");
      const { hasMore, totalPages } = this.parseLinkHeader(linkHeader);

      return {
        data: branches,
        hasMore,
        totalPages,
      };
    });
  }

  /**
   * Search branches by name pattern
   */
  async searchBranches(
    owner: string,
    repo: string,
    query: string,
  ): Promise<GitHubBranch[]> {
    const endpoint = `/repos/${owner}/${repo}/git/matching-refs/heads/${encodeURIComponent(query)}`;

    try {
      const response = await this.request(endpoint);
      const refs = await response.json();

      // Convert refs to branch format
      return refs.map((ref: any) => ({
        name: ref.ref.replace("refs/heads/", ""),
        commit: {
          sha: ref.object.sha,
          url: ref.object.url,
        },
        protected: false, // This endpoint doesn't provide protection status
      }));
    } catch (error) {
      // If search fails, return empty array
      if (error instanceof GitHubAPIError) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Get commits with pagination and filtering
   */
  async getCommits(
    owner: string,
    repo: string,
    options?: GetCommitsOptions,
  ): Promise<PaginatedResponse<GitHubCommit[]>> {
    const params = new URLSearchParams();
    const perPage = options?.perPage || 30;
    const page = options?.page || 1;

    params.append("per_page", perPage.toString());
    params.append("page", page.toString());

    if (options?.sha) params.append("sha", options.sha);
    if (options?.path) params.append("path", options.path);
    if (options?.since) params.append("since", options.since);
    if (options?.until) params.append("until", options.until);

    const endpoint = `/repos/${owner}/${repo}/commits?${params.toString()}`;
    const cacheKey = `commits:${owner}/${repo}:${params.toString()}`;

    return this.getCached(cacheKey, this.CACHE_TTL.COMMITS, async () => {
      const response = await this.request(endpoint);
      const commits = await response.json();
      const linkHeader = response.headers.get("Link");
      const { hasMore, totalPages } = this.parseLinkHeader(linkHeader);

      return {
        data: commits,
        hasMore,
        totalPages,
      };
    });
  }

  /**
   * Get specific commit details with file changes
   */
  async getCommit(
    owner: string,
    repo: string,
    sha: string,
  ): Promise<GitHubCommitDetail> {
    const cacheKey = `commit:${owner}/${repo}:${sha}`;
    return this.getCached(cacheKey, this.CACHE_TTL.COMMITS, async () => {
      const response = await this.request(
        `/repos/${owner}/${repo}/commits/${sha}`,
      );
      return await response.json();
    });
  }

  /**
   * Fetch a git tree (optionally recursive). `treeSha` may be a commit SHA,
   * branch name, or tag.
   */
  private async fetchTree(
    owner: string,
    repo: string,
    treeSha: string,
    recursive: boolean,
  ): Promise<GitHubTreeResponse> {
    const params = recursive ? "?recursive=1" : "";
    const response = await this.request(
      `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(treeSha)}${params}`,
    );
    return await response.json();
  }

  /**
   * Flatten a truncated recursive tree by walking directory SHAs.
   */
  private async flattenTruncatedTree(
    owner: string,
    repo: string,
    treeSha: string,
    prefix = "",
    depth = 0,
  ): Promise<GitHubTreeItem[]> {
    const MAX_DEPTH = 5;
    const listing = await this.fetchTree(owner, repo, treeSha, false);
    const prefixPath = (itemPath: string) =>
      prefix ? `${prefix}/${itemPath}` : itemPath;
    const items: GitHubTreeItem[] = [];

    for (const item of listing.tree) {
      const itemPath = prefixPath(item.path);
      if (item.type !== "tree") {
        items.push({ ...item, path: itemPath });
        continue;
      }

      if (depth >= MAX_DEPTH) {
        items.push({ ...item, path: itemPath });
        continue;
      }

      const subtree = await this.fetchTree(owner, repo, item.sha, true);
      if (!subtree.truncated) {
        items.push(
          ...subtree.tree.map((child) => ({
            ...child,
            path: `${itemPath}/${child.path}`,
          })),
        );
        continue;
      }

      items.push(
        ...(await this.flattenTruncatedTree(
          owner,
          repo,
          item.sha,
          itemPath,
          depth + 1,
        )),
      );
    }

    return items;
  }

  /**
   * Recursively list every path in the repository at `ref` (branch, tag, SHA,
   * or HEAD). Returns blobs/trees/commits — metadata only, not file contents.
   */
  async getRecursiveTree(
    owner: string,
    repo: string,
    ref: string = "HEAD",
  ): Promise<GitHubTreeItem[]> {
    const cacheKey = `tree:${owner}/${repo}:${ref}`;
    return this.getCached(cacheKey, this.CACHE_TTL.TREE, async () => {
      const tree = await this.fetchTree(owner, repo, ref, true);
      if (!tree.truncated) {
        return tree.tree;
      }
      return this.flattenTruncatedTree(owner, repo, ref);
    });
  }

  /**
   * Fetch blob text for many files by git SHA, batched over GraphQL.
   */
  async getBlobTexts(
    owner: string,
    repo: string,
    blobs: GitBlobRef[],
  ): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    if (blobs.length === 0) {
      return results;
    }

    const BATCH_SIZE = 50;

    for (let i = 0; i < blobs.length; i += BATCH_SIZE) {
      const batch = blobs.slice(i, i + BATCH_SIZE);
      const fieldSelections = batch
        .map(
          (_, index) => `
        f${index}: object(oid: $oid${index}) {
          ... on Blob { text }
        }`,
        )
        .join("\n");

      const variableDefs = batch
        .map((_, index) => `$oid${index}: GitObjectID!`)
        .join(", ");

      const query = `
        query($owner: String!, $name: String!, ${variableDefs}) {
          repository(owner: $owner, name: $name) {
            ${fieldSelections}
          }
        }
      `;

      const variables: Record<string, string> = {
        owner,
        name: repo,
      };
      batch.forEach((blob, index) => {
        variables[`oid${index}`] = blob.sha;
      });

      try {
        const response = await this.executeGraphQL<{
          repository: Record<string, { text?: string | null } | null>;
        }>(query, variables);

        if (response.errors?.length || !response.data?.repository) {
          throw new GitHubAPIError(
            response.errors?.[0]?.message || "GraphQL blob query returned no data",
          );
        }

        const repoData = response.data.repository;
        batch.forEach((blob, index) => {
          const text = repoData[`f${index}`]?.text;
          if (typeof text === "string") {
            results.set(blob.path, text);
          }
        });
      } catch (error) {
        console.warn("GraphQL blob batch failed, falling back to REST:", error);
        await Promise.all(
          batch.map(async (blob) => {
            try {
              const response = await this.request(
                `/repos/${owner}/${repo}/git/blobs/${blob.sha}`,
              );
              const data = (await response.json()) as {
                content?: string;
                encoding?: string;
              };
              if (data.encoding === "base64" && data.content) {
                results.set(blob.path, this.decodeBase64Content(data.content));
              }
            } catch (blobError) {
              console.error(`Error fetching blob ${blob.path}:`, blobError);
            }
          }),
        );
      }
    }

    return results;
  }

  /**
   * Execute GraphQL query
   */
  async executeGraphQL<T = any>(
    query: string,
    variables?: Record<string, any>,
  ): Promise<GraphQLResponse<T>> {
    const headers = await this.buildHeaders();

    const response = await fetch(`${this.baseUrl}/graphql`, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });

    // Track rate limits for GraphQL too
    this.trackRateLimit(response);

    if (!response.ok) {
      throw new GitHubAPIError(
        `GraphQL request failed: ${response.statusText}`,
        response.status,
      );
    }

    return await response.json();
  }

  /**
   * Batch check for a Turborepo config (turbo.json or turbo.jsonc) in multiple
   * repositories using GraphQL
   */
  async batchCheckTurboConfig(
    repositories: Array<{ owner: string; name: string }>,
  ): Promise<Map<string, boolean>> {
    const BATCH_SIZE = 50;
    const results = new Map<string, boolean>();

    for (let i = 0; i < repositories.length; i += BATCH_SIZE) {
      const batch = repositories.slice(i, i + BATCH_SIZE);

      const repoQueries = batch
        .map(
          (repo, index) => `
        repo${index}: repository(owner: "${repo.owner}", name: "${repo.name}") {
          turboJson: object(expression: "HEAD:turbo.json") {
            ... on Blob { id }
          }
          turboJsonc: object(expression: "HEAD:turbo.jsonc") {
            ... on Blob { id }
          }
        }
      `,
        )
        .join("\n");

      const query = `query { ${repoQueries} }`;

      try {
        const response = await this.executeGraphQL(query);

        batch.forEach((repo, index) => {
          const repoData = response.data?.[`repo${index}`];
          const key = `${repo.owner}/${repo.name}`;
          results.set(key, !!(repoData?.turboJson || repoData?.turboJsonc));
        });
      } catch (error) {
        console.warn("GraphQL batch check failed:", error);
        // Mark all in this batch as false on error
        batch.forEach((repo) => {
          results.set(`${repo.owner}/${repo.name}`, false);
        });
      }
    }

    return results;
  }

  /**
   * Clear the cache (useful for testing or forcing fresh data)
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Singleton instance for convenience
export const githubService = new GitHubService();

// Factory function for creating instances with specific tokens
export function createGitHubService(token?: string): GitHubService {
  return new GitHubService(token);
}
