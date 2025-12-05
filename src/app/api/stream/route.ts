import type { NextRequest } from "next/server";
import type { RunResult } from "@/lib/types";
import {
  availableModels,
  getGatewayCompletionsUrl,
  cleanKeystrokes,
} from "@/lib/ai-gateway";
import {
  getOfflineSolution,
  hasOfflineSolution,
} from "@/lib/offline-library";

const SYSTEM_PROMPT = `You are an expert Vim golfer competing for the MINIMUM keystroke count. Every keystroke matters.

CRITICAL RULES:
1. Output ONLY raw Vim keystrokes - NO markdown, NO code blocks, NO quotes, NO explanations
2. Use standard Vim notation: <Esc>, <CR>, <BS> for special keys
3. BE EXTREMELY EFFICIENT - use regex substitutions, global commands, and macros
4. NEVER generate repetitive sequences like jddjddjdd... - use ranges and commands instead
5. Maximum ~100 keystrokes for most challenges - think before you type
6. Cursor starts at 0,0 in Normal mode

EFFICIENCY EXAMPLES:
BAD (manual edits):  jddjddjddjdd... (50+ keystrokes)
GOOD (one command):  :3,6d<CR> (8 keystrokes)

BAD (manual):        cwfoo<Esc>jcwfoo<Esc>jcwfoo<Esc>
GOOD (substitute):   :%s/old/foo/g<CR>

BAD (line by line):  dddddddddd (delete 10 lines manually)
GOOD (range):        :1,10d<CR> or 10dd

For merge conflicts, use global commands:
:%g/^<<<<<<</d<CR>      Delete conflict markers
:%g/^=======/d<CR>      Delete separators  
:%g/^>>>>>>>/d<CR>      Delete end markers

Think: "What's the SHORTEST vim command sequence to achieve this?"

Valid output format (plain text, no wrapping):
:%s/old/new/g<CR>
ggdG
3dd`;

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    startText,
    targetText,
    modelId,
    challengeId,
    apiKey: userApiKey,
  } = body;

  if (!startText || !targetText || !modelId) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const model = availableModels.find((m) => m.id === modelId) || {
    id: modelId,
    name: modelId,
    provider: "custom",
  };

  const cachedSolution =
    challengeId && getOfflineSolution(challengeId, modelId);

  if (cachedSolution) {
    return streamFromCachedSolution(cachedSolution);
  }

  // Check if this is the daily challenge
  const { store } = await import("@/lib/store");
  const { getDailyChallenge } = await import("@/lib/challenge-source");

  const today = new Date().toISOString().split("T")[0];
  const dailyChallenge = getDailyChallenge(today);
  const dailyId = dailyChallenge.id;

  console.log(
    `[Stream API] Processing request for challengeId: ${challengeId}`
  );
  console.log(`[Stream API] Today: ${today}, Daily ID: ${dailyId}`);

  const isDaily = challengeId && challengeId === dailyId;
  console.log(`[Stream API] isDaily: ${isDaily}`);

  let apiKey = process.env.AI_GATEWAY_API_KEY;
  let useCache = false;

  if (isDaily) {
    // For daily challenge:
    // 1. Check if we have a cached result
    const cachedResult = await store.getResult(challengeId, modelId);
    if (cachedResult) {
      // Simulate stream from cached result
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const cleanKeys = cleanKeystrokes(cachedResult.keystrokes);
          const tokens = cleanKeys.split("");
          const delay = Math.max(
            1,
            Math.floor(cachedResult.timeMs / tokens.length)
          );

          for (const token of tokens) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "token", content: token })}\n\n`
              )
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "done",
                timeMs: cachedResult.timeMs,
              })}\n\n`
            )
          );
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }
    // 2. If no cache, use system key and save result later
    useCache = true;
  } else {
    // For non-daily challenges, we now allow using the system API key as well
    // if (!userApiKey) {
    //   console.log(
    //     `[Stream API] Missing API Key for non-daily challenge. isDaily: ${isDaily}, challengeId: ${challengeId}, dailyId: ${dailyId}`
    //   );
    //   return new Response(
    //     JSON.stringify({
    //       error: "API Key required for custom/random challenges",
    //       debug: { isDaily, challengeId, dailyId },
    //     }),
    //     {
    //       status: 401,
    //       headers: { "Content-Type": "application/json" },
    //     }
    //   );
    // }
    apiKey = userApiKey || process.env.AI_GATEWAY_API_KEY;
  }

  if (!process.env.AI_GATEWAY_URL || !apiKey) {
    return new Response(
      JSON.stringify({ error: "AI Gateway configuration missing" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const completionsUrl = getGatewayCompletionsUrl();

  const prompt = `START TEXT:
\`\`\`
${startText}
\`\`\`

TARGET TEXT:
\`\`\`
${targetText}
\`\`\`

Output ONLY the Vim keystrokes to transform START into TARGET:`;

  try {
    const aiResponse = await fetch(completionsUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        max_tokens: 10000,
        temperature: 0.1,
        stream: true,
        stop: ["```"], // Stop on markdown blocks
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      return new Response(
        JSON.stringify({
          error: `AI Gateway error: ${aiResponse.status} - ${errorText}`,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Create a TransformStream to process SSE and emit our own events
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    let fullKeystrokes = "";
    const startTime = Date.now();
    const tokenTimeline: { token: string; timestampMs: number }[] = [];

    const stream = new ReadableStream({
      async start(controller) {
        console.log("[Stream API] Starting stream controller");

        // Helper to safely enqueue data
        const safeEnqueue = (data: Uint8Array) => {
          try {
            controller.enqueue(data);
            return true;
          } catch (e) {
            // Ignore if controller is already closed
            if (
              e instanceof TypeError &&
              (e.message.includes("Controller is already closed") ||
                e.message.includes("The stream is not in a state"))
            ) {
              console.log("[Stream API] Controller closed, stopping stream");
              return false;
            }
            throw e;
          }
        };
        let persisted = false;
        const persistResult = async (timeMs: number) => {
          if (persisted || !challengeId) return;
          persisted = true;
          const { store } = await import("@/lib/store");
          const cleanedKeystrokes = cleanKeystrokes(fullKeystrokes);
          await store.saveResult(challengeId, {
            modelId,
            modelName: model.name ?? modelId,
            keystrokes: cleanedKeystrokes,
            keystrokeCount: cleanedKeystrokes.length,
            timeMs,
            success: true,
            finalText: "",
            steps: [],
            diffFromBest: 0,
            tokenTimeline: tokenTimeline.slice(),
          });
        };
        const reader = aiResponse.body?.getReader();
        if (!reader) {
          console.error("[Stream API] No reader available from AI response");
          controller.close();
          return;
        }

        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              console.log("[Stream API] Reader done");
              break;
            }

            // console.log(`[Stream API] Received chunk size: ${value.length}`);
            buffer += decoder.decode(value, { stream: true });

            // Process complete SSE lines
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6).trim();
                // Send debug log to client
                // Send debug log to client
                if (
                  !safeEnqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: "debug",
                        message: `Received: ${data.slice(0, 100)}...`,
                      })}\n\n`
                    )
                  )
                ) {
                  return;
                }

                if (data === "[DONE]") {
                  console.log("[Stream API] Stream complete");
                  const endTime = Date.now();
                  const timeMs = endTime - startTime;

              await persistResult(timeMs);

                  safeEnqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ type: "done", timeMs })}\n\n`
                    )
                  );
                  continue;
                }

                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content;
                  const token =
                    typeof content === "string"
                      ? content
                      : Array.isArray(content)
                      ? content.join("")
                      : "";
                  if (token) {
                    const timestampMs = Date.now() - startTime;
                    fullKeystrokes += token;
                    tokenTimeline.push({ token, timestampMs });

                    if (
                      !safeEnqueue(
                        encoder.encode(
                          `data: ${JSON.stringify({
                            type: "token",
                            content: token,
                            timeMs: timestampMs,
                          })}\n\n`
                        )
                      )
                    ) {
                      return;
                    }
                  } else {
                    // Log missing content to client
                    // Log missing content to client
                    if (
                      !safeEnqueue(
                        encoder.encode(
                          `data: ${JSON.stringify({
                            type: "debug",
                            message: `Missing content in: ${JSON.stringify(
                              parsed
                            )}`,
                          })}\n\n`
                        )
                      )
                    ) {
                      return;
                    }
                  }
                } catch (e) {
                  console.error(
                    "[Stream API] JSON parse error:",
                    e,
                    "Data:",
                    data
                  );
                  // Skip malformed JSON
                }
              }
            }
          }

          // Handle buffer... (omitted for brevity, same logic)
          if (
            buffer.startsWith("data: ") &&
            buffer.slice(6).trim() !== "[DONE]"
          ) {
            try {
              const parsed = JSON.parse(buffer.slice(6).trim());
              const content = parsed.choices?.[0]?.delta?.content;
              const token =
                typeof content === "string"
                  ? content
                  : Array.isArray(content)
                  ? content.join("")
                  : "";
              if (token) {
                const timestampMs = Date.now() - startTime;
                fullKeystrokes += token;
                tokenTimeline.push({ token, timestampMs });
                if (
                  !safeEnqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: "token",
                        content: token,
                        timeMs: timestampMs,
                      })}\n\n`
                    )
                  )
                ) {
                  return;
                }
              }
            } catch {}
          }

          const endTime = Date.now();
          const timeMs = endTime - startTime;

          await persistResult(timeMs);

          safeEnqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "done", timeMs })}\n\n`
            )
          );
        } catch (error: any) {
          console.error("[Stream API] Stream error:", error);
          const errorMessage =
            error instanceof Error
              ? error.message
              : typeof error === "object"
              ? JSON.stringify(error)
              : String(error);

          // Only try to send error if controller is likely open
          try {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "error",
                  message: errorMessage,
                })}\n\n`
              )
            );
          } catch (e) {
            // Ignore close errors in error handler
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("[Stream API] Fatal error:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : typeof error === "object"
        ? JSON.stringify(error)
        : String(error);

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

function buildTokenTimeline(result: RunResult) {
  if (result.tokenTimeline?.length) {
    return result.tokenTimeline.map((entry) => ({
      token: entry.token,
      timestampMs: Math.max(0, Math.round(entry.timestampMs)),
    }));
  }

  const keystrokes = cleanKeystrokes(result.keystrokes);
  const chars = keystrokes.split("");

  if (chars.length === 0) return [];

  const step =
    result.timeMs && result.timeMs > 0
      ? Math.max(1, Math.round(result.timeMs / chars.length))
      : 10;

  let current = 0;
  return chars.map((token, index) => {
    if (index > 0) {
      current += step;
    }
    return { token, timestampMs: current };
  });
}

function streamFromCachedSolution(result: RunResult) {
  const encoder = new TextEncoder();
  const timeline = buildTokenTimeline(result);
  const totalTime =
    result.timeMs && result.timeMs > 0
      ? result.timeMs
      : timeline.at(-1)?.timestampMs ?? 0;

  const stream = new ReadableStream({
    async start(controller) {
      let lastTs = 0;
      for (const event of timeline) {
        const delay = Math.max(0, event.timestampMs - lastTs);
        if (delay > 0) {
          await sleep(delay);
        }
        lastTs = event.timestampMs;
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "token",
              content: event.token,
              timeMs: event.timestampMs,
              source: "cache",
            })}\n\n`
          )
        );
      }

      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            type: "done",
            timeMs: totalTime,
            source: "cache",
          })}\n\n`
        )
      );
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
