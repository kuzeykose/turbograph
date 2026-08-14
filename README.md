# Turbograph

Analyze and visualize dependency graphs for Turborepo workspaces. Available as a **CLI tool** for quick SVG generation and a **web dashboard** for interactive exploration of GitHub repositories.

## Features

- **Dependency graph visualization** -- hierarchical SVG graphs showing internal package relationships
- **CLI tool** -- run `npx trbgraph` in any Turborepo project to generate an SVG
- **Web dashboard** -- browse GitHub repos, view code, explore commits, and visualize Turborepo dependencies interactively
- **Impact analysis** -- see which packages are affected by changes in a given package
- **Apps vs. packages** -- color-coded nodes distinguish apps from packages at a glance

## Project structure

```
turbograph/
├── apps/
│   ├── cli/                 # CLI tool (Commander.js + tsup)
│   └── dashboard/           # Web app (Next.js 16 + React 19)
├── packages/
│   ├── graph/               # Core graph layout, SVG generation, types
│   ├── ui/                  # Shared UI components (shadcn/ui + Radix)
│   ├── eslint-config/       # Shared ESLint configuration
│   └── typescript-config/   # Shared TypeScript configuration
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

## Prerequisites

- **Node.js** >= 20
- **pnpm** 10.4.1

## Getting started

```bash
# Install dependencies
pnpm install

# Run all apps in development mode
pnpm dev

# Build everything
pnpm build

# Lint
pnpm lint

# Format
pnpm format
```

## CLI

Generate an SVG dependency graph from any Turborepo workspace:

```bash
npx trbgraph
```

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `-o, --output <filename>` | Output filename | `graph.svg` |
| `-w, --width <number>` | SVG width in pixels | `900` |
| `-h, --height <number>` | SVG height in pixels | `550` |
| `--no-grid` | Disable dot grid background | -- |
| `-d, --dir <path>` | Root directory of the Turborepo | `.` |

### Examples

```bash
# Default settings
npx trbgraph

# Custom output and dimensions
npx trbgraph -o deps.svg -w 1200 -h 800

# Point to a different directory
npx trbgraph -d ../my-monorepo
```

### How it works

1. Detects `turbo.json` (or `turbo.jsonc`) to confirm the project is a Turborepo
2. Reads `pnpm-workspace.yaml` (or `package.json` workspaces) to discover workspace packages
3. Parses each `package.json` and resolves internal dependency edges
4. Calculates a hierarchical BFS layout
5. Outputs a self-contained SVG with nodes, edges, arrows, and a legend

### Graph legend

- **Purple nodes** -- Apps (`apps/*`)
- **Teal nodes** -- Packages (`packages/*`)
- **Solid lines** -- Production dependencies
- **Dashed lines** -- Dev dependencies
- Node labels show `Xd / Yr` (X dependencies, Y dependents)

## Dashboard

A Next.js web application for exploring GitHub repositories and visualizing Turborepo dependency graphs.

### Setup

1. **Create a Supabase project** and enable the GitHub OAuth provider. Add scopes `repo` or `public_repo` depending on your needs.

2. **Configure environment variables** in `apps/dashboard/.env.local`:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

3. **Run the dashboard:**

   ```bash
   pnpm dev --filter turbograph-dashboard
   ```

### Dashboard features

- **Repository explorer** -- enter any public GitHub repo URL to browse its contents
- **File browser** -- navigate the file tree with breadcrumb navigation and syntax-highlighted code viewing
- **Commit history** -- paginated commit log with branch selection
- **Dependency graph** -- interactive visualization of Turborepo workspace dependencies (graph and list views)
- **Impact analysis** -- trace how changes propagate through the dependency tree
- **GitHub OAuth** -- sign in for higher API rate limits and access to private repos

## Tech stack

| Category | Technology |
|----------|-----------|
| Monorepo | Turborepo, pnpm workspaces |
| Language | TypeScript |
| CLI | Commander.js, tsup |
| Web framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS, Radix UI, shadcn/ui |
| Auth | Supabase (GitHub OAuth) |
| API | GitHub REST API |
| Testing | Jest, React Testing Library |
| Code quality | ESLint, Prettier |

## Packages

### `@workspace/graph`

Core library shared between the CLI and the dashboard. Exports graph layout algorithms, SVG generation, type definitions, and color palettes.

### `@workspace/ui`

Shared React component library built on shadcn/ui and Radix UI primitives, styled with Tailwind CSS.

## License

[MIT](LICENSE) -- Copyright (c) 2026 Kuzey Kose
