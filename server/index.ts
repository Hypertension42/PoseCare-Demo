import "dotenv/config";

import express from "express";

import { getOpenAIClient, postureExplainModel } from "./openai";
import { postureExplainSchema } from "./postureExplainSchema";
import type { PostureExplainRequest, PostureExplainResponse } from "./types";

const app = express();
const port = Number(process.env.PORT ?? 8787);

app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    model: postureExplainModel,
    hasApiKey: Boolean(process.env.OPENAI_API_KEY),
  });
});

app.post("/api/posture-explain", async (request, response) => {
  const body = request.body as Partial<PostureExplainRequest>;

  if (!body.question || !body.riskLevel || !body.findings || !body.riskPoints) {
    response.status(400).json({ error: "Invalid posture explanation payload." });
    return;
  }

  try {
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

    const parsed = JSON.parse(output) as PostureExplainResponse;
    response.json(parsed);
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : "Failed to generate AI explanation.",
    });
  }
});

app.listen(port, () => {
  console.log(`PoseCare AI server listening on http://localhost:${port}`);
});

