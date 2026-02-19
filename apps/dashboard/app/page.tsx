'use client';

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  Search,
  Github,
  Waypoints,
  GitCommitVertical,
  Terminal,
  GitBranch,
} from "@workspace/ui/icons";
import { Header } from "@/components/header";
import { Separator } from "@workspace/ui/components/separator";
import { TurborepoGraphVisual } from "@/components/turborepo-graph-visual";

import {
  type PackageInfo,
  type DependencyEdge,
  buildDependencyGraph,
} from "@workspace/graph";

// ── Demo data ─────────────────────────────────────────────────────────

const demoApps: PackageInfo[] = [
  {
    name: "trbgraph",
    path: "apps/cli",
    dependencies: { "@workspace/graph": "workspace:*" },
    devDependencies: {},
  },
  {
    name: "turbograph-dashboard",
    path: "apps/dashboard",
    dependencies: {
      "@workspace/graph": "workspace:*",
      "@workspace/ui": "workspace:*",
    },
    devDependencies: {},
  },
];

const demoPackages: PackageInfo[] = [
  {
    name: "@workspace/graph",
    path: "packages/graph",
    dependencies: {},
    devDependencies: {
      "@workspace/eslint-config": "workspace:*",
      "@workspace/typescript-config": "workspace:*",
    },
  },
  {
    name: "@workspace/ui",
    path: "packages/ui",
    dependencies: {},
    devDependencies: {
      "@workspace/eslint-config": "workspace:*",
      "@workspace/typescript-config": "workspace:*",
    },
  },
  {
    name: "@workspace/eslint-config",
    path: "packages/eslint-config",
    dependencies: {},
    devDependencies: {},
  },
  {
    name: "@workspace/typescript-config",
    path: "packages/typescript-config",
    dependencies: {},
    devDependencies: {},
  },
];

const demoWorkspacePackages = new Set<string>(demoPackages.map((p) => p.name));

const demoDependencies: DependencyEdge[] = buildDependencyGraph(
  demoApps,
  demoPackages,
  demoWorkspacePackages,
);

// ── Static data ───────────────────────────────────────────────────────

const features = [
  {
    icon: Waypoints,
    title: "Dependency Graph",
    description:
      "Interactive visualization of every package and app in your Turborepo workspace.",
    accent: "violet" as const,
  },
  {
    icon: GitCommitVertical,
    title: "Impact Analysis",
    description:
      "Select a commit and instantly see which packages are affected downstream.",
    accent: "teal" as const,
  },
  {
    icon: Terminal,
    title: "CLI + Dashboard",
    description:
      "Generate SVG graphs from the terminal, or explore interactively in the browser.",
    accent: "violet" as const,
  },
  {
    icon: GitBranch,
    title: "GitHub Native",
    description:
      "Paste any GitHub URL to start. Public repos work instantly; sign in for private repos.",
    accent: "teal" as const,
  },
];

const steps = [
  {
    number: "01",
    title: "Paste a repo URL",
    description:
      "Enter any GitHub repository URL or owner/repo shorthand.",
  },
  {
    number: "02",
    title: "Explore the graph",
    description:
      "See every workspace dependency laid out as an interactive graph.",
  },
  {
    number: "03",
    title: "Analyze changes",
    description:
      "Browse commits and trace which packages are affected downstream.",
  },
];

// ── Page ──────────────────────────────────────────────────────────────

