import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";
import { Folder, Clock, BarChart3 } from "@workspace/ui/icons";

interface RepositoryTabBarProps {
  dependencyCount: number;
}

export function RepositoryTabBar({ dependencyCount }: RepositoryTabBarProps) {
  return (
    <TabsList>
      <TabsTrigger value="files">
        <Folder className="h-4 w-4" />
        Files
      </TabsTrigger>
      <TabsTrigger value="commits">
        <Clock className="h-4 w-4" />
        Commits
      </TabsTrigger>
      <TabsTrigger value="turborepo">
        <BarChart3 className="h-4 w-4" />
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
