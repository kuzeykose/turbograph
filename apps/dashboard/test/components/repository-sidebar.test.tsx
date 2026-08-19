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

jest.mock("@/contexts/repository-context", () => ({
  useRepositoryContext: () => ({
    turborepoStructure: { isTurborepo: true },
    turborepoLoading: false,
    activeTab: "files",
    setActiveTab: mockSetActiveTab,
  }),
}));

describe("RepositorySidebar", () => {
  it("shows the Files tab alongside Turborepo navigation", () => {
    render(<RepositorySidebar />);

    expect(screen.getAllByText("Files").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Dependencies").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Imports").length).toBeGreaterThan(0);
  });
});
