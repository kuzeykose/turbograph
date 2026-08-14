"use client";

import { useState, useCallback, useRef } from "react";
import type { PackageInfo, DependencyEdge } from "@workspace/graph";

interface AnalysisInput {
  apps: PackageInfo[];
  packages: PackageInfo[];
  edges: DependencyEdge[];
  turboJsonContent?: string;
  turboConfigFile?: string;
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
          turboConfigFile: input.turboConfigFile,
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

interface FixPlanInput extends AnalysisInput {
  analysisOutput: string;
}

interface UseFixPlanReturn {
  fixPlan: string;
  isFixStreaming: boolean;
  fixError: string | null;
  runFixPlan: (input: FixPlanInput) => Promise<void>;
  resetFix: () => void;
}

export function useFixPlan(): UseFixPlanReturn {
  const [fixPlan, setFixPlan] = useState("");
  const [isFixStreaming, setIsFixStreaming] = useState(false);
  const [fixError, setFixError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const resetFix = useCallback(() => {
    abortRef.current?.abort();
    setFixPlan("");
    setIsFixStreaming(false);
    setFixError(null);
  }, []);

  const runFixPlan = useCallback(async (input: FixPlanInput) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setFixPlan("");
    setIsFixStreaming(true);
    setFixError(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "fix",
          analysisOutput: input.analysisOutput,
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
          turboConfigFile: input.turboConfigFile,
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
        setFixPlan(accumulated);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setFixError(err instanceof Error ? err.message : "Fix plan generation failed");
    } finally {
      setIsFixStreaming(false);
    }
  }, []);

  return { fixPlan, isFixStreaming, fixError, runFixPlan, resetFix };
}
