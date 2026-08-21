import React from "react";
import { render, screen } from "@testing-library/react";
import { RepositorySidebar } from "@/components/repository-sidebar";

jest.mock("@workspace/ui/icons", () => ({
  Clock: () => <span>Clock</span>,
  BarChart3: () => <span>BarChart3</span>,
  List: () => <span>List</span>,
  Menu: () => <span>Menu</span>,
  Sparkles: () => <span>Sparkles</span>,
  Folder: () => <span>Folder</span>,
  Waypoints: () => <span>Waypoints</span>,
  Lock: () => <span>Lock</span>,
}));

jest.mock("@workspace/ui/components/button", () => ({
  Button: ({ children, ...props }: React.ComponentProps<"button">) => (
    <button {...props}>{children}</button>
  ),
}));

jest.mock("@workspace/ui/components/sheet", () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTrigger: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SheetContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SheetHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SheetTitle: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

const mockSetActiveTab = jest.fn();
/** Swapped per test to render the sidebar as a guest or a signed-in reader. */
let mockAuth: { user: { id: string } | null; loading: boolean } = {
  user: { id: "u1" },
  loading: false,
};

jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => mockAuth,
}));

jest.mock("@/contexts/repository-context", () => ({
  useRepositoryContext: () => ({
    turborepoStructure: { isTurborepo: true },
    turborepoLoading: false,
    activeTab: "files",
    setActiveTab: mockSetActiveTab,
  }),
}));

describe("RepositorySidebar", () => {
  beforeEach(() => {
    mockAuth = { user: { id: "u1" }, loading: false };
  });

  it("shows the Files tab alongside Turborepo navigation", () => {
    render(<RepositorySidebar />);

    expect(screen.getAllByText("Files").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Dependencies").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Imports").length).toBeGreaterThan(0);
  });

  /** Tabs that spend the reader's rate limit or model credits need a session. */
  describe("as a guest", () => {
    const buttonFor = (label: string) =>
      screen
        .getAllByRole("button")
        .filter((b) => b.textContent?.includes(label));

    beforeEach(() => {
      mockAuth = { user: null, loading: false };
    });

    it("offers the gated tabs but does not let a guest open them", () => {
      render(<RepositorySidebar />);

      for (const label of ["Imports", "Files", "AI Analysis"]) {
        const buttons = buttonFor(label);
        expect(buttons.length).toBeGreaterThan(0);
        for (const button of buttons) expect(button).toBeDisabled();
      }
    });

    it("leaves the tabs a guest can use alone", () => {
      render(<RepositorySidebar />);

      for (const label of ["Dependencies", "Commits", "Packages"]) {
        for (const button of buttonFor(label)) {
          expect(button).not.toBeDisabled();
        }
      }
    });

    it("says why a tab is locked", () => {
      render(<RepositorySidebar />);

      const [imports] = buttonFor("Imports");
      expect(imports).toHaveAttribute(
        "title",
        expect.stringContaining("Scanning imports"),
      );
    });

    /** Locking on a half-resolved session flashes every tab shut on load. */
    it("waits for auth to resolve before locking anything", () => {
      mockAuth = { user: null, loading: true };
      render(<RepositorySidebar />);

      for (const button of buttonFor("Imports")) {
        expect(button).not.toBeDisabled();
      }
    });
  });
});
