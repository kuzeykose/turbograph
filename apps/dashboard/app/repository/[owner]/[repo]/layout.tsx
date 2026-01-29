"use client";

import { RepositoryProvider } from "@/contexts/repository-context";
import { RepositoryHeader } from "@/components/repository-header";

export default function RepositoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RepositoryProvider>
      <div className="h-screen flex flex-col bg-zinc-50 dark:bg-black overflow-hidden">
        <RepositoryHeader />
        <div className="flex flex-1 overflow-hidden">{children}</div>
      </div>
    </RepositoryProvider>
  );
}
