import OpenAI from "openai";

let client: OpenAI | null = null;

export function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  client ??= new OpenAI({ apiKey });
  return client;
}

export const postureExplainModel = process.env.OPENAI_POSTURE_MODEL ?? "gpt-5.4-nano";

