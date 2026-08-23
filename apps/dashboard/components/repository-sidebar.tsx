"use client";

import { useState } from "react";
import { useRepositoryContext } from "@/contexts/repository-context";
import { type RepositoryTab } from "@/lib/repository-tabs";
import { AI_ANALYSIS_ENABLED } from "@/lib/feature-flags";
import { Clock, BarChart3, List, Menu, Sparkles, Waypoints, Folder } from "@workspace/ui/icons";
import { Button } from "@workspace/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/sheet";
import { cn } from "@workspace/ui/lib/utils";

type TabValue = RepositoryTab;

interface NavItem {
  value: TabValue;
  label: string;
  icon: React.ReactNode;
  /** Short qualifier shown beside the label, e.g. "Beta". */
  badge?: string;
}

function SidebarNavExpanded({
  items,
  activeTab,
  onTabChange,
}: {
  items: NavItem[];
  activeTab: TabValue;
  onTabChange: (tab: TabValue) => void;
}) {
  return (
    <nav className="flex flex-col gap-2 p-2">
      {items.map((item) => (
        <button
          key={item.value}
          onClick={() => onTabChange(item.value)}
          className={cn(
            "h-8 flex items-center gap-3 rounded-sm p-2 text-sm transition-colors whitespace-nowrap",
            activeTab === item.value
              ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
              : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-50",
          )}
        >
          <span className="flex-shrink-0">{item.icon}</span>
          {item.label}
          {item.badge && (
            <span className="ml-auto rounded-full border border-violet-500/20 bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium leading-none uppercase tracking-wide text-violet-600 dark:text-violet-400">
              {item.badge}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}

function SidebarNavCollapsed({
  items,
  activeTab,
  onTabChange,
}: {
  items: NavItem[];
  activeTab: TabValue;
  onTabChange: (tab: TabValue) => void;
}) {
  return (
    <nav className="flex flex-col gap-2 p-2">
      {items.map((item) => (
        <button
          key={item.value}
          onClick={() => onTabChange(item.value)}
          title={item.badge ? `${item.label} (${item.badge})` : item.label}
          aria-label={
            item.badge ? `${item.label} (${item.badge})` : item.label
          }
          className={cn(
            "relative h-8 rounded-sm p-2 transition-colors",
            activeTab === item.value
              ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
              : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-50",
          )}
        >
          <span className="flex-shrink-0">{item.icon}</span>
          {item.badge && (
            <span
              aria-hidden="true"
              className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-violet-500"
            />
          )}
        </button>
      ))}
    </nav>
  );
}

function SidebarSkeletonCollapsed() {
  return (
    <nav className="flex flex-col gap-2 p-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="h-8 w-8 rounded-sm bg-zinc-200 dark:bg-zinc-700 animate-pulse"
        />
      ))}
    </nav>
  );
}

function SidebarSkeletonExpanded() {
  const widths = ["w-20", "w-16", "w-14"];
  return (
    <nav className="flex flex-col gap-2 p-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-8 flex items-center gap-3 rounded-sm p-2">
          <div className="h-4 w-4 rounded bg-zinc-200 dark:bg-zinc-700 animate-pulse flex-shrink-0" />
          <div
            className={`h-3.5 ${widths[i]} rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse`}
          />
        </div>
      ))}
    </nav>
  );
}

export function RepositorySidebar() {
  const { turborepoStructure, turborepoLoading, activeTab, setActiveTab } =
    useRepositoryContext();
  const [sheetOpen, setSheetOpen] = useState(false);

  /**
   * Every tab is offered the same way, signed in or not. The tabs that need a
   * session say so themselves once opened, so the nav stays free of locks.
   */
  const isInitialLoading = turborepoLoading && turborepoStructure === null;
  const isTurborepo = turborepoStructure?.isTurborepo ?? false;

  const navItems: NavItem[] = [
    ...(isTurborepo
      ? [
        {
          value: "turborepo" as const,
          label: "Dependencies",
          icon: <BarChart3 className="h-4 w-4" />,
        },
        {
          value: "imports" as const,
          label: "Imports",
          icon: <Waypoints className="h-4 w-4" />,
          badge: "Beta",
        },
        {
          value: "commits" as const,
          label: "Commits",
          icon: <Clock className="h-4 w-4" />,
        },
        {
          value: "packages" as const,
          label: "Packages",
          icon: <List className="h-4 w-4" />,
        },
        ...(AI_ANALYSIS_ENABLED
          ? [
            {
              value: "analysis" as const,
              label: "AI Analysis",
              icon: <Sparkles className="h-4 w-4" />,
            },
          ]
          : []),
      ]
      : []),
    {
      value: "files",
      label: "Files",
      icon: <Folder className="h-4 w-4" />,
    },
  ];

  const handleTabChange = (tab: TabValue) => {
    setActiveTab(tab);
    setSheetOpen(false);
  };

  return (
    <>
      {/* Mobile: Sheet trigger button */}
      <div className="lg:hidden fixed bottom-4 left-4 z-40">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button size="icon" variant="outline" className="shadow-lg">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open navigation</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SheetHeader className="border-b border-zinc-200 dark:border-zinc-800">
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            {isInitialLoading ? (
              <SidebarSkeletonExpanded />
            ) : (
              <SidebarNavExpanded
                items={navItems}
                activeTab={activeTab}
                onTabChange={handleTabChange}
              />
            )}
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop: Collapsible sidebar with hover expand */}
      <div className="hidden lg:block group relative h-full">
        {/* Collapsed sidebar - visible by default */}
        <aside className="w-[48px] flex-shrink-0 flex flex-col border-r border-zinc-200 dark:border-zinc-800 h-full group-hover:opacity-0 transition-opacity duration-200">
          {isInitialLoading ? (
            <SidebarSkeletonCollapsed />
          ) : (
            <SidebarNavCollapsed
              items={navItems}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
          )}
        </aside>

        {/* Expanded sidebar - shows on hover */}
        <aside className="absolute left-0 top-0 w-48 flex flex-col border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black h-full shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-200 z-10">
          {isInitialLoading ? (
            <SidebarSkeletonExpanded />
          ) : (
            <SidebarNavExpanded
              items={navItems}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
          )}
        </aside>
      </div>
    </>
  );
}
