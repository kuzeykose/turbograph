import type { PackageInfo, DependencyEdge } from "@workspace/graph";

export interface AnalysisInput {
  apps: PackageInfo[];
  packages: PackageInfo[];
  edges: DependencyEdge[];
  turboJsonContent?: string;
  /** Filename the config was read from ("turbo.json" or "turbo.jsonc"). */
  turboConfigFile?: string;
}

/** Heading and fence language for the turbo config section of a prompt. */
function turboConfigLabels(turboConfigFile?: string) {
  const filename = turboConfigFile ?? "turbo.json";
  return { filename, fence: filename.endsWith(".jsonc") ? "jsonc" : "json" };
}

export const SYSTEM_PROMPT = `You are a senior monorepo architect specializing in Turborepo workspaces. You analyze dependency graphs and workspace structures to provide concise, actionable feedback.

Format your response in markdown with these sections:
## Dependency Health
Analyze circular dependencies, coupling levels, orphaned packages, and dependency depth.

## Architecture
Evaluate package boundaries, naming conventions, separation of concerns, and shared code organization.

## Turborepo Best Practices
Review the turbo config (turbo.json or turbo.jsonc, if provided), caching strategy, pipeline definitions, and workspace setup.

## Summary
A brief overall assessment with the top 3 priorities to address.

Be specific — reference package names directly. Keep each section to 3-5 bullet points. Skip sections that have no issues worth mentioning.`;

function formatPackage(pkg: PackageInfo): string {
  const deps = Object.entries(pkg.dependencies);
  const devDeps = Object.entries(pkg.devDependencies);
  let out = `### ${pkg.name}\npath: ${pkg.path}`;
  if (deps.length > 0) {
    out += `\ndependencies: ${deps.map(([n, v]) => `${n}@${v}`).join(", ")}`;
  }
  if (devDeps.length > 0) {
    out += `\ndevDependencies: ${devDeps.map(([n, v]) => `${n}@${v}`).join(", ")}`;
  }
  return out;
}

export function buildAnalysisPrompt(input: AnalysisInput): string {
  const { apps, packages, edges, turboJsonContent, turboConfigFile } = input;

  const sections: string[] = [];

  sections.push(
    `Analyze the following Turborepo monorepo and provide actionable feedback.`,
  );

  sections.push(
    `## Workspace Overview\n- Apps: ${apps.length}\n- Packages: ${packages.length}\n- Internal dependency edges: ${edges.length}`,
  );

  if (apps.length > 0) {
    sections.push(`## Apps\n${apps.map(formatPackage).join("\n\n")}`);
  }

  if (packages.length > 0) {
    sections.push(`## Packages\n${packages.map(formatPackage).join("\n\n")}`);
  }

  if (edges.length > 0) {
    const edgeLines = edges
      .map((e) => `${e.from} --[${e.type}]--> ${e.to}`)
      .join("\n");
    sections.push(`## Internal Dependency Graph\n${edgeLines}`);
  }

  if (turboJsonContent) {
    const { filename, fence } = turboConfigLabels(turboConfigFile);
    sections.push(
      `## ${filename}\n\`\`\`${fence}\n${turboJsonContent}\n\`\`\``,
    );
  }

  return sections.join("\n\n");
}

export const FIX_SYSTEM_PROMPT = `You are a senior monorepo architect who creates step-by-step fix plans for Turborepo workspaces. Given an analysis of issues and the workspace structure, produce a concrete, ordered plan to resolve every issue.

Format your response in markdown using this exact structure for each step:

### Step N: [Short title]

**Problem:** What is wrong and where.
**Why it matters:** Impact on build, DX, or reliability.

**Files to modify:**
- \`path/to/file\` — what to change

**Changes:**
\`\`\`diff
- old code or config
+ new code or config
\`\`\`

**Commands to run:**
\`\`\`sh
# any install, migration, or verification commands
\`\`\`

Rules:
- Address every issue from the analysis — do not skip any.
- Order steps by dependency: if step 2 depends on step 1, step 1 comes first.
- Use exact file paths relative to the monorepo root.
- Show diffs for config changes (package.json, the turbo config, tsconfig.json). Use the exact turbo config filename shown in the workspace structure.
- Show shell commands for dependency installs or migrations.
- Flag breaking changes with a warning.
- Keep each step focused on one issue — do not combine unrelated fixes.
- Be specific with package names and file paths. Do not use placeholders.`;

export function buildFixPrompt(
  analysisOutput: string,
  input: AnalysisInput,
): string {
  const { apps, packages, edges, turboJsonContent, turboConfigFile } = input;

  const allPkgs = [...apps, ...packages];

  const fileTree = allPkgs
    .map((p) => {
      const deps = Object.keys(p.dependencies);
      const devDeps = Object.keys(p.devDependencies);
      const allDeps = [...deps, ...devDeps.map((d) => `${d} (dev)`)];
      return `- ${p.path}/package.json  [${p.name}]${allDeps.length > 0 ? `\n  deps: ${allDeps.join(", ")}` : ""}`;
    })
    .join("\n");

  const edgeList =
    edges.length > 0
      ? edges.map((e) => `${e.from} → ${e.to} (${e.type})`).join("\n")
      : "(none)";

  const { filename: turboFilename, fence: turboFence } =
    turboConfigLabels(turboConfigFile);
  const turboSection = turboJsonContent
    ? `\n### ${turboFilename}\n\`\`\`${turboFence}\n${turboJsonContent}\n\`\`\`\n`
    : "";

  return `Fix the issues found in this Turborepo monorepo.

## Analysis Results

${analysisOutput}

## Workspace Structure

Apps: ${apps.length}, Packages: ${packages.length}

${fileTree}

## Internal Dependency Graph

${edgeList}
${turboSection}
Generate the step-by-step fix plan now.`;
}
