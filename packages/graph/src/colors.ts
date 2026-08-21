/**
 * Color definitions for graph nodes by type
 */
export const nodeColors = {
  app: {
    fill: "oklch(0.52 0.1 265)",
    stroke: "oklch(0.35 0.08 265 / 0.45)",
  },
  package: {
    fill: "oklch(0.55 0.09 180)",
    stroke: "oklch(0.38 0.08 180 / 0.45)",
  },
} as const;

/**
 * Color definitions for graph edges by dependency type
 */
export const edgeColors = {
  dependency: "oklch(0.65 0.18 265)",
  devDependency: "oklch(0.72 0.16 85)",
  import: "oklch(0.62 0.14 330)",
} as const;

/**
 * Fallback hex colors for environments that don't support oklch
 */
export const nodeColorsHex = {
  app: { fill: "#4c4d78", stroke: "rgba(30,28,55,0.45)" },
  package: { fill: "#2f6f66", stroke: "rgba(22,55,50,0.45)" },
} as const;

export const edgeColorsHex = {
  dependency: "#7c3aed",
  devDependency: "#eab308",
  import: "#db2777",
} as const;
