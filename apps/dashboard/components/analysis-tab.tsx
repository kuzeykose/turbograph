"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Markdown from "react-markdown";
import { useAuth } from "@/contexts/auth-context";
import { useAnalysis, useFixPlan } from "@/hooks/use-analysis";
import type { TurborepoStructure, DependencyEdge } from "@/lib/utils/turborepo";
import { githubService } from "@/lib/services/github";
import {
  Sparkles,
  AlertCircle,
  Loader2,
  LogIn,
  Wrench,
  Copy,
  Check,
  X,
  Pencil,
  Eye,
} from "@workspace/ui/icons";

const proseClasses =
  "prose prose-zinc dark:prose-invert prose-headings:font-semibold prose-h2:text-base prose-h2:mt-8 prose-h2:mb-3 prose-h3:text-sm prose-h3:mt-5 prose-h3:mb-2 prose-p:text-sm prose-p:leading-relaxed prose-li:text-sm prose-li:leading-relaxed prose-code:text-xs prose-code:before:content-none prose-code:after:content-none prose-pre:text-xs prose-pre:bg-zinc-100 prose-pre:dark:bg-zinc-800 prose-strong:font-semibold max-w-none";

interface AnalysisTabProps {
  turborepoStructure: TurborepoStructure;
  dependencyGraph: DependencyEdge[];
  owner: string;
  repo: string;
}

