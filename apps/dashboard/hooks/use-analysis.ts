"use client";

import { useState, useCallback, useRef } from "react";
import type { PackageInfo, DependencyEdge } from "@workspace/graph";

interface AnalysisInput {
  apps: PackageInfo[];
  packages: PackageInfo[];
  edges: DependencyEdge[];
  turboJsonContent?: string;
}

interface UseAnalysisReturn {
  analysis: string;
  isStreaming: boolean;
  error: string | null;
  runAnalysis: (input: AnalysisInput) => Promise<void>;
  reset: () => void;
}

export function useAnalysis(): UseAnalysisReturn {
  const [analysis, setAnalysis] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setAnalysis("");
    setIsStreaming(false);
    setError(null);
  }, []);

  const runAnalysis = useCallback(async (input: AnalysisInput) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setAnalysis("");
    setIsStreaming(true);
    setError(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apps: input.apps.map((a) => ({
            name: a.name,
            path: a.path,
            dependencies: a.dependencies,
            devDependencies: a.devDependencies,
          })),
          packages: input.packages.map((p) => ({
            name: p.name,
            path: p.path,
            dependencies: p.dependencies,
            devDependencies: p.devDependencies,
          })),
          edges: input.edges,
          turboJsonContent: input.turboJsonContent,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || `Request failed (${response.status})`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setAnalysis(accumulated);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setIsStreaming(false);
    }
  }, []);

  return { analysis, isStreaming, error, runAnalysis, reset };
}
