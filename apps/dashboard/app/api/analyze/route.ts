import Anthropic from "@anthropic-ai/sdk";
import {
  buildAnalysisPrompt,
  buildFixPrompt,
  SYSTEM_PROMPT,
  FIX_SYSTEM_PROMPT,
} from "@/lib/prompts/monorepo-analysis";

const client = new Anthropic();

export async function POST(req: Request) {
  const body = await req.json();
  const {
    apps,
    packages,
    edges,
    turboJsonContent,
    turboConfigFile,
    mode,
    analysisOutput,
  } = body;

  if (!apps || !packages || !edges) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: apps, packages, edges" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  let prompt: string;
  let systemPrompt: string;

  if (mode === "fix") {
    if (!analysisOutput) {
      return new Response(
        JSON.stringify({ error: "Missing analysisOutput for fix mode" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    prompt = buildFixPrompt(analysisOutput, {
      apps,
      packages,
      edges,
      turboJsonContent,
      turboConfigFile,
    });
    systemPrompt = FIX_SYSTEM_PROMPT;
  } else {
    prompt = buildAnalysisPrompt({
      apps,
      packages,
      edges,
      turboJsonContent,
      turboConfigFile,
    });
    systemPrompt = SYSTEM_PROMPT;
  }

  const stream = client.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: prompt }],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Request failed";
        controller.enqueue(encoder.encode(`\n\n**Error:** ${message}`));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
