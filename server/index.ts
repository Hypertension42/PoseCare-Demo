import "dotenv/config";

import express from "express";

import { generateBodyPersona, isBodyPersonaGenerateRequest } from "./bodyPersona.js";
import {
  generatePostureExplanation,
  getPostureHealth,
  isPostureExplainRequest,
} from "./postureExplain.js";
import type { BodyPersonaGenerateRequest, PostureExplainRequest } from "./types.js";

const app = express();
const port = Number(process.env.PORT ?? 8787);

app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_request, response) => {
  response.json(getPostureHealth());
});

app.post("/api/posture-explain", async (request, response) => {
  const body = request.body as Partial<PostureExplainRequest>;

  if (!isPostureExplainRequest(body)) {
    response.status(400).json({ error: "Invalid posture explanation payload." });
    return;
  }

  try {
    const explanation = await generatePostureExplanation(body);
    response.json(explanation);
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : "Failed to generate AI explanation.",
    });
  }
});

app.post("/api/body-persona", async (request, response) => {
  const body = request.body as Partial<BodyPersonaGenerateRequest>;

  if (!isBodyPersonaGenerateRequest(body)) {
    response.status(400).json({ error: "Invalid body persona payload." });
    return;
  }

  try {
    const persona = await generateBodyPersona(body);
    response.json(persona);
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : "Failed to generate body persona.",
    });
  }
});

app.listen(port, () => {
  console.log(`PoseCare AI server listening on http://localhost:${port}`);
});
