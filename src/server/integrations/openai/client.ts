import "server-only";
import OpenAI from "openai";
import { env } from "@/lib/env";

let client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  const apiKey = env().OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY não configurada.");
  client ??= new OpenAI({ apiKey, timeout: 30_000, maxRetries: 1 });
  return client;
}

/** Modelos de raciocínio (gpt-5*, o*) não aceitam temperature e gastam tokens pensando. */
export function isReasoningModel(model: string) {
  return /^(gpt-5|o\d)/.test(model);
}

export type ChatTurn = { role: "user" | "assistant"; content: string };

export async function generateText(params: {
  model: string;
  instructions: string;
  history: ChatTurn[];
  temperature: number;
  maxOutputTokens: number;
}): Promise<string> {
  const reasoning = isReasoningModel(params.model);
  const response = await getOpenAI().responses.create({
    model: params.model,
    instructions: params.instructions,
    input: params.history.map((turn) => ({ role: turn.role, content: turn.content })),
    max_output_tokens: reasoning ? params.maxOutputTokens + 2000 : params.maxOutputTokens,
    ...(reasoning ? { reasoning: { effort: "low" as const } } : { temperature: params.temperature }),
    store: false,
  });
  return response.output_text.trim();
}
