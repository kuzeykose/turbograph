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

      expect(
        screen.getByRole("group", { name: /Graph column order/i }),
      ).toBeInTheDocument();
      expect(screen.getByTitle("Fit View")).toBeInTheDocument();
    });

    it("should render header controls", () => {
      render(
        <TurborepoGraphVisual
          apps={mockApps}
          packages={mockPackages}
          dependencies={mockDependencies}
        />,
      );

      expect(screen.getByTitle("Zoom In")).toBeInTheDocument();
      expect(screen.getByTitle("Zoom Out")).toBeInTheDocument();
      expect(screen.getByTitle("Fit View")).toBeInTheDocument();
    });

    it("should render legend", () => {
      render(
        <TurborepoGraphVisual
          apps={mockApps}
          packages={mockPackages}
          dependencies={mockDependencies}
        />,
      );

      expect(screen.getByText("Nodes")).toBeInTheDocument();
      expect(screen.getByText("Application")).toBeInTheDocument();
      expect(screen.getByText("Package")).toBeInTheDocument();
      expect(screen.getByText("Dependency")).toBeInTheDocument();
      expect(screen.getByText("Dev")).toBeInTheDocument();
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
    it("should render all graph nodes", async () => {
      const { container } = render(
        <TurborepoGraphVisual
          apps={mockApps}
          packages={mockPackages}
          dependencies={mockDependencies}
        />,
      );

      await waitFor(() => {
        const groups = container.querySelectorAll(".nodes g");
        expect(groups.length).toBe(4);
      });
    });

    it("should render node cards as rects", async () => {
      const { container } = render(
        <TurborepoGraphVisual
          apps={mockApps}
          packages={mockPackages}
          dependencies={mockDependencies}
        />,
      );

      await waitFor(() => {
        const rects = container.querySelectorAll(".nodes rect");
        expect(rects.length).toBe(4);
      });
    });

    it("should truncate long node names in the label", () => {
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
      expect(text?.textContent).toMatch(/…/);
    });
  });

  describe("Edge Rendering", () => {
    it("should render dependency edges as paths", async () => {
      const { container } = render(
        <TurborepoGraphVisual
          apps={mockApps}
          packages={mockPackages}
          dependencies={mockDependencies}
        />,
      );

      await waitFor(() => {
        const paths = container.querySelectorAll(".edges path");
        expect(paths.length).toBe(mockDependencies.length);
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
        const paths = container.querySelectorAll(".edges path");
        paths.forEach((path) => {
          const markerEnd = path.getAttribute("marker-end");
          expect(markerEnd).toMatch(/url\(#arrow-(dependency|devDependency)\)/);
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
        const path = container.querySelector(".edges path");
        const markerEnd = path?.getAttribute("marker-end");
        expect(markerEnd).toContain("devDependency");
      });
    });
  });

  describe("Interactions", () => {
    it("should handle fit view button click", () => {
      render(
        <TurborepoGraphVisual
          apps={mockApps}
          packages={mockPackages}
          dependencies={mockDependencies}
        />,
      );

      const fitButton = screen.getByTitle("Fit View");
      fireEvent.click(fitButton);

      expect(fitButton).toBeInTheDocument();
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
        fireEvent.wheel(svg, { deltaY: -100 });
        fireEvent.wheel(svg, { deltaY: 100 });
      }

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

      expect(screen.getByTitle("Fit View")).toBeInTheDocument();
    });

    it("should handle empty packages array", () => {
      render(
        <TurborepoGraphVisual
          apps={mockApps}
          packages={[]}
          dependencies={[]}
        />,
      );

      expect(screen.getByTitle("Fit View")).toBeInTheDocument();
    });

    it("should handle empty dependencies array", () => {
      const { container } = render(
        <TurborepoGraphVisual
          apps={mockApps}
          packages={mockPackages}
          dependencies={[]}
        />,
      );

      const paths = container.querySelectorAll(".edges path");
      expect(paths.length).toBe(0);
    });

    it("should handle completely empty data", () => {
      render(
        <TurborepoGraphVisual apps={[]} packages={[]} dependencies={[]} />,
      );

      expect(screen.getByText("Nodes")).toBeInTheDocument();
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

      expect(screen.getByTitle("Fit View")).toBeInTheDocument();
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

      expect(screen.getByTitle("Fit View")).toBeInTheDocument();
    });
  });

  describe("Layout", () => {
    it("should position nodes with transform", async () => {
      const { container } = render(
        <TurborepoGraphVisual
          apps={mockApps}
          packages={mockPackages}
          dependencies={mockDependencies}
        />,
      );

      await waitFor(() => {
        const nodeGroups = container.querySelectorAll(".nodes g");
        expect(nodeGroups.length).toBeGreaterThan(0);
      });

      const nodeGroups = container.querySelectorAll(".nodes g");
      nodeGroups.forEach((node) => {
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

      const depMarker = container.querySelector("#arrow-dependency");
      const devDepMarker = container.querySelector("#arrow-devDependency");

      expect(depMarker).toBeInTheDocument();
      expect(devDepMarker).toBeInTheDocument();
    });
  });
});
