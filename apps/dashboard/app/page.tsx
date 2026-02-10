'use client';

import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { useState, useRef } from "react";
import {
  ArrowRight,
  Search,
  Github,
  Waypoints,
  GitCommitVertical,
  FolderOpen,
  Terminal,
  GitBranch,
  ChevronRight,
  ChevronDown,
  File,
  Lock,
  Unlock,
} from "@workspace/ui/icons";
import { Badge } from "@workspace/ui/components/badge";
import { Separator } from "@workspace/ui/components/separator";

// Minimal graph demo for the hero
function GraphDemo() {
  const nodes = [
    { id: 'web', x: 80, y: 60, type: 'app' },
    { id: 'api', x: 200, y: 40, type: 'app' },
    { id: 'ui', x: 120, y: 140, type: 'pkg' },
    { id: 'utils', x: 240, y: 120, type: 'pkg' },
    { id: 'config', x: 180, y: 200, type: 'pkg' },
  ];

  const edges = [
    { from: 'web', to: 'ui' },
    { from: 'web', to: 'utils' },
    { from: 'api', to: 'utils' },
    { from: 'api', to: 'config' },
    { from: 'ui', to: 'config' },
  ];

  return (
    <svg viewBox="0 0 320 240" className="w-full h-full">
      <defs>
        <linearGradient id="edge-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.1" />
          <stop offset="50%" stopColor="currentColor" stopOpacity="0.3" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.1" />
        </linearGradient>
      </defs>

      {edges.map((edge, i) => {
        const from = nodes.find(n => n.id === edge.from)!;
        const to = nodes.find(n => n.id === edge.to)!;
        return (
          <line
            key={i}
            x1={from.x} y1={from.y} x2={to.x} y2={to.y}
            stroke="url(#edge-grad)" strokeWidth="1.5"
            className="text-foreground"
          />
        );
      })}

      {nodes.map((node) => (
        <g key={node.id}>
          <circle
            cx={node.x} cy={node.y} r="20"
            className={node.type === 'app'
              ? "fill-violet-500/10 stroke-violet-500/40"
              : "fill-teal-500/10 stroke-teal-500/40"
            }
            strokeWidth="1.5"
          />
          <text
            x={node.x} y={node.y + 4} textAnchor="middle"
            className="fill-muted-foreground text-[10px] font-medium"
          >
            {node.id}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ── Feature Demo Components ──────────────────────────────────────────

function InteractiveGraphDemo() {
  const [nodes, setNodes] = useState([
    { id: 'web', x: 80, y: 55, type: 'app' as const },
    { id: 'api', x: 220, y: 45, type: 'app' as const },
    { id: 'ui', x: 60, y: 150, type: 'pkg' as const },
    { id: 'utils', x: 260, y: 130, type: 'pkg' as const },
    { id: 'config', x: 160, y: 190, type: 'pkg' as const },
  ]);
  const draggingRef = useRef<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const edges = [
    ['web', 'ui'], ['web', 'utils'], ['api', 'utils'],
    ['api', 'config'], ['ui', 'config'],
  ];

  const getSVGCoords = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    return {
      x: ((e.clientX - rect.left) / rect.width) * vb.width,
      y: ((e.clientY - rect.top) / rect.height) * vb.height,
    };
  };

  return (
    <div className="h-full flex flex-col">
      <svg
        ref={svgRef}
        viewBox="0 0 320 240"
        className="flex-1 cursor-default"
        onMouseMove={(e) => {
          if (!draggingRef.current) return;
          const pt = getSVGCoords(e);
          if (!pt) return;
          setNodes(prev => prev.map(n =>
            n.id === draggingRef.current
              ? { ...n, x: Math.max(24, Math.min(296, pt.x)), y: Math.max(24, Math.min(216, pt.y)) }
              : n
          ));
        }}
        onMouseUp={() => { draggingRef.current = null; }}
        onMouseLeave={() => { draggingRef.current = null; }}
      >
        {edges.map(([from, to], i) => {
          const f = nodes.find(n => n.id === from)!;
          const t = nodes.find(n => n.id === to)!;
          return <line key={i} x1={f.x} y1={f.y} x2={t.x} y2={t.y} className="stroke-foreground/20" strokeWidth="1.5" />;
        })}
        {nodes.map((node) => (
          <g
            key={node.id}
            onMouseDown={() => { draggingRef.current = node.id; }}
            style={{ cursor: 'grab' }}
          >
            <circle
              cx={node.x} cy={node.y} r="20"
              className={node.type === 'app'
                ? "fill-violet-500/10 stroke-violet-500/40"
                : "fill-teal-500/10 stroke-teal-500/40"
              }
              strokeWidth="1.5"
            />
            <text
              x={node.x} y={node.y + 4} textAnchor="middle"
              className="fill-muted-foreground text-[10px] font-medium select-none pointer-events-none"
            >
              {node.id}
            </text>
          </g>
        ))}
      </svg>
      <p className="text-[11px] text-muted-foreground text-center pb-3">Drag nodes to rearrange</p>
    </div>
  );
}

function ImpactAnalysisDemo() {
  const [selected, setSelected] = useState<number | null>(null);

  const commits = [
    { hash: 'a3f2c1d', msg: 'fix: button hover styles', affects: ['ui', 'web'] },
    { hash: 'b7e4a2f', msg: 'feat: add logger util', affects: ['utils', 'api', 'web'] },
    { hash: 'c9d1b3e', msg: 'chore: update tsconfig', affects: ['config', 'ui', 'api', 'web'] },
  ];

  const nodes = [
    { id: 'web', x: 80, y: 45, type: 'app' as const },
    { id: 'api', x: 220, y: 45, type: 'app' as const },
    { id: 'ui', x: 80, y: 115, type: 'pkg' as const },
    { id: 'utils', x: 220, y: 115, type: 'pkg' as const },
    { id: 'config', x: 150, y: 115, type: 'pkg' as const },
  ];

  const edges = [
    ['web', 'ui'], ['web', 'utils'], ['api', 'utils'],
    ['api', 'config'], ['ui', 'config'],
  ];

  const affected = selected !== null ? commits[selected].affects : [];

  return (
    <div className="h-full flex flex-col">
      <svg viewBox="0 0 320 160" className="flex-none h-[55%]">
        {edges.map(([from, to], i) => {
          const f = nodes.find(n => n.id === from)!;
          const t = nodes.find(n => n.id === to)!;
          return (
            <line key={i} x1={f.x} y1={f.y} x2={t.x} y2={t.y}
              className={affected.includes(from) && affected.includes(to) ? "stroke-foreground/40" : "stroke-foreground/15"}
              strokeWidth="1.5"
            />
          );
        })}
        {nodes.map(node => (
          <g key={node.id}>
            <circle cx={node.x} cy={node.y} r="20"
              className={
                affected.includes(node.id)
                  ? node.type === 'app' ? "fill-violet-500/30 stroke-violet-500" : "fill-teal-500/30 stroke-teal-500"
                  : node.type === 'app' ? "fill-violet-500/10 stroke-violet-500/40" : "fill-teal-500/10 stroke-teal-500/40"
              }
              strokeWidth={affected.includes(node.id) ? "2" : "1.5"}
              style={{ transition: 'all 200ms' }}
            />
            <text x={node.x} y={node.y + 4} textAnchor="middle"
              className="fill-muted-foreground text-[10px] font-medium select-none pointer-events-none"
            >{node.id}</text>
          </g>
        ))}
      </svg>
      <div className="flex-1 px-3 pb-3 space-y-1.5 overflow-auto">
        <p className="text-[11px] text-muted-foreground mb-1 px-1">Click a commit to see impact:</p>
        {commits.map((c, i) => (
          <button key={i}
            onClick={() => setSelected(selected === i ? null : i)}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
              selected === i ? 'bg-foreground/10' : 'hover:bg-foreground/5'
            }`}
          >
            <span className="font-mono text-violet-500">{c.hash}</span>
            <span className="ml-2 text-muted-foreground">{c.msg}</span>
            {selected === i && (
              <span className="ml-2 text-teal-500">{c.affects.length} affected</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function FileBrowserDemo() {
  const [expanded, setExpanded] = useState(new Set(['apps', 'packages']));
  const [selectedFile, setSelectedFile] = useState<string | null>('packages/ui/button.tsx');

  const tree = [
    { id: 'apps', label: 'apps', type: 'folder' as const, depth: 0, parent: null as string | null },
    { id: 'apps/web', label: 'web', type: 'folder' as const, depth: 1, parent: 'apps' },
    { id: 'apps/web/page.tsx', label: 'page.tsx', type: 'file' as const, depth: 2, parent: 'apps/web' },
    { id: 'apps/api', label: 'api', type: 'folder' as const, depth: 1, parent: 'apps' },
    { id: 'apps/api/index.ts', label: 'index.ts', type: 'file' as const, depth: 2, parent: 'apps/api' },
    { id: 'packages', label: 'packages', type: 'folder' as const, depth: 0, parent: null },
    { id: 'packages/ui', label: 'ui', type: 'folder' as const, depth: 1, parent: 'packages' },
    { id: 'packages/ui/button.tsx', label: 'button.tsx', type: 'file' as const, depth: 2, parent: 'packages/ui' },
    { id: 'packages/utils', label: 'utils', type: 'folder' as const, depth: 1, parent: 'packages' },
    { id: 'packages/utils/index.ts', label: 'index.ts', type: 'file' as const, depth: 2, parent: 'packages/utils' },
  ];

  const fileContents: Record<string, string> = {
    'apps/web/page.tsx': 'import { Button } from "@repo/ui"\n\nexport default function Home() {\n  return <Button>Click me</Button>\n}',
    'apps/api/index.ts': 'import { logger } from "@repo/utils"\n\napp.get("/api", (req, res) => {\n  logger.info("request received")\n})',
    'packages/ui/button.tsx': 'export function Button({ children }) {\n  return (\n    <button className="btn">\n      {children}\n    </button>\n  )\n}',
    'packages/utils/index.ts': 'export const logger = {\n  info: (msg: string) =>\n    console.log(`[INFO] ${msg}`),\n}',
  };

  const isVisible = (item: typeof tree[number]) => {
    if (!item.parent) return true;
    let parentId: string | null = item.parent;
    while (parentId) {
      if (!expanded.has(parentId)) return false;
      const parent = tree.find(t => t.id === parentId);
      parentId = parent?.parent ?? null;
    }
    return true;
  };

  const toggleFolder = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="h-full flex text-xs font-mono">
      {/* Tree */}
      <div className="w-[45%] border-r border-border overflow-auto p-2 space-y-0.5">
        {tree.filter(isVisible).map(item => (
          <button key={item.id}
            className={`w-full text-left flex items-center gap-1.5 py-1.5 rounded transition-colors ${
              selectedFile === item.id ? 'bg-foreground/10' : 'hover:bg-foreground/5'
            }`}
            style={{ paddingLeft: `${item.depth * 12 + 8}px`, paddingRight: 8 }}
            onClick={() => {
              if (item.type === 'folder') toggleFolder(item.id);
              else setSelectedFile(item.id);
            }}
          >
            {item.type === 'folder' ? (
              expanded.has(item.id)
                ? <ChevronDown className="w-3 h-3 text-muted-foreground flex-none" />
                : <ChevronRight className="w-3 h-3 text-muted-foreground flex-none" />
            ) : (
              <File className="w-3 h-3 text-muted-foreground flex-none" />
            )}
            <span className={item.type === 'folder' ? 'text-foreground' : 'text-muted-foreground'}>{item.label}</span>
          </button>
        ))}
      </div>
      {/* Preview */}
      <div className="w-[55%] overflow-auto p-3">
        {selectedFile && fileContents[selectedFile] ? (
          <pre className="text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap">{fileContents[selectedFile]}</pre>
        ) : (
          <p className="text-muted-foreground text-center mt-12">Select a file</p>
        )}
      </div>
    </div>
  );
}

function CLIDemo() {
  return (
    <div className="h-full flex flex-col font-mono text-xs p-5">
      <div className="flex items-center gap-1.5 mb-4">
        <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
        <span className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
      </div>
      <div className="space-y-1.5 text-muted-foreground">
        <p><span className="text-teal-500">$</span> npx turbograph vercel/turbo --svg</p>
        <p className="text-foreground/40">Fetching workspace info...</p>
        <p className="text-foreground/40">Found 14 packages, 3 apps</p>
        <p className="text-foreground/40">Resolving dependencies...</p>
        <p className="text-teal-500">&#10003; Generated &rarr; turbo-graph.svg</p>
        <div className="h-3" />
        <p><span className="text-teal-500">$</span> npx turbograph vercel/turbo --json</p>
        <p className="text-foreground/40">{`{ "packages": 14, "apps": 3, "edges": 42 }`}</p>
        <p className="text-teal-500">&#10003; Generated &rarr; turbo-graph.json</p>
      </div>
    </div>
  );
}

function GitHubIntegrationDemo() {
  const [authed, setAuthed] = useState(false);

  const repos = [
    { name: 'vercel/turbo', isPrivate: false },
    { name: 'acme/frontend', isPrivate: true },
    { name: 'acme/backend', isPrivate: true },
  ];

  return (
    <div className="h-full flex flex-col p-5 text-xs">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-foreground">Repositories</span>
        <button
          onClick={() => setAuthed(!authed)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            authed
              ? 'bg-foreground/10 text-foreground hover:bg-foreground/15'
              : 'bg-foreground text-background hover:bg-foreground/90'
          }`}
        >
          {authed ? 'Sign out' : 'Sign in'}
        </button>
      </div>
      <div className="space-y-2">
        {repos.map(repo => (
          <div key={repo.name}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all duration-200 ${
              !repo.isPrivate || authed
                ? 'border-border bg-background'
                : 'border-border/50 bg-muted/50 opacity-50'
            }`}
          >
            {repo.isPrivate ? (
              authed
                ? <Unlock className="w-3.5 h-3.5 text-teal-500 flex-none" />
                : <Lock className="w-3.5 h-3.5 text-muted-foreground flex-none" />
            ) : (
              <Github className="w-3.5 h-3.5 text-muted-foreground flex-none" />
            )}
            <span className={!repo.isPrivate || authed ? 'text-foreground' : 'text-muted-foreground'}>
              {repo.name}
            </span>
            {repo.isPrivate && (
              <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded transition-colors duration-200 ${
                authed ? 'text-teal-500 bg-teal-500/10' : 'text-muted-foreground bg-muted'
              }`}>
                {authed ? 'accessible' : 'private'}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function BranchManagementDemo() {
  const [branch, setBranch] = useState('main');

  const branches = ['main', 'develop', 'feature/auth'];

  const branchGraphs: Record<string, {
    nodes: { id: string; x: number; y: number; type: 'app' | 'pkg' }[];
    edges: [string, string][];
  }> = {
    main: {
      nodes: [
        { id: 'web', x: 80, y: 55, type: 'app' },
        { id: 'api', x: 220, y: 55, type: 'app' },
        { id: 'ui', x: 60, y: 150, type: 'pkg' },
        { id: 'utils', x: 260, y: 150, type: 'pkg' },
        { id: 'config', x: 160, y: 190, type: 'pkg' },
      ],
      edges: [['web', 'ui'], ['web', 'utils'], ['api', 'utils'], ['api', 'config'], ['ui', 'config']],
    },
    develop: {
      nodes: [
        { id: 'web', x: 70, y: 50, type: 'app' },
        { id: 'api', x: 250, y: 50, type: 'app' },
        { id: 'ui', x: 50, y: 150, type: 'pkg' },
        { id: 'utils', x: 160, y: 150, type: 'pkg' },
        { id: 'config', x: 270, y: 150, type: 'pkg' },
        { id: 'auth', x: 160, y: 60, type: 'pkg' },
      ],
      edges: [['web', 'ui'], ['web', 'auth'], ['api', 'utils'], ['api', 'auth'], ['api', 'config'], ['ui', 'config'], ['auth', 'utils']],
    },
    'feature/auth': {
      nodes: [
        { id: 'web', x: 70, y: 45, type: 'app' },
        { id: 'api', x: 250, y: 45, type: 'app' },
        { id: 'ui', x: 50, y: 140, type: 'pkg' },
        { id: 'utils', x: 160, y: 200, type: 'pkg' },
        { id: 'config', x: 270, y: 140, type: 'pkg' },
        { id: 'auth', x: 160, y: 90, type: 'pkg' },
      ],
      edges: [['web', 'ui'], ['web', 'auth'], ['api', 'utils'], ['api', 'auth'], ['api', 'config'], ['ui', 'config'], ['auth', 'utils'], ['auth', 'config']],
    },
  };

  const { nodes, edges } = branchGraphs[branch];

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-4 pt-4">
        <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
        <select
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          className="text-xs bg-background border border-border rounded-md px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {branches.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        {branch !== 'main' && (
          <span className="text-[10px] text-teal-500 ml-auto">
            +{nodes.length - 5} new package
          </span>
        )}
      </div>
      <svg viewBox="0 0 320 240" className="flex-1">
        {edges.map(([from, to], i) => {
          const f = nodes.find(n => n.id === from)!;
          const t = nodes.find(n => n.id === to)!;
          return <line key={i} x1={f.x} y1={f.y} x2={t.x} y2={t.y} className="stroke-foreground/20" strokeWidth="1.5" />;
        })}
        {nodes.map(node => (
          <g key={node.id}>
            <circle cx={node.x} cy={node.y} r="18"
              className={node.type === 'app' ? "fill-violet-500/10 stroke-violet-500/40" : "fill-teal-500/10 stroke-teal-500/40"}
              strokeWidth="1.5"
              style={{ transition: 'cx 300ms, cy 300ms' }}
            />
            <text x={node.x} y={node.y + 4} textAnchor="middle"
              className="fill-muted-foreground text-[10px] font-medium select-none"
              style={{ transition: 'x 300ms, y 300ms' }}
            >{node.id}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

const featureDemo = [InteractiveGraphDemo, ImpactAnalysisDemo, FileBrowserDemo, CLIDemo, GitHubIntegrationDemo, BranchManagementDemo];

// ── Feature metadata ─────────────────────────────────────────────────

const features = [
  {
    icon: Waypoints,
    color: 'violet' as const,
    title: 'Interactive Graph',
    description: 'Force-directed dependency visualization with zoom, pan, and node selection',
  },
  {
    icon: GitCommitVertical,
    color: 'teal' as const,
    title: 'Impact Analysis',
    description: 'See which packages are affected by each commit and trace downstream dependents',
  },
  {
    icon: FolderOpen,
    color: 'violet' as const,
    title: 'File Browser',
    description: 'Browse repository files with syntax highlighting',
  },
  {
    icon: Terminal,
    color: 'teal' as const,
    title: 'CLI Tool',
    description: 'Generate SVG dependency graphs from the command line',
  },
  {
    icon: Github,
    color: 'violet' as const,
    title: 'GitHub Integration',
    description: 'Sign in with GitHub to access private repos; public repos work without auth',
  },
  {
    icon: GitBranch,
    color: 'teal' as const,
    title: 'Branch Management',
    description: 'Switch between branches and explore dependency changes',
  },
];

const steps = [
  {
    number: 1,
    title: 'Paste a repo URL',
    description: 'Enter any GitHub repository URL or owner/repo shorthand',
  },
  {
    number: 2,
    title: 'Explore the graph',
    description: 'See workspace dependencies as an interactive force-directed graph',
  },
  {
    number: 3,
    title: 'Analyze changes',
    description: 'Browse commits and see which packages are affected',
  },
];

// ── Page ──────────────────────────────────────────────────────────────

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [repoUrl, setRepoUrl] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [activeFeature, setActiveFeature] = useState(0);

  const parseGitHubUrl = (url: string): { owner: string; repo: string } | null => {
    try {
      const cleanUrl = url.trim().replace(/\.git$/, '').replace(/\/$/, '');
      const patterns = [
        /^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)/,
        /^github\.com\/([^\/]+)\/([^\/]+)/,
        /^([^\/]+)\/([^\/]+)$/
      ];

      for (const pattern of patterns) {
        const match = cleanUrl.match(pattern);
        if (match) {
          return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
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
      setUrlError('Please enter a repository URL');
      return;
    }

    const parsed = parseGitHubUrl(repoUrl);
    if (!parsed) {
      setUrlError('Enter a valid GitHub URL or owner/repo');
      return;
    }

    router.push(`/repository/${parsed.owner}/${parsed.repo}`);
  };

  const searchForm = (
    <form onSubmit={handleSubmit}>
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
          className="h-11 px-5 rounded-lg bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors"
        >
          Explore
        </button>
      </div>
      {urlError && (
        <p className="mt-2 text-sm text-destructive">{urlError}</p>
      )}
    </form>
  );

  const ActiveDemo = featureDemo[activeFeature];

  return (
    <div className="min-h-screen bg-background">

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 py-24 sm:py-32">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-16">

          {/* Left: Content */}
          <div className="flex-1 max-w-xl">
            <Badge variant="outline" className="mb-6">
              <Github className="w-3.5 h-3.5" />
              Open Source
            </Badge>

            <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-foreground leading-[1.1]">
              Visualize your Turborepo workspace
            </h1>

            <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
              Explore dependency graphs, track commit impact, and browse files across your monorepo&mdash;right from your browser.
            </p>

            {/* Search */}
            <div className="mt-8">
              {searchForm}
            </div>

            {/* Auth status */}
            <div className="mt-6 flex items-center gap-4 text-sm">
              {loading ? (
                <span className="text-muted-foreground">Loading...</span>
              ) : user ? (
                <>
                  <span className="text-muted-foreground">
                    Signed in as {user.user_metadata?.name || user.email}
                  </span>
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-1.5 text-foreground font-medium hover:underline underline-offset-4"
                  >
                    Dashboard
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </>
              ) : (
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-foreground font-medium hover:underline underline-offset-4"
                >
                  Sign in with GitHub
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>

            <p className="mt-3 text-xs text-muted-foreground">
              Try: vercel/turbo, calcom/cal.com, or any public Turborepo
            </p>
          </div>

          {/* Right: Graph visualization */}
          <div className="flex-1 max-w-sm">
            <div className="aspect-[4/3] rounded-xl border border-border bg-muted/30">
              <GraphDemo />
            </div>

            {/* Legend */}
            <div className="mt-4 flex items-center justify-center gap-6 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-violet-500/60" />
                <span>Apps</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-500/60" />
                <span>Packages</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-5xl px-6 py-24 sm:py-32">
          <div className="text-center max-w-2xl mx-auto">
            <p className="text-sm font-medium uppercase tracking-wider text-violet-500">Features</p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
              Everything you need to understand your monorepo
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              From interactive graphs to commit-level impact analysis, Turbograph gives you full visibility into your workspace.
            </p>
          </div>

          <div className="mt-16 flex flex-col lg:flex-row gap-6">
            {/* Feature list */}
            <div className="lg:w-72 flex-none space-y-1">
              {features.map((feature, i) => (
                <button key={feature.title}
                  onClick={() => setActiveFeature(i)}
                  className={`w-full text-left flex items-start gap-3 px-4 py-3 rounded-xl transition-colors ${
                    activeFeature === i ? 'bg-muted/60' : 'hover:bg-muted/30'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-none mt-0.5 ${
                    feature.color === 'violet' ? 'bg-violet-500/10 text-violet-500' : 'bg-teal-500/10 text-teal-500'
                  }`}>
                    <feature.icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{feature.title}</p>
                    {activeFeature === i && (
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{feature.description}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Demo panel */}
            <div className="flex-1 rounded-xl border border-border bg-muted/30 overflow-hidden min-h-[360px]">
              <ActiveDemo />
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-5xl px-6 py-24 sm:py-32">
          <div className="text-center max-w-2xl mx-auto">
            <p className="text-sm font-medium uppercase tracking-wider text-teal-500">How it works</p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
              Three steps to insight
            </h2>
          </div>

          <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-12 sm:gap-8">
            {steps.map((step) => (
              <div key={step.number} className="text-center">
                <div className="mx-auto w-12 h-12 rounded-full border-2 border-border flex items-center justify-center text-lg font-semibold text-foreground">
                  {step.number}
                </div>
                <h3 className="mt-4 text-base font-medium text-foreground">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-5xl px-6 py-24 sm:py-32">
          <div className="rounded-2xl border border-border bg-muted/30 p-12 sm:p-16 text-center">
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
              Ready to map your monorepo?
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed max-w-lg mx-auto">
              Paste a GitHub URL and start exploring your Turborepo workspace in seconds.
            </p>

            <div className="mt-8 max-w-md mx-auto">
              {searchForm}
            </div>

            <p className="mt-4 text-xs text-muted-foreground">
              No account required for public repositories
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto max-w-5xl px-6 py-6">
          <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
            <span>Turbograph</span>
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
