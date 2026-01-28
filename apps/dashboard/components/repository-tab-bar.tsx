import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";

interface RepositoryTabBarProps {
  dependencyCount: number;
}

export function RepositoryTabBar({ dependencyCount }: RepositoryTabBarProps) {
  return (
    <TabsList variant="line">
      <TabsTrigger value="files">
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
          />
        </svg>
        Files
      </TabsTrigger>
      <TabsTrigger value="commits">
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        Commits
      </TabsTrigger>
      <TabsTrigger value="turborepo">
        <svg
          className="h-4 w-4"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
        </svg>
        Dependencies
        {dependencyCount > 0 && (
          <span className="ml-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            {dependencyCount}
          </span>
        )}
      </TabsTrigger>
    </TabsList>
  );
}
