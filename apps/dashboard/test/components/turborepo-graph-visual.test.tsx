import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TurborepoGraphVisual } from "@/components/turborepo-graph-visual";
import { PackageInfo, DependencyEdge } from "@/lib/utils/turborepo";

describe("TurborepoGraphVisual", () => {
  const mockApps: PackageInfo[] = [
    {
      name: "web",
      path: "apps/web",
      dependencies: { "@repo/ui": "1.0.0" },
      devDependencies: {},
    },
    {
      name: "docs",
      path: "apps/docs",
      dependencies: { "@repo/ui": "1.0.0" },
      devDependencies: {},
    },
  ];

  const mockPackages: PackageInfo[] = [
    {
      name: "@repo/ui",
      path: "packages/ui",
      dependencies: {},
      devDependencies: {},
    },
    {
      name: "@repo/utils",
      path: "packages/utils",
      dependencies: {},
      devDependencies: {},
    },
  ];

  const mockDependencies: DependencyEdge[] = [
    {
      from: "web",
      to: "@repo/ui",
      type: "dependency",
    },
    {
      from: "docs",
      to: "@repo/ui",
      type: "dependency",
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render the component without crashing", () => {
      render(
        <TurborepoGraphVisual
          apps={mockApps}
          packages={mockPackages}
          dependencies={mockDependencies}
        />,
      );

      expect(screen.getByText("Reset View")).toBeInTheDocument();
      expect(screen.getByText("Clear Selection")).toBeInTheDocument();
    });

    it("should render control buttons", () => {
      render(
        <TurborepoGraphVisual
          apps={mockApps}
          packages={mockPackages}
          dependencies={mockDependencies}
        />,
      );

      expect(screen.getByText("Reset View")).toBeInTheDocument();
      expect(screen.getByText("Clear Selection")).toBeInTheDocument();
    });

    it("should render instructions panel", () => {
      render(
        <TurborepoGraphVisual
          apps={mockApps}
          packages={mockPackages}
          dependencies={mockDependencies}
        />,
      );

      expect(screen.getByText("Controls:")).toBeInTheDocument();
      expect(
        screen.getByText("• Drag nodes to reposition"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("• Click node to highlight connections"),
      ).toBeInTheDocument();
      expect(screen.getByText("• Drag background to pan")).toBeInTheDocument();
      expect(screen.getByText("• Scroll to zoom")).toBeInTheDocument();
    });

    it("should render legend", () => {
      render(
        <TurborepoGraphVisual
          apps={mockApps}
          packages={mockPackages}
          dependencies={mockDependencies}
        />,
      );

      expect(screen.getByText("Legend")).toBeInTheDocument();
      expect(screen.getByText("Application")).toBeInTheDocument();
      expect(screen.getByText("Package")).toBeInTheDocument();
      expect(screen.getByText("Dependency")).toBeInTheDocument();
      expect(screen.getByText("Dev Dependency")).toBeInTheDocument();
    });

    it("should render SVG graph", () => {
      const { container } = render(
        <TurborepoGraphVisual
          apps={mockApps}
          packages={mockPackages}
          dependencies={mockDependencies}
        />,
      );

      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });
  });

  describe("Node Rendering", () => {
    it("should render all app nodes", async () => {
      const { container } = render(
        <TurborepoGraphVisual
          apps={mockApps}
          packages={mockPackages}
          dependencies={mockDependencies}
        />,
      );

      await waitFor(() => {
        const nodes = container.querySelectorAll(".nodes g");
        expect(nodes.length).toBe(4); // 2 apps + 2 packages
      });
    });

    it("should render all package nodes", async () => {
      const { container } = render(
        <TurborepoGraphVisual
          apps={mockApps}
          packages={mockPackages}
          dependencies={mockDependencies}
        />,
      );

      await waitFor(() => {
        const circles = container.querySelectorAll(".nodes circle");
        expect(circles.length).toBeGreaterThan(0);
      });
    });

    it("should truncate long node names", () => {
      const longNameApps: PackageInfo[] = [
        {
          name: "very-long-application-name-that-should-be-truncated",
          path: "apps/long",
          dependencies: {},
          devDependencies: {},
        },
      ];

      const { container } = render(
        <TurborepoGraphVisual
          apps={longNameApps}
          packages={[]}
          dependencies={[]}
        />,
      );

      const text = container.querySelector(".nodes text");
      expect(text?.textContent).toMatch(/\.\.\./);
    });
  });

  describe("Edge Rendering", () => {
    it("should render dependency edges", async () => {
      const { container } = render(
        <TurborepoGraphVisual
          apps={mockApps}
          packages={mockPackages}
          dependencies={mockDependencies}
        />,
      );

      await waitFor(() => {
        const edges = container.querySelectorAll(".edges line");
        expect(edges.length).toBe(mockDependencies.length);
      });
    });

    it("should render edges with correct arrow markers", async () => {
      const { container } = render(
        <TurborepoGraphVisual
          apps={mockApps}
          packages={mockPackages}
          dependencies={mockDependencies}
        />,
      );

      await waitFor(() => {
        const edges = container.querySelectorAll(".edges line");
        edges.forEach((edge) => {
          const markerEnd = edge.getAttribute("marker-end");
          expect(markerEnd).toMatch(
            /url\(#arrowhead-(dependency|devDependency)\)/,
          );
        });
      });
    });

    it("should handle dev dependencies differently", async () => {
      const devDepDependencies: DependencyEdge[] = [
        {
          from: "web",
          to: "@repo/utils",
          type: "devDependency",
        },
      ];

      const { container } = render(
        <TurborepoGraphVisual
          apps={mockApps}
          packages={mockPackages}
          dependencies={devDepDependencies}
        />,
      );

      await waitFor(() => {
        const edge = container.querySelector(".edges line");
        const markerEnd = edge?.getAttribute("marker-end");
        expect(markerEnd).toContain("devDependency");
      });
    });
  });

  describe("Interactions", () => {
    it("should handle reset view button click", () => {
      render(
        <TurborepoGraphVisual
          apps={mockApps}
          packages={mockPackages}
          dependencies={mockDependencies}
        />,
      );

      const resetButton = screen.getByText("Reset View");
      fireEvent.click(resetButton);

      // The component should not crash and button should still be there
      expect(resetButton).toBeInTheDocument();
    });

    it("should handle clear selection button click", () => {
      render(
        <TurborepoGraphVisual
          apps={mockApps}
          packages={mockPackages}
          dependencies={mockDependencies}
        />,
      );

      const clearButton = screen.getByText("Clear Selection");
      fireEvent.click(clearButton);

      // The component should not crash
      expect(clearButton).toBeInTheDocument();
    });

    it("should handle wheel event for zooming", () => {
      const { container } = render(
        <TurborepoGraphVisual
          apps={mockApps}
          packages={mockPackages}
          dependencies={mockDependencies}
        />,
      );

      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();

      if (svg) {
        // Simulate zoom in
        fireEvent.wheel(svg, { deltaY: -100 });

        // Simulate zoom out
        fireEvent.wheel(svg, { deltaY: 100 });
      }

      // Component should handle zoom without crashing
      expect(svg).toBeInTheDocument();
    });

    it("should handle mouse down on SVG for panning", () => {
      const { container } = render(
        <TurborepoGraphVisual
          apps={mockApps}
          packages={mockPackages}
          dependencies={mockDependencies}
        />,
      );

      const svg = container.querySelector("svg");
      if (svg) {
        fireEvent.mouseDown(svg, { button: 0, clientX: 100, clientY: 100 });
        fireEvent.mouseMove(svg, { clientX: 150, clientY: 150 });
        fireEvent.mouseUp(svg);
      }

      expect(svg).toBeInTheDocument();
    });
  });

  describe("Empty States", () => {
    it("should handle empty apps array", () => {
      render(
        <TurborepoGraphVisual
          apps={[]}
          packages={mockPackages}
          dependencies={[]}
        />,
      );

      expect(screen.getByText("Reset View")).toBeInTheDocument();
    });

    it("should handle empty packages array", () => {
      render(
        <TurborepoGraphVisual
          apps={mockApps}
          packages={[]}
          dependencies={[]}
        />,
      );

      expect(screen.getByText("Reset View")).toBeInTheDocument();
    });

    it("should handle empty dependencies array", () => {
      const { container } = render(
        <TurborepoGraphVisual
          apps={mockApps}
          packages={mockPackages}
          dependencies={[]}
        />,
      );

      const edges = container.querySelectorAll(".edges line");
      expect(edges.length).toBe(0);
    });

    it("should handle completely empty data", () => {
      render(
        <TurborepoGraphVisual apps={[]} packages={[]} dependencies={[]} />,
      );

      expect(screen.getByText("Legend")).toBeInTheDocument();
    });
  });

  describe("Single Item Cases", () => {
    it("should handle single app", () => {
      const singleApp: PackageInfo[] = [mockApps[0]];

      render(
        <TurborepoGraphVisual
          apps={singleApp}
          packages={[]}
          dependencies={[]}
        />,
      );

      expect(screen.getByText("Reset View")).toBeInTheDocument();
    });

    it("should handle single package", () => {
      const singlePackage: PackageInfo[] = [mockPackages[0]];

      render(
        <TurborepoGraphVisual
          apps={[]}
          packages={singlePackage}
          dependencies={[]}
        />,
      );

      expect(screen.getByText("Reset View")).toBeInTheDocument();
    });
  });

  describe("Force Simulation", () => {
    it("should apply force simulation to nodes", async () => {
      const { container } = render(
        <TurborepoGraphVisual
          apps={mockApps}
          packages={mockPackages}
          dependencies={mockDependencies}
        />,
      );

      // Wait for initial render
      await waitFor(() => {
        const nodes = container.querySelectorAll(".nodes g");
        expect(nodes.length).toBeGreaterThan(0);
      });

      // Nodes should be positioned (transform attribute should exist)
      const nodes = container.querySelectorAll(".nodes g");
      nodes.forEach((node) => {
        expect(node.getAttribute("transform")).toBeTruthy();
      });
    });
  });

  describe("Marker Definitions", () => {
    it("should define arrow markers for dependencies", () => {
      const { container } = render(
        <TurborepoGraphVisual
          apps={mockApps}
          packages={mockPackages}
          dependencies={mockDependencies}
        />,
      );

      const depMarker = container.querySelector("#arrowhead-dependency");
      const devDepMarker = container.querySelector("#arrowhead-devDependency");

      expect(depMarker).toBeInTheDocument();
      expect(devDepMarker).toBeInTheDocument();
    });
  });
});
