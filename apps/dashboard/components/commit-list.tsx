
import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { TurborepoStructure, DependencyEdge, getAffectedPackages, getDownstreamDependents } from '@/lib/utils/turborepo';

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

    const getStatusBadgeColor = (status: string) => {
        switch (status) {
            case 'added':
                return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
            case 'removed':
                return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
            case 'modified':
                return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
            case 'renamed':
                return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
            default:
                return 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200';
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center p-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-solid border-current border-r-transparent text-zinc-900 dark:text-zinc-50" />
            </div>
        );
    }

    if (commits.length === 0) {
        return (
            <div className="text-center p-8 text-zinc-500">
                No commits found.
            </div>
        );
    }

    const hasPrevious = currentPage > 1;
    const hasNext = hasMore || currentPage < totalPages;

    return (
        <div className="space-y-4">
            <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
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
                                    className="flex items-start gap-4 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors w-full text-left"
                                >
                                    <div className="flex-shrink-0 pt-1">
                                        {commit.author ? (
                                            <img
                                                src={commit.author.avatar_url}
                                                alt={commit.author.login}
                                                className="h-8 w-8 rounded-full border border-zinc-200 dark:border-zinc-700"
                                            />
                                        ) : (
                                            <div className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
                                                <svg className="h-4 w-4 text-zinc-500 dark:text-zinc-400" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                <svg
                                                    className={`h-4 w-4 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                </svg>
                                                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 hover:underline hover:text-blue-600 dark:hover:text-blue-400 truncate">
                                                    {commit.commit.message.split('\n')[0]}
                                                </span>
                                            </div>
                                            <div className="flex-shrink-0 flex items-center gap-2">
                                                <span className="hidden sm:inline-block px-2 py-0.5 text-xs font-mono bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                                                    {commit.sha.substring(0, 7)}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                                            <span className="font-medium text-zinc-700 dark:text-zinc-300">
                                                {commit.commit.author.name}
                                            </span>
                                            <span>committed {formatDistanceToNow(new Date(commit.commit.author.date), { addSuffix: true })}</span>
                                        </div>
                                    </div>
                                </button>

                                {/* Expanded Details */}
                                {isExpanded && (
                                    <div className="px-4 pb-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                                        {isLoadingDetails ? (
                                            <div className="flex justify-center py-8">
                                                <div className="h-5 w-5 animate-spin rounded-full border-2 border-solid border-current border-r-transparent text-zinc-900 dark:text-zinc-50" />
                                            </div>
                                        ) : (
                                            <div className="space-y-4 pt-4">
                                                {/* Changed Files */}
                                                <div>
                                                    <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
                                                        Changed Files ({files.length})
                                                    </h4>
                                                    <div className="space-y-1 max-h-60 overflow-y-auto">
                                                        {files.map((file, index) => (
                                                            <div
                                                                key={index}
                                                                className="flex items-center justify-between gap-2 text-xs bg-white dark:bg-zinc-900 rounded px-2 py-1.5 border border-zinc-200 dark:border-zinc-800"
                                                            >
                                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getStatusBadgeColor(file.status)}`}>
                                                                        {file.status[0].toUpperCase()}
                                                                    </span>
                                                                    <span className="font-mono text-zinc-700 dark:text-zinc-300 truncate">
                                                                        {file.filename}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
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
                                                                <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
                                                                    Affected Packages ({affectedPackages.length})
                                                                </h4>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {affectedPackages.map((pkg) => (
                                                                        <span
                                                                            key={pkg}
                                                                            className="px-2 py-1 text-xs rounded-md bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 font-medium"
                                                                        >
                                                                            {pkg}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {downstreamDependents.length > 0 && (
                                                            <div>
                                                                <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
                                                                    Downstream Impact ({downstreamDependents.length})
                                                                </h4>
                                                                <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-2">
                                                                    Packages that depend on the affected packages and should be tested/rebuilt:
                                                                </p>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {downstreamDependents.map((pkg) => (
                                                                        <span
                                                                            key={pkg}
                                                                            className="px-2 py-1 text-xs rounded-md bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 font-medium"
                                                                        >
                                                                            {pkg}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {affectedPackages.length === 0 && files.length > 0 && (
                                                            <div className="text-xs text-zinc-500 dark:text-zinc-400 italic">
                                                                No package impact detected (changes outside of apps/packages folders)
                                                            </div>
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
                <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => onPageChange(currentPage - 1)}
                            disabled={!hasPrevious}
                            className="inline-flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Previous
                        </button>
                    </div>

                    <div className="text-sm text-zinc-700 dark:text-zinc-300">
                        Page <span className="font-medium">{currentPage}</span>
                        {totalPages > 1 && <span> of <span className="font-medium">{totalPages}</span></span>}
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => onPageChange(currentPage + 1)}
                            disabled={!hasNext}
                            className="inline-flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        >
                            Next
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
