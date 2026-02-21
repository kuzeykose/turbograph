"use client";

import { useState } from "react";
import { useRepositoryContext } from "@/contexts/repository-context";
import { Folder, Clock, BarChart3, List, Menu } from "@workspace/ui/icons";
import { Button } from "@workspace/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/sheet";
import { cn } from "@workspace/ui/lib/utils";

type TabValue = "files" | "commits" | "turborepo" | "packages";

interface NavItem {
  value: TabValue;
  label: string;
  icon: React.ReactNode;
  badge?: number;
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
          {item.badge !== undefined && item.badge > 0 && (
            <span className="ml-auto rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800 dark:bg-blue-900 dark:text-blue-200">
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
          className={cn(
            "h-8 rounded-sm p-2 transition-colors relative",
            activeTab === item.value
              ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
              : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-50",
          )}
        >
          <span className="flex-shrink-0">{item.icon}</span>
          {item.badge !== undefined && item.badge > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] font-medium text-white">
              {item.badge > 99 ? "99+" : item.badge}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}

export function RepositorySidebar() {
  const { turborepoStructure, dependencyGraph, activeTab, setActiveTab } =
    useRepositoryContext();
  const [sheetOpen, setSheetOpen] = useState(false);

  const isTurborepo = turborepoStructure?.isTurborepo ?? false;

  const navItems: NavItem[] = [
    {
      value: "files",
      label: "Files",
      icon: <Folder className="h-4 w-4" />,
    },
    ...(isTurborepo
      ? [
          {
            value: "commits" as const,
            label: "Commits",
            icon: <Clock className="h-4 w-4" />,
          },
          {
            value: "turborepo" as const,
            label: "Dependencies",
            icon: <BarChart3 className="h-4 w-4" />,
            badge: dependencyGraph.length,
          },
          {
            value: "packages" as const,
            label: "Packages",
            icon: <List className="h-4 w-4" />,
          },
        ]
      : []),
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
            <SidebarNavExpanded
              items={navItems}
              activeTab={activeTab}
              onTabChange={handleTabChange}
            />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop: Collapsible sidebar with hover expand */}
      <div className="hidden lg:block group relative h-full">
        {/* Collapsed sidebar - visible by default */}
        <aside className="w-[48px] flex-shrink-0 flex flex-col border-r border-zinc-200 dark:border-zinc-800 h-full group-hover:opacity-0 transition-opacity duration-200">
          <SidebarNavCollapsed
            items={navItems}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </aside>

        {/* Expanded sidebar - shows on hover */}
        <aside className="absolute left-0 top-0 w-48 flex flex-col border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black h-full shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-200 z-10">
          <SidebarNavExpanded
            items={navItems}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </aside>
      </div>
    </>
  );
}
