/**
 * @jest-environment node
 *
 * The analyze route spends model credits per call, so the gate has to hold on
 * the server: hiding the tab does nothing about a direct POST. Runs under the
 * node environment for the fetch globals a route handler is given.
 *
 * The feature flag is mocked on rather than read, so these keep covering the
 * session gate while AI Analysis is held back — the flag itself is covered by
 * its own case below.
 */
const mockFlags = { AI_ANALYSIS_ENABLED: true };
jest.mock("@/lib/feature-flags", () => ({
  get AI_ANALYSIS_ENABLED() {
    return mockFlags.AI_ANALYSIS_ENABLED;
  },
}));

const mockGetUser = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: mockGetUser },
  }),
}));

const mockStream = jest.fn();
jest.mock("@anthropic-ai/sdk", () => ({
  __esModule: true,
  // Wrapped in an arrow so the constructor does not touch `mockStream` at import
  // time, when it is still in the temporal dead zone.
  default: class {
    messages = {
      stream: (...args: unknown[]) => mockStream(...args),
    };
  },
}));

import { POST } from "@/app/api/analyze/route";

function request(body: unknown) {
  return new Request("http://localhost/api/analyze", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const validBody = { apps: [], packages: [], edges: [] };

describe("POST /api/analyze", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockStream.mockReset();
    mockFlags.AI_ANALYSIS_ENABLED = true;
  });

  it("answers 404 while the feature is held back", async () => {
    mockFlags.AI_ANALYSIS_ENABLED = false;
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });

    const response = await POST(request(validBody));

    expect(response.status).toBe(404);
    // Not even a signed-in reader spends credits on a feature that is off.
    expect(mockStream).not.toHaveBeenCalled();
  });

  it("refuses a request with no session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const response = await POST(request(validBody));

    expect(response.status).toBe(401);
    expect(mockStream).not.toHaveBeenCalled();
  });

  it("does not reach the model before checking the session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    // Even a well-formed body must not spend anything.
    await POST(request({ ...validBody, mode: "fix", analysisOutput: "x" }));

    expect(mockStream).not.toHaveBeenCalled();
  });

  it("lets a signed-in reader through", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    // The route iterates the stream and pipes text deltas to the response.
    mockStream.mockReturnValue({
      async *[Symbol.asyncIterator]() {
        yield {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "ok" },
        };
      },
    });

    const response = await POST(request(validBody));

    expect(response.status).not.toBe(401);
    expect(mockStream).toHaveBeenCalled();
  });
});
