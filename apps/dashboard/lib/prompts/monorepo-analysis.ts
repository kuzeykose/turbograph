import type { PackageInfo, DependencyEdge } from "@workspace/graph";

interface AnalysisInput {
  apps: PackageInfo[];
  packages: PackageInfo[];
  edges: DependencyEdge[];
  turboJsonContent?: string;
}

export const SYSTEM_PROMPT = `You are a senior monorepo architect specializing in Turborepo workspaces. You analyze dependency graphs and workspace structures to provide concise, actionable feedback.

Format your response in markdown with these sections:
## Dependency Health
Analyze circular dependencies, coupling levels, orphaned packages, and dependency depth.

## Architecture
Evaluate package boundaries, naming conventions, separation of concerns, and shared code organization.

## Turborepo Best Practices
Review turbo.json configuration (if provided), caching strategy, pipeline definitions, and workspace setup.

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
  const { apps, packages, edges, turboJsonContent } = input;

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
    sections.push(`## turbo.json\n\`\`\`json\n${turboJsonContent}\n\`\`\``);
  }

  return sections.join("\n\n");
}
