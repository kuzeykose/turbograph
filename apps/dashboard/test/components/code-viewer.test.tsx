import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CodeViewer } from "@/components/code-viewer";

jest.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light" }),
}));

jest.mock("@workspace/ui/icons", () => ({
  Check: () => <span>Check</span>,
  Copy: () => <span>Copy</span>,
  FileText: () => <span>FileText</span>,
}));

jest.mock("@/components/syntax-highlighter", () => ({
  SyntaxHighlighter: ({
    children,
    language,
    showLineNumbers,
  }: {
    children: string;
    language: string;
    showLineNumbers?: boolean;
  }) => (
    <pre
      data-testid="syntax-highlighter"
      data-language={language}
      data-line-numbers={showLineNumbers ? "true" : "false"}
    >
      {children}
    </pre>
  ),
  oneDark: {},
  oneLight: {},
}));

describe("CodeViewer", () => {
  const sampleCode = `function greet(name: string) {
  const message = "hello";
  return message + " " + name;
}`;

  it("renders the filename, line count, and detected language", () => {
    render(
      <CodeViewer
        content={sampleCode}
        filename="greet.ts"
        language="typescript"
      />,
    );

    expect(screen.getByText("greet.ts")).toBeInTheDocument();
    expect(screen.getByText(/4 lines · typescript/)).toBeInTheDocument();
  });

  it("passes source through the syntax highlighter", () => {
    render(
      <CodeViewer
        content={sampleCode}
        filename="greet.ts"
        language="typescript"
      />,
    );

    const highlighter = screen.getByTestId("syntax-highlighter");
    expect(highlighter).toHaveAttribute("data-language", "typescript");
    expect(highlighter).toHaveAttribute("data-line-numbers", "true");
    expect(highlighter).toHaveTextContent("function greet");
  });

  it("shows a binary-file placeholder instead of source", () => {
    render(
      <CodeViewer
        content="[Binary file - cannot display]"
        filename="photo.png"
        language="text"
      />,
    );

    expect(screen.getAllByText("Binary file").length).toBeGreaterThan(0);
    expect(
      screen.getByText("This file cannot be displayed in the browser"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Copy")).not.toBeInTheDocument();
  });

  it("copies file contents to the clipboard", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText },
    });

    render(
      <CodeViewer
        content={sampleCode}
        filename="greet.ts"
        language="typescript"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /copy/i }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(sampleCode);
      expect(screen.getByText("Copied!")).toBeInTheDocument();
    });
  });
});
