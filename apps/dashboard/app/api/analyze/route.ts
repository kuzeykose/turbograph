import Anthropic from "@anthropic-ai/sdk";
import {
  buildAnalysisPrompt,
  SYSTEM_PROMPT,
} from "@/lib/prompts/monorepo-analysis";

const client = new Anthropic();

export async function POST(req: Request) {
  const body = await req.json();
  const { apps, packages, edges, turboJsonContent } = body;

  if (!apps || !packages || !edges) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: apps, packages, edges" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const prompt = buildAnalysisPrompt({ apps, packages, edges, turboJsonContent });

  const stream = client.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
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
          err instanceof Error ? err.message : "Analysis failed";
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
