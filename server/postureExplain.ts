import { getOpenAIClient, postureExplainModel } from "./openai";
import { postureExplainSchema } from "./postureExplainSchema";
import type { PostureExplainRequest, PostureExplainResponse } from "./types";

export function getPostureHealth() {
  return {
    ok: true,
    model: postureExplainModel,
    hasApiKey: Boolean(process.env.OPENAI_API_KEY),
  };
}

export function isPostureExplainRequest(body: Partial<PostureExplainRequest>): body is PostureExplainRequest {
  return Boolean(body.question && body.riskLevel && body.findings && body.riskPoints);
}

export async function generatePostureExplanation(body: PostureExplainRequest): Promise<PostureExplainResponse> {
  const client = getOpenAIClient();
  const result = await client.responses.create({
    model: postureExplainModel,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text:
              "You are a posture risk explanation assistant for a consumer health demo. Explain the posture result in Chinese. Do not diagnose disease. Give practical, short, safe guidance based on the structured posture data only.",
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify(body, null, 2),
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "posture_report",
        strict: true,
        schema: postureExplainSchema,
      },
    },
  });

  const output = result.output_text;
  if (!output) {
    throw new Error("Empty AI response");
  }

  return JSON.parse(output) as PostureExplainResponse;
}
