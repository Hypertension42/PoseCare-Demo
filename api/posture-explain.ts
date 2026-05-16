import { generatePostureExplanation, isPostureExplainRequest } from "../server/postureExplain.js";
import type { PostureExplainRequest } from "../server/types.js";

type JsonRequest = {
  method?: string;
  body?: Partial<PostureExplainRequest>;
};

type JsonResponse = {
  status: (code: number) => JsonResponse;
  json: (body: unknown) => void;
};

export default async function handler(request: JsonRequest, response: JsonResponse) {
  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  const body = request.body ?? {};

  if (!isPostureExplainRequest(body)) {
    response.status(400).json({ error: "Invalid posture explanation payload." });
    return;
  }

  try {
    const explanation = await generatePostureExplanation(body);
    response.status(200).json(explanation);
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : "Failed to generate AI explanation.",
    });
  }
}
