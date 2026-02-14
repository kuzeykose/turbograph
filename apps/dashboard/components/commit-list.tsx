
import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { TurborepoStructure, DependencyEdge, getAffectedPackages, getDownstreamDependents } from '@/lib/utils/turborepo';
import { User, ChevronRight, ChevronLeft, Clock } from '@workspace/ui/icons';

export interface CommitFile {
    filename: string;
    status: 'added' | 'removed' | 'modified' | 'renamed';
    additions: number;
    deletions: number;
    changes: number;
}

export interface Commit {
    sha: string;
    commit: {
        author: {
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
}

interface CommitListProps {
    commits: Commit[];
    loading?: boolean;
    currentPage?: number;
    totalPages?: number;
    hasMore?: boolean;
    onPageChange?: (page: number) => void;
    turborepoStructure?: TurborepoStructure;
    dependencyGraph?: DependencyEdge[];
    onFetchCommitDetails?: (sha: string) => Promise<CommitFile[]>;
    onImpactChange?: (affectedPackages: string[], downstreamDependents: string[]) => void;
}

export function CommitList({
    commits,
    loading,
    currentPage = 1,
    totalPages = 1,
    hasMore = false,
    onPageChange,
    turborepoStructure,
    dependencyGraph,
    onFetchCommitDetails,
    onImpactChange
}: CommitListProps) {
    const [expandedCommits, setExpandedCommits] = useState<Set<string>>(new Set());
    const [commitFiles, setCommitFiles] = useState<Map<string, CommitFile[]>>(new Map());
    const [loadingCommits, setLoadingCommits] = useState<Set<string>>(new Set());

    const toggleCommit = async (sha: string) => {
        const newExpanded = new Set(expandedCommits);

        if (newExpanded.has(sha)) {
            newExpanded.delete(sha);
            setExpandedCommits(newExpanded);
            // Clear impact when collapsing
            if (onImpactChange) {
                onImpactChange([], []);
            }
        } else {
            newExpanded.add(sha);
            setExpandedCommits(newExpanded);

            // Fetch commit details if not already fetched
            if (!commitFiles.has(sha) && onFetchCommitDetails) {
                const newLoading = new Set(loadingCommits);
                newLoading.add(sha);
                setLoadingCommits(newLoading);

                try {
                    const files = await onFetchCommitDetails(sha);
                    setCommitFiles(new Map(commitFiles).set(sha, files));

                    // Calculate and notify parent of impact
                    if (turborepoStructure && dependencyGraph && onImpactChange) {
                        const changedFiles = files.map(f => f.filename);
                        const affectedPackages = getAffectedPackages(changedFiles, turborepoStructure);
                        const downstreamDependents = affectedPackages.length > 0
                            ? getDownstreamDependents(affectedPackages, dependencyGraph)
                            : [];
                        onImpactChange(affectedPackages, downstreamDependents);
                    }
                } catch (error) {
                    console.error('Error fetching commit details:', error);
                } finally {
                    const updatedLoading = new Set(loadingCommits);
                    updatedLoading.delete(sha);
                    setLoadingCommits(updatedLoading);
                }
            } else if (commitFiles.has(sha) && turborepoStructure && dependencyGraph && onImpactChange) {
                // Files already fetched, just recalculate impact
                const files = commitFiles.get(sha) || [];
                const changedFiles = files.map(f => f.filename);
                const affectedPackages = getAffectedPackages(changedFiles, turborepoStructure);
                const downstreamDependents = affectedPackages.length > 0
                    ? getDownstreamDependents(affectedPackages, dependencyGraph)
                    : [];
                onImpactChange(affectedPackages, downstreamDependents);
            }
        }
    };

    const getStatusDotColor = (status: string) => {
        switch (status) {
            case 'added':
                return 'bg-emerald-500';
            case 'removed':
                return 'bg-red-400';
            case 'modified':
                return 'bg-blue-400';
            case 'renamed':
                return 'bg-amber-400';
            default:
                return 'bg-zinc-400';
        }
    };

    if (loading) {
        return (
            <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3 px-4 py-3">
                            <div className="h-6 w-6 rounded-full bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
                            <div className="flex-1 space-y-1.5">
                                <div className="h-3.5 w-3/4 rounded bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
                                <div className="h-2.5 w-1/3 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (commits.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-400 dark:text-zinc-500">
                <Clock className="h-8 w-8 mb-3" />
                <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">No commits yet</p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">Commits will appear here once pushed</p>
            </div>
        );
    }

    const hasPrevious = currentPage > 1;
    const hasNext = hasMore || currentPage < totalPages;

    return (
        <div className="space-y-0">
            <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                    {commits.map((commit) => {
                        const isExpanded = expandedCommits.has(commit.sha);
                        const files = commitFiles.get(commit.sha) || [];
                        const isLoadingDetails = loadingCommits.has(commit.sha);

                        // Calculate impact if turborepo structure is available
                        let affectedPackages: string[] = [];
                        let downstreamDependents: string[] = [];

                        if (turborepoStructure && dependencyGraph && files.length > 0) {
                            const changedFiles = files.map(f => f.filename);
                            affectedPackages = getAffectedPackages(changedFiles, turborepoStructure);
                            if (affectedPackages.length > 0) {
                                downstreamDependents = getDownstreamDependents(affectedPackages, dependencyGraph);
                            }
                        }

                        return (
                            <div key={commit.sha}>
                                <button
                                    onClick={() => toggleCommit(commit.sha)}
                                    className="flex items-start gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors w-full text-left"
                                >
                                    <div className="flex-shrink-0 pt-0.5">
                                        {commit.author ? (
                                            <img
                                                src={commit.author.avatar_url}
                                                alt={commit.author.login}
                                                className="h-6 w-6 rounded-full"
                                            />
                                        ) : (
                                            <div className="h-6 w-6 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
                                                <User className="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                    <ChevronRight
                                                        className={`h-3.5 w-3.5 flex-shrink-0 text-zinc-400 dark:text-zinc-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                                    />
                                                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50 truncate">
                                                        {commit.commit.message.split('\n')[0]}
                                                    </span>
                                                </div>
                                            <div className="flex-shrink-0 flex items-center gap-2">
                                                <span className="hidden sm:inline font-mono text-[11px] text-zinc-400">
                                                    {commit.sha.substring(0, 7)}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="mt-0.5 flex items-center gap-1 text-xs text-zinc-400 dark:text-zinc-500">
                                            <span className="text-zinc-500 dark:text-zinc-400">
                                                {commit.commit.author.name}
                                            </span>
                                            <span>&middot;</span>
                                            <span>{formatDistanceToNow(new Date(commit.commit.author.date), { addSuffix: true })}</span>
                                        </div>
                                    </div>
                                </button>

                                {/* Expanded Details */}
                                {isExpanded && (
                                    <div className="px-4 pb-4 border-t border-zinc-100 dark:border-zinc-800/50">
                                        {isLoadingDetails ? (
                                            <div className="space-y-2 pt-4">
                                                {Array.from({ length: 3 }).map((_, i) => (
                                                    <div key={i} className="flex items-center gap-2 px-2 py-1.5">
                                                        <div className="h-1.5 w-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
                                                        <div className="h-3 w-2/3 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
                                                        <div className="ml-auto h-3 w-12 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="space-y-4 pt-4">
                                                {/* Changed Files */}
                                                <div>
                                                    <h4 className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">
                                                        Changed Files ({files.length})
                                                    </h4>
                                                    <div className="space-y-0 max-h-60 overflow-y-auto">
                                                        {files.map((file, index) => (
                                                            <div
                                                                key={index}
                                                                className="flex items-center justify-between gap-2 rounded px-2 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                                                            >
                                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                                    <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${getStatusDotColor(file.status)}`} />
                                                                    <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400 truncate">
                                                                        {file.filename}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-1.5 text-[11px] font-mono">
                                                                    {file.additions > 0 && (
                                                                        <span className="text-green-600 dark:text-green-400">+{file.additions}</span>
                                                                    )}
                                                                    {file.deletions > 0 && (
                                                                        <span className="text-red-600 dark:text-red-400">-{file.deletions}</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Impact Analysis (only for turborepos) */}
                                                {turborepoStructure?.isTurborepo && (
                                                    <>
                                                        {affectedPackages.length > 0 && (
                                                            <div>
                                                                <h4 className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">
                                                                    Affected Packages ({affectedPackages.length})
                                                                </h4>
                                                                <div className="flex flex-wrap gap-1.5">
                                                                    {affectedPackages.map((pkg) => (
                                                                        <span
                                                                            key={pkg}
                                                                            className="px-1.5 py-0.5 text-[10px] rounded bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400 font-medium"
                                                                        >
                                                                            {pkg}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {downstreamDependents.length > 0 && (
                                                            <div>
                                                                <h4 className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">
                                                                    Downstream Impact ({downstreamDependents.length})
                                                                </h4>
                                                                <div className="flex flex-wrap gap-1.5">
                                                                    {downstreamDependents.map((pkg) => (
                                                                        <span
                                                                            key={pkg}
                                                                            className="px-1.5 py-0.5 text-[10px] rounded bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 font-medium"
                                                                        >
                                                                            {pkg}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {affectedPackages.length === 0 && files.length > 0 && (
                                                            <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                                                                No package impact detected
                                                            </p>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Pagination Controls */}
            {onPageChange && (hasPrevious || hasNext) && (
                <div className="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800/50 px-4 py-2">
                    <button
                        onClick={() => onPageChange(currentPage - 1)}
                        disabled={!hasPrevious}
                        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        Previous
                    </button>

                    <span className="text-xs text-zinc-400 dark:text-zinc-500">
                        {currentPage} / {totalPages}
                    </span>

                    <button
                        onClick={() => onPageChange(currentPage + 1)}
                        disabled={!hasNext}
                        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    >
                        Next
                        <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                </div>
            )}
        </div>
    );
}
