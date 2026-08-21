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

  describe("Renderer selection", () => {
    /** Above the canvas threshold the graph stops emitting one element per node. */
    function largeGraph(count: number) {
      const packages: PackageInfo[] = Array.from(
        { length: count },
        (_, i) => ({
          name: `pkg-${i}`,
          path: `packages/pkg-${i}`,
          dependencies: {},
          devDependencies: {},
        }),
      );
      const dependencies: DependencyEdge[] = Array.from(
        { length: count - 1 },
        (_, i) => ({
          from: `pkg-${i + 1}`,
          to: `pkg-${i}`,
          type: "dependency" as const,
        }),
      );
      return { packages, dependencies };
    }

    it("uses SVG for package-scale graphs", () => {
      const { container } = render(
        <TurborepoGraphVisual
          apps={mockApps}
          packages={mockPackages}
          dependencies={mockDependencies}
        />,
      );

      expect(container.querySelector("svg")).toBeInTheDocument();
      expect(container.querySelector("canvas")).not.toBeInTheDocument();
    });

    it("frames the graph by writing the SVG viewBox", async () => {
      const { container } = render(
        <TurborepoGraphVisual
          apps={mockApps}
          packages={mockPackages}
          dependencies={mockDependencies}
        />,
      );

      // The viewBox is applied imperatively now, not as a React prop.
      await waitFor(() => {
        const viewBox = container.querySelector("svg")?.getAttribute("viewBox");
        expect(viewBox).toBeTruthy();
        expect(viewBox!.split(" ")).toHaveLength(4);
        for (const part of viewBox!.split(" ")) {
          expect(Number.isFinite(Number(part))).toBe(true);
        }
      });
    });

    it("switches to canvas for import-scale graphs", async () => {
      const { packages, dependencies } = largeGraph(400);
      const { container } = render(
        <TurborepoGraphVisual
          apps={[]}
          packages={packages}
          dependencies={dependencies}
        />,
      );

      await waitFor(() => {
        expect(container.querySelector("canvas")).toBeInTheDocument();
      });
      // The 400 node cards and their edges are no longer live DOM.
      expect(container.querySelectorAll(".nodes > g")).toHaveLength(0);
      expect(container.querySelectorAll(".edges path")).toHaveLength(0);
    });
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
        const groups = container.querySelectorAll(".nodes > g");
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

  describe("Node placement", () => {
    /** jsdom reports zero-sized elements, which makes graph<->client mapping degenerate. */
    function stubLayout() {
      const rect = {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        width: 900,
        height: 550,
        right: 900,
        bottom: 550,
        toJSON: () => {},
      } as DOMRect;
      jest
        .spyOn(HTMLElement.prototype, "getBoundingClientRect")
        .mockImplementation(() => rect);
    }

    const graph = () => (
      <TurborepoGraphVisual
        apps={mockApps}
        packages={mockPackages}
        dependencies={mockDependencies}
      />
    );

    /** Nodes are addressed by name; the layout may emit them in any order. */
    const transformOf = (container: HTMLElement, name: string) =>
      [...container.querySelectorAll(".nodes > g")]
        .find((g) => g.querySelector("title")?.textContent === name)
        ?.getAttribute("transform");

    function dragFirstNode(container: HTMLElement) {
      const svg = container.querySelector(".nodes")!.closest("svg")!;
      const node = container.querySelectorAll(".nodes > g")[0]!;
      const name = node.querySelector("title")!.textContent!;
      fireEvent.mouseDown(node, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(svg, { clientX: 300, clientY: 220 });
      fireEvent.mouseUp(svg, { clientX: 300, clientY: 220 });
      return name;
    }

    it("moves a node to where it was dropped", () => {
      stubLayout();
      const { container } = render(graph());

      const name = container
        .querySelector(".nodes > g title")!
        .textContent!;
      const before = transformOf(container, name);
      dragFirstNode(container);

      expect(transformOf(container, name)).not.toBe(before);
    });

    /**
     * Every tab switch unmounts the graph, and the layout is recomputed from
     * scratch on mount — so without remembered placements a manual arrangement
     * only survives until the user looks at another tab.
     */
    it("restores dropped positions when the graph is mounted again", () => {
      stubLayout();
      const first = render(graph());
      const name = dragFirstNode(first.container);
      const dropped = transformOf(first.container, name);
      first.unmount();

      const second = render(graph());

      expect(transformOf(second.container, name)).toBe(dropped);
    });

    /** The same workspace listed in a different order is the same graph. */
    it("keeps placements when the input arrays are reordered", () => {
      stubLayout();
      const first = render(graph());
      const name = dragFirstNode(first.container);
      const dropped = transformOf(first.container, name);
      first.unmount();

      const second = render(
        <TurborepoGraphVisual
          apps={[...mockApps].reverse()}
          packages={[...mockPackages].reverse()}
          dependencies={[...mockDependencies].reverse()}
        />,
      );

      expect(transformOf(second.container, name)).toBe(dropped);
    });
  });

  describe("Focus on selection", () => {
    const hub = "hub";
    const users = ["user-a", "user-b", "user-c"];
    const unrelated = ["other-a", "other-b"];
    /** A node with no edges at all, to check the fallback. */
    const island = "island";
    const focusPackages: PackageInfo[] = [
      hub,
      ...users,
      ...unrelated,
      island,
    ].map(
      (name) => ({
        name,
        path: `packages/${name}`,
        dependencies: {},
        devDependencies: {},
      }),
    );
    const focusDeps: DependencyEdge[] = [
      ...users.map((u) => ({ from: u, to: hub, type: "dependency" as const })),
      { from: "other-b", to: "other-a", type: "dependency" as const },
    ];

    const nodeNames = (container: HTMLElement) =>
      [...container.querySelectorAll(".nodes > g title")].map(
        (t) => t.textContent,
      );

    const topmost = (container: HTMLElement) => {
      const nodes = [...container.querySelectorAll(".nodes > g")].map((g) => ({
        name: g.querySelector("title")!.textContent,
        y: Number(g.getAttribute("transform")!.match(/,\s*([-\d.]+)/)![1]),
      }));
      const top = Math.min(...nodes.map((n) => n.y));
      return nodes.filter((n) => n.y === top).map((n) => n.name);
    };

    it("re-roots the graph at the node that was clicked", () => {
      const { container } = render(
        <TurborepoGraphVisual
          apps={[]}
          packages={focusPackages}
          dependencies={focusDeps}
        />,
      );

      expect(nodeNames(container)).toHaveLength(focusPackages.length);

      const node = [...container.querySelectorAll(".nodes > g")].find(
        (g) => g.querySelector("title")?.textContent === hub,
      )!;
      fireEvent.click(node);

      // Only the hub and its direct neighbours survive, hub alone on top since
      // it has no dependencies of its own here.
      expect(nodeNames(container).sort()).toEqual([hub, ...users].sort());
      expect(topmost(container)).toEqual([hub]);
    });

    it("restores the whole graph from the main tab", () => {
      const { container } = render(
        <TurborepoGraphVisual
          apps={[]}
          packages={focusPackages}
          dependencies={focusDeps}
        />,
      );

      const node = [...container.querySelectorAll(".nodes > g")].find(
        (g) => g.querySelector("title")?.textContent === hub,
      )!;
      fireEvent.click(node);
      expect(nodeNames(container)).toHaveLength(4);

      fireEvent.click(screen.getByRole("tab", { name: "Graph" }));

      expect(nodeNames(container)).toHaveLength(focusPackages.length);
    });

    it("keeps the node's tab open after returning to the main graph", () => {
      const { container } = render(
        <TurborepoGraphVisual
          apps={[]}
          packages={focusPackages}
          dependencies={focusDeps}
        />,
      );

      const node = [...container.querySelectorAll(".nodes > g")].find(
        (g) => g.querySelector("title")?.textContent === hub,
      )!;
      fireEvent.click(node);
      fireEvent.click(screen.getByRole("tab", { name: "Graph" }));

      // The tab stays in the header, so the view is one click away again.
      fireEvent.click(screen.getByRole("tab", { name: hub }));
      expect(nodeNames(container)).toHaveLength(4);

      fireEvent.click(screen.getByLabelText(`Close ${hub}`));
      expect(screen.queryByRole("tab", { name: hub })).not.toBeInTheDocument();
      expect(nodeNames(container)).toHaveLength(focusPackages.length);
    });

    it("shows what the clicked node uses when nothing uses it", () => {
      const { container } = render(
        <TurborepoGraphVisual
          apps={[]}
          packages={focusPackages}
          dependencies={focusDeps}
        />,
      );

      const node = [...container.querySelectorAll(".nodes > g")].find(
        (g) => g.querySelector("title")?.textContent === "user-a",
      )!;
      fireEvent.click(node);

      expect(nodeNames(container).sort()).toEqual(["hub", "user-a"]);
    });

    /** Selecting a node with no edges at all must not collapse the view. */
    it("keeps the graph whole when the clicked node stands alone", () => {
      const { container } = render(
        <TurborepoGraphVisual
          apps={[]}
          packages={focusPackages}
          dependencies={focusDeps}
        />,
      );

      const node = [...container.querySelectorAll(".nodes > g")].find(
        (g) => g.querySelector("title")?.textContent === island,
      )!;
      fireEvent.click(node);

      expect(nodeNames(container)).toHaveLength(focusPackages.length);
    });
  });

  describe("Framing around the details panel", () => {
    const SURFACE_WIDTH = 900;
    const SURFACE_HEIGHT = 550;
    const PANEL_WIDTH = 320;

    /** jsdom has no layout, so the surface and the panel need sizes of their own. */
    function stubSurface() {
      jest
        .spyOn(HTMLElement.prototype, "getBoundingClientRect")
        .mockImplementation(function (this: HTMLElement) {
          const width =
            this.tagName === "ASIDE" ? PANEL_WIDTH : SURFACE_WIDTH;
          return {
            x: 0,
            y: 0,
            top: 0,
            left: 0,
            width,
            height: SURFACE_HEIGHT,
            right: width,
            bottom: SURFACE_HEIGHT,
            toJSON: () => {},
          } as DOMRect;
        });
      Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
        configurable: true,
        get(this: HTMLElement) {
          return this.tagName === "ASIDE" ? PANEL_WIDTH : SURFACE_WIDTH;
        },
      });
    }

    /** Where a graph x lands on screen, from the viewBox the SVG is painted with. */
    function screenX(container: HTMLElement, graphX: number) {
      const svg = container.querySelector(".nodes")!.closest("svg")!;
      const [viewX, , viewWidth] = svg
        .getAttribute("viewBox")!
        .split(" ")
        .map(Number) as [number, number, number, number];
      return (graphX - viewX) * (SURFACE_WIDTH / viewWidth);
    }

    const contentCentre = (container: HTMLElement) => {
      const xs = [...container.querySelectorAll(".nodes > g")].map((g) =>
        Number(g.getAttribute("transform")!.match(/\(([-\d.]+)/)![1]),
      );
      return (Math.min(...xs) + Math.max(...xs)) / 2;
    };

    /** The panel covers the right of the surface; the graph belongs beside it. */
    it("centres the graph in what the panel leaves visible", async () => {
      stubSurface();
      const { container } = render(
        <TurborepoGraphVisual
          apps={mockApps}
          packages={mockPackages}
          dependencies={mockDependencies}
        />,
      );

      const node = [...container.querySelectorAll(".nodes > g")].find(
        (g) => g.querySelector("title")?.textContent === "@repo/ui",
      )!;
      fireEvent.click(node);
      // The viewBox is written from an animation frame, not during the commit.
      await new Promise((resolve) => setTimeout(resolve, 60));

      expect(container.querySelector("aside")).not.toBeNull();
      const visibleCentre = (SURFACE_WIDTH - PANEL_WIDTH) / 2;
      expect(screenX(container, contentCentre(container))).toBeCloseTo(
        visibleCentre,
        0,
      );
    });

    it("uses the whole surface when no panel is open", () => {
      stubSurface();
      const { container } = render(
        <TurborepoGraphVisual
          apps={mockApps}
          packages={mockPackages}
          dependencies={mockDependencies}
        />,
      );

      expect(container.querySelector("aside")).toBeNull();
      expect(screenX(container, contentCentre(container))).toBeCloseTo(
        SURFACE_WIDTH / 2,
        0,
      );
    });
  });

  describe("Search", () => {
    const typeSearch = (value: string) => {
      const input = screen.getByRole("searchbox", { name: /search packages/i });
      fireEvent.change(input, { target: { value } });
      return input;
    };

    it("offers nothing until something is typed", () => {
      render(
        <TurborepoGraphVisual
          apps={mockApps}
          packages={mockPackages}
          dependencies={mockDependencies}
        />,
      );

      expect(screen.queryAllByRole("option")).toHaveLength(0);
    });

    it("lists the nodes matching what was typed", () => {
      render(
        <TurborepoGraphVisual
          apps={mockApps}
          packages={mockPackages}
          dependencies={mockDependencies}
        />,
      );

      typeSearch("ui");

      const options = screen.getAllByRole("option");
      expect(options).toHaveLength(1);
      expect(options[0]).toHaveTextContent("ui");
    });

    it("opens a result as a tab and clears itself", () => {
      const { container } = render(
        <TurborepoGraphVisual
          apps={mockApps}
          packages={mockPackages}
          dependencies={mockDependencies}
        />,
      );

      const input = typeSearch("utils");
      fireEvent.click(screen.getByRole("option", { name: /utils/i }));

      expect(screen.getByRole("tab", { name: "@repo/utils" })).toBeInTheDocument();
      expect((input as HTMLInputElement).value).toBe("");
      expect(container.querySelector("aside")).not.toBeNull();
    });

    it("opens the first result on Enter", () => {
      render(
        <TurborepoGraphVisual
          apps={mockApps}
          packages={mockPackages}
          dependencies={mockDependencies}
        />,
      );

      const input = typeSearch("web");
      fireEvent.keyDown(input, { key: "Enter" });

      expect(screen.getByRole("tab", { name: "web" })).toBeInTheDocument();
    });

    it("clears on Escape without opening anything", () => {
      render(
        <TurborepoGraphVisual
          apps={mockApps}
          packages={mockPackages}
          dependencies={mockDependencies}
        />,
      );

      const input = typeSearch("web");
      fireEvent.keyDown(input, { key: "Escape" });

      expect((input as HTMLInputElement).value).toBe("");
      expect(screen.queryByRole("tab", { name: "web" })).not.toBeInTheDocument();
    });

    /** A node tab shows one subtree; search still has to reach the whole graph. */
    it("finds nodes that the open tab's view leaves out", () => {
      const { container } = render(
        <TurborepoGraphVisual
          apps={mockApps}
          packages={mockPackages}
          dependencies={mockDependencies}
        />,
      );

      const node = [...container.querySelectorAll(".nodes > g")].find(
        (g) => g.querySelector("title")?.textContent === "@repo/ui",
      )!;
      fireEvent.click(node);

      typeSearch("utils");
      expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
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
        const nodeGroups = container.querySelectorAll(".nodes > g");
        expect(nodeGroups.length).toBeGreaterThan(0);
      });

      const nodeGroups = container.querySelectorAll(".nodes > g");
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
