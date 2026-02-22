import { useAuth } from "@/contexts/auth-context";
import { useRepositoryContext } from "@/contexts/repository-context";
import Link from "next/link";
import { getLanguageColor } from "@/lib/utils/language-colors";
import { ArrowLeft } from "@workspace/ui/icons";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb";
import { BranchSelector } from "./branch-selector";
import { UserMenu } from "./user-menu";

export function RepositoryHeader() {
  const { user } = useAuth();
  const { repository, turborepoStructure, branch: currentBranch } = useRepositoryContext();
  const languageColor = repository?.language
    ? getLanguageColor(repository.language) || "#888"
    : "#888";

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
      {/* Left: Breadcrumb navigation */}
      <div className="flex items-center gap-4 min-w-0">
        <Link
          href={user ? "/dashboard" : "/"}
          className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>


        {repository && (
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>
                  {repository.owner.login}
                </BreadcrumbPage>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>
                  {repository.name}
                </BreadcrumbPage>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>
                  <BranchSelector
                    owner={repository.owner.login}
                    repo={repository.name}
                    defaultBranch={repository.default_branch}
                    currentBranch={currentBranch}
                  />
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        )}
      </div>

      {/* Right: Stats + Avatar */}
      <div className="flex items-center gap-3">
        {repository && (
          <>
            {repository.language && (
              <span className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: languageColor }}
                />
                {repository.language}
              </span>
            )}
            {turborepoStructure?.isTurborepo && (
              <span className="px-2 py-1 text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/30 rounded-md border border-purple-200 dark:border-purple-800">
                Turborepo
              </span>
            )}
          </>
        )}
        <UserMenu />
      </div>
    </div>
  );
}
