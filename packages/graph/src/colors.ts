/**
 * Color definitions for graph nodes by type
 */
export const nodeColors = {
  app: { fill: "oklch(0.65 0.18 265)", stroke: "oklch(0.55 0.2 265)" },
  package: { fill: "oklch(0.7 0.16 180)", stroke: "oklch(0.6 0.18 180)" },
} as const;

/**
 * Color definitions for graph edges by dependency type
 */
export const edgeColors = {
  dependency: "oklch(0.65 0.18 265)",
  devDependency: "oklch(0.72 0.16 85)",
} as const;

/**
 * Fallback hex colors for environments that don't support oklch
 */
export const nodeColorsHex = {
  app: { fill: "#7c3aed", stroke: "#6d28d9" },
  package: { fill: "#14b8a6", stroke: "#0d9488" },
} as const;

export const edgeColorsHex = {
  dependency: "#7c3aed",
  devDependency: "#eab308",
} as const;
