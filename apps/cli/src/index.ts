#!/usr/bin/env node

import { Command } from "commander";
import * as fs from "node:fs";
import * as path from "node:path";
import chalk from "chalk";
import {
  buildDependencyGraph,
  calculateGraphLayout,
  generateSvgDocument,
} from "@workspace/graph";
import { analyzeTurborepo, resolveTurboConfigFile } from "./analyzer.js";

const program = new Command();

program
  .name("trbgraph")
  .description("Generate dependency graphs for Turborepo workspaces")
  .version("0.0.1");

program
  .option("-o, --output <filename>", "Output filename", "graph.svg")
  .option("-w, --width <number>", "SVG width in pixels", "900")
  .option("-h, --height <number>", "SVG height in pixels", "550")
  .option("--no-grid", "Disable grid background")
  .option("-d, --dir <path>", "Root directory of the turborepo", process.cwd())
  .action(async (options) => {
    const rootDir = path.resolve(options.dir);

    console.log(chalk.blue("🔍 Analyzing Turborepo workspace..."));

    // Check if this is a Turborepo
    if (!resolveTurboConfigFile(rootDir)) {
      console.error(
        chalk.red(
          "❌ Error: No turbo.json or turbo.jsonc found. Is this a Turborepo?"
        )
      );
      process.exit(1);
    }

    // Analyze the workspace
    const structure = await analyzeTurborepo(rootDir);

    if (structure.apps.length === 0 && structure.packages.length === 0) {
      console.error(chalk.yellow("⚠️  No packages found in the workspace."));
      process.exit(1);
    }

    console.log(
      chalk.green(
        `✓ Found ${structure.apps.length} apps and ${structure.packages.length} packages`
      )
    );

    // Build dependency graph
    const dependencies = buildDependencyGraph(
      structure.apps,
      structure.packages,
      structure.workspacePackages
    );

    console.log(chalk.green(`✓ Found ${dependencies.length} dependencies`));

    // Calculate layout
    const width = parseInt(options.width, 10);
    const height = parseInt(options.height, 10);
    const { nodes, edges } = calculateGraphLayout(
      structure.apps,
      structure.packages,
      dependencies,
      { width, height }
    );

    // Generate SVG
    const svg = generateSvgDocument(nodes, edges, {
      width,
      height,
      showGrid: options.grid !== false,
    });

    // Write output file
    const outputPath = path.resolve(options.output);
    fs.writeFileSync(outputPath, svg, "utf-8");

    console.log(chalk.green(`✓ Graph saved to ${chalk.bold(outputPath)}`));

    // Print summary
    console.log();
    console.log(chalk.dim("Summary:"));
    console.log(
      chalk.dim(
        `  Apps: ${structure.apps.map((a: { name: string }) => a.name).join(", ") || "(none)"}`
      )
    );
    console.log(
      chalk.dim(
        `  Packages: ${structure.packages.map((p: { name: string }) => p.name).join(", ") || "(none)"}`
      )
    );
  });

program.parse();
