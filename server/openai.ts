import OpenAI from "openai";

let client: OpenAI | null = null;

export const aiProvider = process.env.AI_PROVIDER ?? "deepseek";
export const aiBaseUrl = process.env.AI_BASE_URL ?? "https://api.deepseek.com";
export const postureExplainModel = process.env.AI_MODEL ?? "deepseek-v4-flash";

export function getAIClient() {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing AI_API_KEY");
  }

  client ??= new OpenAI({
    apiKey,
    baseURL: aiBaseUrl,
  });
  return client;
}
