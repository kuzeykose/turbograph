export function githubAppInstallUrl(): string {
  return `https://github.com/apps/${process.env.NEXT_PUBLIC_GITHUB_APP_SLUG}/installations/new`;
}
