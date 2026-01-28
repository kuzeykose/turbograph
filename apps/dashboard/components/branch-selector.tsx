"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { githubService } from "@/lib/services/github";
import { GitBranch, ChevronDown, Search, Loader2, Check } from "@workspace/ui/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { Input } from "@workspace/ui/components/input";

interface Branch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
}

interface BranchSelectorProps {
  owner: string;
  repo: string;
  defaultBranch?: string;
  currentBranch?: string;
}

export function BranchSelector({
  owner,
  repo,
  defaultBranch,
  currentBranch,
}: BranchSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [filteredBranches, setFilteredBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searching, setSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>(null);

  const activeBranch = currentBranch || defaultBranch || "main";

  const fetchBranches = useCallback(async (pageNum: number = 1, search: string = "") => {
    if (!owner || !repo) return;

    try {
      if (pageNum === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const response = await githubService.getBranches(owner, repo, {
        page: pageNum,
        perPage: 100,
      });

      if (pageNum === 1) {
        setBranches(response.data);
      } else {
        setBranches(prev => [...prev, ...response.data]);
      }

      setHasMore(response.hasMore);
    } catch (err) {
      console.error("Error fetching branches:", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [owner, repo]);

  const searchBranches = useCallback(async (query: string) => {
    if (!owner || !repo || !query.trim()) return;

    try {
      setSearching(true);
      const searchResults = await githubService.searchBranches(owner, repo, query);
      setFilteredBranches(searchResults);
    } catch (err) {
      console.error("Error searching branches:", err);
      // Fall back to client-side filtering
      const queryLower = searchQuery.toLowerCase();
      const filtered = branches.filter(branch =>
        branch.name.toLowerCase().includes(queryLower)
      );
      setFilteredBranches(filtered);
    } finally {
      setSearching(false);
    }
  }, [owner, repo, branches, searchQuery]);

  useEffect(() => {
    fetchBranches(1);
  }, [fetchBranches]);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredBranches(branches);
      return;
    }

    // Debounce search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchBranches(searchQuery);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, branches, searchBranches]);

  const handleBranchChange = (branchName: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (branchName === defaultBranch) {
      params.delete("branch");
    } else {
      params.set("branch", branchName);
    }

    const newUrl = params.toString()
      ? `?${params.toString()}`
      : window.location.pathname;

    router.push(newUrl);
    setIsOpen(false);
    setSearchQuery("");
  };

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const scrollPercentage = (target.scrollTop + target.clientHeight) / target.scrollHeight;

    if (scrollPercentage > 0.8 && hasMore && !loadingMore && searchQuery === "") {
      setPage(prev => prev + 1);
      fetchBranches(page + 1);
    }
  }, [hasMore, loadingMore, searchQuery, page, fetchBranches]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setSearchQuery("");
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-zinc-500">
        <GitBranch className="w-3.5 h-3.5" />
        <span>Loading...</span>
      </div>
    );
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors">
        <GitBranch className="w-3.5 h-3.5" />
        <span className="max-w-[120px] truncate">{activeBranch}</span>
        <ChevronDown className="w-3 h-3 opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80 p-0">
        <div className="sticky top-0 bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 p-2">
          <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2">
            <span className="flex-1">Switch branches</span>
            {!searching && branches.length > 0 && (
              <span className="text-zinc-400 dark:text-zinc-500">
                {searchQuery ? `${filteredBranches.length} found` : `${branches.length}${hasMore ? "+" : ""}`}
              </span>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
            {searching && (
              <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 animate-spin" />
            )}
            <Input
              type="text"
              placeholder="Search for a branch..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="pl-8 h-8 text-sm pr-8"
              autoFocus
            />
          </div>
        </div>
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="max-h-80 overflow-y-auto p-1"
        >
          {filteredBranches.length === 0 && !loading && !searching ? (
            <div className="px-2 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
              {searchQuery ? "No branches found" : "No branches available"}
            </div>
          ) : searching && filteredBranches.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-zinc-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="ml-2 text-sm">Searching...</span>
            </div>
          ) : (
            <>
              {filteredBranches.map((branch) => (
                <DropdownMenuItem
                  key={branch.name}
                  onClick={() => handleBranchChange(branch.name)}
                  className={`flex items-center gap-2 text-sm ${branch.name === activeBranch
                    ? "bg-zinc-100 dark:bg-zinc-800"
                    : ""
                    }`}
                >
                  <GitBranch className="w-3.5 h-3.5" />
                  <span className="flex-1 truncate">{branch.name}</span>
                  {branch.name === defaultBranch && (
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      default
                    </span>
                  )}
                  {branch.name === activeBranch && (
                    <Check className="w-4 h-4 text-green-600 dark:text-green-500" />
                  )}
                </DropdownMenuItem>
              ))}
              {loadingMore && (
                <div className="flex items-center justify-center py-4 text-zinc-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="ml-2 text-sm">Loading more...</span>
                </div>
              )}
            </>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