export default function Home() {
  const router = useRouter();
  const [repoUrl, setRepoUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);

  const parseGitHubUrl = (
    url: string,
  ): { owner: string; repo: string } | null => {
    try {
      const cleanUrl = url.trim().replace(/\.git$/, "").replace(/\/$/, "");
      const patterns = [
        /^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)/,
        /^github\.com\/([^\/]+)\/([^\/]+)/,
        /^([^\/]+)\/([^\/]+)$/,
      ];
      for (const pattern of patterns) {
        const match = cleanUrl.match(pattern);
        if (match) {
          return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
        }
      }
      return null;
    } catch {
      return null;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setUrlError(null);
    if (!repoUrl.trim()) {
      setUrlError("Please enter a repository URL");
      return;
    }
    const parsed = parseGitHubUrl(repoUrl);
    if (!parsed) {
      setUrlError("Enter a valid GitHub URL or owner/repo");
      return;
    }
    router.push(`/repository/${parsed.owner}/${parsed.repo}`);
  };

  const searchForm = (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={repoUrl}
            onChange={(e) => {
              setRepoUrl(e.target.value);
              setUrlError(null);
            }}
            placeholder="vercel/turbo"
            className="w-full h-11 pl-10 pr-4 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
          />
        </div>
        <button
          type="submit"
          className="h-11 px-5 rounded-lg bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors flex items-center gap-2"
        >
          Explore
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
      {urlError && (
        <p className="mt-2 text-sm text-destructive">{urlError}</p>
      )}
    </form>
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />
      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Grid background */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />

        <div className="relative mx-auto max-w-5xl px-6 pt-24 pb-16 sm:pt-32 sm:pb-20">
          {/* Centered text */}
          <div className="max-w-2xl mx-auto text-center animate-fade-up">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-foreground leading-[1.08]">
              Visualize your{" "}
              <span className="animate-gradient-text bg-[length:200%_auto] bg-gradient-to-r from-violet-500 via-teal-400 to-violet-500 bg-clip-text text-transparent">
                Turborepo
              </span>{" "}
              workspace
            </h1>

            <p className="mt-5 text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto">
              Map every dependency, trace commit impact, and understand your
              monorepo&mdash;from the terminal or the browser.
            </p>

            {/* Search */}
            <div
              className="mt-8 max-w-md mx-auto animate-fade-up"
              style={{ animationDelay: "150ms" }}
            >
              {searchForm}
            </div>

            <p
              className="mt-5 text-xs text-muted-foreground/60 animate-fade-up"
              style={{ animationDelay: "250ms" }}
            >
              Try: vercel/turbo, calcom/cal.com, or any public Turborepo
            </p>
          </div>

          {/* Graph hero -- the real interactive component */}
          <div
            className="mt-14 mx-auto h-[480px] animate-fade-up"
            style={{ animationDelay: "350ms" }}
          >
            <TurborepoGraphVisual
              apps={demoApps}
              packages={demoPackages}
              dependencies={demoDependencies}
            />
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────── */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-5xl px-6 py-24 sm:py-32">
          <div className="text-center max-w-xl mx-auto mb-16">
            <p className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-3">
              Features
            </p>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
              Everything you need to understand your monorepo
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-xl border border-border p-6 sm:p-8 transition-colors hover:bg-muted/30"
              >
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${feature.accent === "violet"
                      ? "bg-violet-500/10 text-violet-500"
                      : "bg-teal-500/10 text-teal-500"
                    }`}
                >
                  <feature.icon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-medium text-foreground">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CLI Preview ──────────────────────────────────── */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-5xl px-6 py-24 sm:py-32">
          <div className="flex flex-col lg:flex-row lg:items-center gap-12 lg:gap-16">
            {/* Left: copy */}
            <div className="flex-1 max-w-md">
              <p className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-3">
                CLI
              </p>
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground leading-tight">
                One command, full visibility
              </h2>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                Run{" "}
                <code className="font-mono text-foreground text-sm bg-muted px-1.5 py-0.5 rounded">
                  npx trbgraph
                </code>{" "}
                against any Turborepo to generate an SVG dependency graph
                instantly. No config required.
              </p>
            </div>

            {/* Right: terminal */}
            <div className="flex-1">
              <div className="rounded-xl border border-border bg-muted/20 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
                  <span className="w-3 h-3 rounded-full bg-foreground/10" />
                  <span className="w-3 h-3 rounded-full bg-foreground/10" />
                  <span className="w-3 h-3 rounded-full bg-foreground/10" />
                  <span className="ml-2 text-xs text-muted-foreground font-mono">
                    terminal
                  </span>
                </div>

                <div className="p-5 font-mono text-[13px] leading-relaxed space-y-1 text-muted-foreground">
                  <p>
                    <span className="text-teal-500">$</span> npx trbgraph
                    vercel/turbo --svg
                  </p>
                  <p className="text-foreground/30">
                    Fetching workspace info...
                  </p>
                  <p className="text-foreground/30">
                    Found 14 packages, 3 apps
                  </p>
                  <p className="text-foreground/30">
                    Resolving dependencies...
                  </p>
                  <p className="text-teal-500">
                    &#10003; Generated &rarr; turbo-graph.svg
                  </p>
                  <div className="h-2" />
                  <p>
                    <span className="text-teal-500">$</span> npx trbgraph
                    vercel/turbo --json
                  </p>
                  <p className="text-foreground/30">
                    {`{ "packages": 14, "apps": 3, "edges": 42 }`}
                  </p>
                  <p className="text-teal-500">
                    &#10003; Generated &rarr; turbo-graph.json
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────── */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-5xl px-6 py-24 sm:py-32">
          <div className="text-center max-w-xl mx-auto mb-16">
            <p className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-3">
              How it works
            </p>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
              Three steps to insight
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-12 sm:gap-8">
            {steps.map((step, i) => (
              <div key={step.number} className="relative text-center">
                {i < steps.length - 1 && (
                  <div className="hidden sm:block absolute top-6 left-[calc(50%+28px)] w-[calc(100%-56px)] border-t border-dashed border-border" />
                )}
                <div className="mx-auto w-12 h-12 rounded-full border border-border flex items-center justify-center font-mono text-sm text-muted-foreground relative bg-background">
                  {step.number}
                </div>
                <h3 className="mt-5 text-base font-medium text-foreground">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-[240px] mx-auto">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer CTA ───────────────────────────────────── */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-5xl px-6 py-24 sm:py-32">
          <div className="rounded-2xl border border-border bg-muted/20 p-12 sm:p-16 text-center">
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
              Ready to map your monorepo?
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed max-w-lg mx-auto">
              Paste a GitHub URL and start exploring your Turborepo workspace
              in seconds.
            </p>

            <div className="mt-8 max-w-md mx-auto">{searchForm}</div>

            <p className="mt-4 text-xs text-muted-foreground/60">
              No account required for public repositories
            </p>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────── */}
      <footer className="border-t border-border">
        <div className="mx-auto max-w-5xl px-6 py-6">
          <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
            <span className="font-medium">Turbograph</span>
            <Separator orientation="vertical" className="h-4" />
            <a
              href="https://github.com/kuzeykose/turbograph"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <Github className="w-3.5 h-3.5" />
              GitHub
            </a>
            <Separator orientation="vertical" className="h-4" />
            <span>MIT License</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
