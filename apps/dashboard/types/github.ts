import { Repository } from "./repository";

// Extended repository type with additional GitHub fields
export interface GitHubRepository extends Repository {
  permissions?: {
    admin: boolean;
    push: boolean;
    pull: boolean;
  };
  license?: {
    name: string;
    spdx_id: string;
  } | null;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  private: boolean;
  fork: boolean;
}

// Branch types
export interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
}

// Commit types
export interface GitHubCommit {
  sha: string;
  commit: {
    author: {
      name: string;
      email: string;
      date: string;
    };
    committer: {
      name: string;
      email: string;
      date: string;
    };
    message: string;
  };
  html_url: string;
  author: {
    login: string;
    avatar_url: string;
    html_url: string;
  } | null;
  committer: {
    login: string;
    avatar_url: string;
    html_url: string;
  } | null;
  parents: Array<{
    sha: string;
    url: string;
  }>;
}

export interface GitHubCommitFile {
  filename: string;
  status: "added" | "removed" | "modified" | "renamed";
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  previous_filename?: string;
  blob_url?: string;
  raw_url?: string;
}

export interface GitHubCommitDetail extends GitHubCommit {
  files?: GitHubCommitFile[];
  stats: {
    additions: number;
    deletions: number;
    total: number;
  };
}

// GitHub App installation types
export interface GitHubInstallation {
  id: number;
  app_id: number;
  app_slug: string;
  target_type: "User" | "Organization";
  account: {
    login: string;
    avatar_url: string;
    id: number;
    type: string;
  };
  repository_selection: "all" | "selected";
  permissions: Record<string, string>;
}

export interface GitHubInstallationRepositoriesResponse {
  total_count: number;
  repositories: GitHubRepository[];
}

// Request option types
export interface GitHubTreeItem {
  path: string;
  mode: string;
  type: "blob" | "tree" | "commit";
  sha: string;
  size?: number;
  url: string;
}

export interface GitHubTreeResponse {
  sha: string;
  url: string;
  tree: GitHubTreeItem[];
  truncated: boolean;
}

export interface GitBlobRef {
  path: string;
  sha: string;
}

export interface GetContentsOptions {
  ref?: string; // Branch name or commit SHA
}

export interface GetBranchesOptions {
  page?: number;
  perPage?: number; // Default: 100, Max: 100
}

export interface GetCommitsOptions {
  sha?: string; // Branch name or commit SHA
  path?: string; // Only commits affecting this path
  page?: number;
  perPage?: number; // Default: 30
  since?: string; // ISO 8601 date
  until?: string; // ISO 8601 date
}

export interface GetUserRepositoriesOptions {
  sort?: "created" | "updated" | "pushed" | "full_name";
  direction?: "asc" | "desc";
  perPage?: number;
  page?: number;
  type?: "all" | "owner" | "public" | "private" | "member";
}

// Error types
export interface GitHubError {
  message: string;
  documentation_url?: string;
  status?: number;
}

export interface GitHubRateLimit {
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp
  used: number;
  resource: string;
}

// GraphQL types
export interface GraphQLResponse<T = any> {
  data?: T;
  errors?: Array<{
    message: string;
    path?: string[];
    locations?: Array<{
      line: number;
      column: number;
    }>;
  }>;
}

// Custom error classes
export class GitHubAPIError extends Error {
  constructor(
    message: string,
    public status?: number,
    public response?: GitHubError,
  ) {
    super(message);
    this.name = "GitHubAPIError";
    Object.setPrototypeOf(this, GitHubAPIError.prototype);
  }
}

export class GitHubRateLimitError extends GitHubAPIError {
  constructor(
    public resetAt: Date,
    public limit: number,
    public remaining: number,
  ) {
    super("GitHub API rate limit exceeded", 403);
    this.name = "GitHubRateLimitError";
    Object.setPrototypeOf(this, GitHubRateLimitError.prototype);
  }
}

// Pagination response types
export interface PaginatedResponse<T> {
  data: T;
  hasMore: boolean;
  totalPages?: number;
}
