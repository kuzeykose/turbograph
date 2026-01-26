export interface Repository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  default_branch: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  owner: {
    login: string;
    avatar_url: string;
  };
}

export interface ContentItem {
  name: string;
  path: string;
  type: "file" | "dir";
  size?: number;
  sha: string;
  url: string;
  html_url: string;
  download_url?: string | null;
}

export interface FileContent {
  name: string;
  path: string;
  content: string;
  encoding: string;
  size: number;
  sha: string;
  type: string;
}
