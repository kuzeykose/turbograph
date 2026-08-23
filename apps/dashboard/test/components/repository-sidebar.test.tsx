import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { RepositorySidebar } from "@/components/repository-sidebar";

jest.mock("@workspace/ui/icons", () => ({
  Clock: () => <span>Clock</span>,
  BarChart3: () => <span>BarChart3</span>,
  List: () => <span>List</span>,
  Menu: () => <span>Menu</span>,
  Sparkles: () => <span>Sparkles</span>,
  Folder: () => <span>Folder</span>,
  Waypoints: () => <span>Waypoints</span>,
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

// AI Analysis is held back behind a flag; the rest of the nav is unaffected.
jest.mock("@/lib/feature-flags", () => ({ AI_ANALYSIS_ENABLED: false }));

const mockSetActiveTab = jest.fn();

jest.mock("@/contexts/repository-context", () => ({
  useRepositoryContext: () => ({
    turborepoStructure: { isTurborepo: true },
    turborepoLoading: false,
    activeTab: "files",
    setActiveTab: mockSetActiveTab,
  }),
}));

describe("RepositorySidebar", () => {
  const buttonFor = (label: string) =>
    screen.getAllByRole("button").filter((b) => b.textContent?.includes(label));

  beforeEach(() => {
    mockSetActiveTab.mockClear();
  });

  it("shows the Files tab alongside Turborepo navigation", () => {
    render(<RepositorySidebar />);

    expect(screen.getAllByText("Files").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Dependencies").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Imports").length).toBeGreaterThan(0);
  });

  /**
   * The tabs that need a session are offered like any other: opening one shows
   * the reader what signing in buys them, which a dead button never could.
   */
  it("offers every tab the same way, session or not", () => {
    render(<RepositorySidebar />);

    for (const label of ["Imports", "Files"]) {
      const buttons = buttonFor(label);
      expect(buttons.length).toBeGreaterThan(0);
      for (const button of buttons) expect(button).not.toBeDisabled();
    }

    fireEvent.click(buttonFor("Imports")[0]!);
    expect(mockSetActiveTab).toHaveBeenCalledWith("imports");
  });

  /**
   * A feature that is not being offered has to be absent from the nav, not just
   * from the page it opens — an entry that leads nowhere is worse than none.
   */
  it("leaves AI Analysis out while the feature is off", () => {
    render(<RepositorySidebar />);

    expect(screen.queryByText("AI Analysis")).toBeNull();
  });
});
