import { generateBodyPersona, isBodyPersonaGenerateRequest } from "../server/bodyPersona.js";
import type { BodyPersonaGenerateRequest } from "../server/types.js";

type JsonRequest = {
  method?: string;
  body?: Partial<BodyPersonaGenerateRequest>;
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

  if (!isBodyPersonaGenerateRequest(body)) {
    response.status(400).json({ error: "Invalid body persona payload." });
    return;
  }

  try {
    const persona = await generateBodyPersona(body);
    response.status(200).json(persona);
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : "Failed to generate body persona.",
    });
  }
}
