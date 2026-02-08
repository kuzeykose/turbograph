# turbograph

CLI tool that generates SVG dependency graphs for Turborepo workspaces.

## Usage

Run from the root of any Turborepo project:

```bash
npx turbograph
```

This scans the workspace, resolves internal dependencies, and outputs a `graph.svg` file in the current directory.

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `-o, --output <filename>` | Output filename | `graph.svg` |
| `-w, --width <number>` | SVG width in pixels | `900` |
| `-h, --height <number>` | SVG height in pixels | `550` |
| `--no-grid` | Disable dot grid background | — |
| `-d, --dir <path>` | Root directory of the turborepo | Current directory |
| `-V, --version` | Print version | — |
| `--help` | Show help | — |

## Examples

Generate with default settings:

```bash
npx turbograph
```

Custom output file and dimensions:

```bash
npx turbograph -o deps.svg -w 1200 -h 800
```

Point to a different directory:

```bash
npx turbograph -d ../my-monorepo
```

## How it works

1. Looks for `turbo.json` to confirm the project is a Turborepo
2. Reads `pnpm-workspace.yaml` (or `package.json` workspaces) to discover workspace patterns
3. Scans matching directories and parses each `package.json`
4. Resolves internal dependency edges (both `dependencies` and `devDependencies`)
5. Calculates a hierarchical layout using BFS depth from leaf nodes
6. Generates a self-contained SVG with nodes, edges, arrows, and a legend

## Graph legend

- **Purple nodes** — Apps (`apps/*`)
- **Teal nodes** — Packages (`packages/*`)
- **Solid lines** — Production dependencies
- **Dashed lines** — Dev dependencies
- Node labels show `Xd / Yr` (X dependencies, Y dependents)

## Development

```bash
# Build
pnpm build

# Watch mode
pnpm dev

# Type check
pnpm check-types
```
