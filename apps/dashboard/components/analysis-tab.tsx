"use client";

import { useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { useAnalysis } from "@/hooks/use-analysis";
import type { TurborepoStructure, DependencyEdge } from "@/lib/utils/turborepo";
import { githubService } from "@/lib/services/github";
import { Sparkles, AlertCircle, RefreshCw, Loader2, LogIn } from "@workspace/ui/icons";

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
  const { analysis, isStreaming, error, runAnalysis, reset } = useAnalysis();
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isStreaming && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [analysis, isStreaming]);

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
    let turboJsonContent: string | undefined;
    try {
      const data = await githubService.getContents(owner, repo, "turbo.json");
      if (!Array.isArray(data) && "content" in data) {
        turboJsonContent = data.content;
      }
    } catch {
      // turbo.json fetch is best-effort
    }

    runAnalysis({
      apps: turborepoStructure.apps,
      packages: turborepoStructure.packages,
      edges: dependencyGraph,
      turboJsonContent,
    });
  }, [turborepoStructure, dependencyGraph, owner, repo, runAnalysis]);

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
        <button
          onClick={handleAnalyze}
          disabled={isStreaming}
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          <RefreshCw className={`h-3 w-3 ${isStreaming ? "animate-spin" : ""}`} />
          Re-analyze
        </button>
      </div>

      {/* Content */}
      <div ref={contentRef} className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
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
          <div className="prose prose-sm prose-zinc max-w-none dark:prose-invert prose-headings:text-sm prose-headings:font-semibold prose-p:text-xs prose-p:leading-relaxed prose-li:text-xs prose-li:leading-relaxed prose-code:text-xs prose-pre:text-xs">
            <MarkdownContent content={analysis} />
          </div>
        )}

        {isStreaming && !analysis && (
          <div className="flex items-center gap-3 py-8">
            <Loader2 className="h-5 w-5 animate-spin text-violet-600 dark:text-violet-400" />
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              Analyzing your monorepo...
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function MarkdownContent({ content }: { content: string }) {
  const html = markdownToHtml(content);
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

function markdownToHtml(md: string): string {
  let html = md;

  // Code blocks
  html = html.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    (_, lang, code) =>
      `<pre><code class="language-${lang}">${escapeHtml(code.trim())}</code></pre>`,
  );

  // Inline code
  html = html.replace(
    /`([^`]+)`/g,
    (_, code) => `<code>${escapeHtml(code)}</code>`,
  );

  // Headers
  html = html.replace(/^#### (.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, "<li>$1</li>");
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, "<ul>$1</ul>");

  // Paragraphs (lines not already wrapped in block elements)
  html = html.replace(
    /^(?!<[hulop])((?!<).+)$/gm,
    "<p>$1</p>",
  );

  // Clean up double newlines between block elements
  html = html.replace(/\n{2,}/g, "\n");

  return html;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
