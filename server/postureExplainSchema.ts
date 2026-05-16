export const postureExplainSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    explanation: { type: "string" },
    suggestions: {
      type: "array",
      items: { type: "string" },
      minItems: 3,
      maxItems: 4,
    },
    medicalBoundary: { type: "string" },
    followUpQuestion: { type: ["string", "null"] },
  },
  required: ["title", "summary", "explanation", "suggestions", "medicalBoundary", "followUpQuestion"],
} as const;