export function AnalysisTab({
  turborepoStructure,
  dependencyGraph,
  owner,
  repo,
}: AnalysisTabProps) {
  const { user } = useAuth();
  const { analysis, isStreaming, error, runAnalysis } = useAnalysis();
  const { fixPlan, isFixStreaming, fixError, runFixPlan, resetFix } = useFixPlan();
  const analysisRef = useRef<HTMLDivElement>(null);
  const fixRef = useRef<HTMLDivElement>(null);

  const [showFixPane, setShowFixPane] = useState(false);
  const [copied, setCopied] = useState(false);
  const [turboJsonCache, setTurboJsonCache] = useState<string | undefined>();
  const [isEditing, setIsEditing] = useState(false);
  const [editedFixPlan, setEditedFixPlan] = useState("");

  useEffect(() => {
    if (isStreaming && analysisRef.current) {
      analysisRef.current.scrollTop = analysisRef.current.scrollHeight;
    }
  }, [analysis, isStreaming]);

  useEffect(() => {
    if (isFixStreaming && fixRef.current) {
      fixRef.current.scrollTop = fixRef.current.scrollHeight;
    }
  }, [fixPlan, isFixStreaming]);

  useEffect(() => {
    if (isFixStreaming) {
      setIsEditing(false);
      setEditedFixPlan(fixPlan);
    }
  }, [fixPlan, isFixStreaming]);

  useEffect(() => {
    if (!isFixStreaming && fixPlan) {
      setEditedFixPlan(fixPlan);
    }
  }, [isFixStreaming, fixPlan]);

  if (!user) {
    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center py-20">
        <div className="flex flex-col items-center text-center max-w-md">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-50 dark:bg-violet-950/40">
            <Sparkles className="h-6 w-6 text-violet-600 dark:text-violet-400" />
          </div>
          <h3 className="mt-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Sign in to use AI Analysis
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            AI-powered feedback on your monorepo&apos;s dependency health, architecture,
            and Turborepo best practices is available for signed-in users.
          </p>
          <Link
            href="/login"
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-600"
          >
            <LogIn className="h-3.5 w-3.5" />
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  const handleAnalyze = useCallback(async () => {
    setShowFixPane(false);
    resetFix();

    const turboConfigFile = turborepoStructure.turboConfigFile;
    let turboJsonContent: string | undefined;

    if (turboConfigFile) {
      try {
        const data = await githubService.getContents(
          owner,
          repo,
          turboConfigFile,
        );
        if (!Array.isArray(data) && "content" in data) {
          turboJsonContent = data.content;
        }
      } catch {
        // turbo config fetch is best-effort
      }
    }

    setTurboJsonCache(turboJsonContent);

    runAnalysis({
      apps: turborepoStructure.apps,
      packages: turborepoStructure.packages,
      edges: dependencyGraph,
      turboJsonContent,
      turboConfigFile,
    });
  }, [turborepoStructure, dependencyGraph, owner, repo, runAnalysis, resetFix]);

  const handleFixSuggestions = useCallback(() => {
    setShowFixPane(true);
    setCopied(false);
    setIsEditing(false);
    setEditedFixPlan("");

    runFixPlan({
      analysisOutput: analysis,
      apps: turborepoStructure.apps,
      packages: turborepoStructure.packages,
      edges: dependencyGraph,
      turboJsonContent: turboJsonCache,
      turboConfigFile: turborepoStructure.turboConfigFile,
    });
  }, [analysis, turborepoStructure, dependencyGraph, turboJsonCache, runFixPlan]);

  const handleCloseFixPane = useCallback(() => {
    setShowFixPane(false);
    setIsEditing(false);
    resetFix();
  }, [resetFix]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(editedFixPlan);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [editedFixPlan]);

  const hasResult = analysis.length > 0 || error;

  if (!hasResult && !isStreaming) {
    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center py-20">
        <div className="flex flex-col items-center text-center max-w-md">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-50 dark:bg-violet-950/40">
            <Sparkles className="h-6 w-6 text-violet-600 dark:text-violet-400" />
          </div>
          <h3 className="mt-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            AI Analysis
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            Get feedback on your monorepo&apos;s dependency health, architecture,
            and Turborepo best practices powered by Claude.
          </p>
          <button
            onClick={handleAnalyze}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-600"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Analyze Repository
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            AI Analysis
          </span>
          {isStreaming && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-600 dark:text-violet-400" />
          )}
        </div>
        {analysis && !isStreaming && (
          <button
            onClick={showFixPane ? handleCloseFixPane : handleFixSuggestions}
            disabled={isFixStreaming}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            {showFixPane ? (
              <>
                <X className="h-3 w-3" />
                Close
              </>
            ) : (
              <>
                <Wrench className="h-3 w-3" />
                Fix Suggestions
              </>
            )}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 flex flex-row">
        {/* Left pane: Analysis */}
        <div
          ref={analysisRef}
          className={`min-h-0 overflow-y-auto ${showFixPane ? "w-1/2 border-r border-zinc-200 dark:border-zinc-800" : "flex-1"}`}
        >
          <div className={`px-6 py-6 ${showFixPane ? "" : "mx-auto max-w-3xl"}`}>
            {error && (
              <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/30">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-red-600 dark:text-red-400" />
                <div>
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">
                    Analysis failed
                  </p>
                  <p className="mt-1 text-xs text-red-700 dark:text-red-300">
                    {error}
                  </p>
                </div>
              </div>
            )}

            {analysis && (
              <article className={proseClasses}>
                <Markdown>{analysis}</Markdown>
              </article>
            )}

            {isStreaming && !analysis && (
              <div className="flex items-center justify-center gap-3 py-12">
                <Loader2 className="h-5 w-5 animate-spin text-violet-600 dark:text-violet-400" />
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  Analyzing your monorepo...
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right pane: Fix Plan */}
        {showFixPane && (
          <div className="w-1/2 min-h-0 flex flex-col">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2.5 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Wrench className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Fix Plan
                </span>
                {isFixStreaming && (
                  <Loader2 className="h-3 w-3 animate-spin text-violet-600 dark:text-violet-400" />
                )}
              </div>
              {fixPlan && !isFixStreaming && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  >
                    {isEditing ? (
                      <>
                        <Eye className="h-3 w-3" />
                        Preview
                      </>
                    ) : (
                      <>
                        <Pencil className="h-3 w-3" />
                        Edit
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
            {isEditing ? (
              <textarea
                value={editedFixPlan}
                onChange={(e) => setEditedFixPlan(e.target.value)}
                className="flex-1 min-h-0 resize-none bg-zinc-50 px-5 py-5 font-mono text-xs leading-relaxed text-zinc-800 outline-none dark:bg-zinc-900 dark:text-zinc-200"
                spellCheck={false}
              />
            ) : (
              <div ref={fixRef} className="flex-1 min-h-0 overflow-y-auto px-5 py-5">
                {fixError && (
                  <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/30">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-red-600 dark:text-red-400" />
                    <div>
                      <p className="text-sm font-medium text-red-800 dark:text-red-200">
                        Fix plan generation failed
                      </p>
                      <p className="mt-1 text-xs text-red-700 dark:text-red-300">
                        {fixError}
                      </p>
                    </div>
                  </div>
                )}

                {(isFixStreaming ? fixPlan : editedFixPlan) && (
                  <article className={proseClasses}>
                    <Markdown>{isFixStreaming ? fixPlan : editedFixPlan}</Markdown>
                  </article>
                )}

                {isFixStreaming && !fixPlan && (
                  <div className="flex items-center justify-center gap-3 py-12">
                    <Loader2 className="h-5 w-5 animate-spin text-violet-600 dark:text-violet-400" />
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">
                      Generating fix plan...
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
