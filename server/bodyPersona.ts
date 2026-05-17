import { getAIClient, postureExplainModel } from "./openai.js";
import type { BodyPersonaGenerateRequest, BodyPersonaGenerateResponse } from "./types.js";

function isStringArray(value: unknown, minLength: number) {
  return Array.isArray(value) && value.length >= minLength && value.every((item) => typeof item === "string");
}

export function isBodyPersonaGenerateRequest(body: Partial<BodyPersonaGenerateRequest>): body is BodyPersonaGenerateRequest {
  return Boolean(body.imageDataUrl?.startsWith("data:image/") && body.localPersona?.postureId && body.localPersona?.metrics);
}

export function isBodyPersonaGenerateResponse(value: Partial<BodyPersonaGenerateResponse>): value is BodyPersonaGenerateResponse {
  return Boolean(
    typeof value.personaName === "string" &&
      typeof value.description === "string" &&
      isStringArray(value.keywords, 3) &&
      isStringArray(value.strengths, 2) &&
      Array.isArray(value.journal) &&
      value.journal.length >= 3 &&
      value.dailyCard &&
      typeof value.dailyCard.moodName === "string" &&
      typeof value.dailyCard.energy === "number" &&
      value.weeklyCard &&
      typeof value.weeklyCard.summary === "string" &&
      value.communityPreview &&
      typeof value.communityPreview.groupName === "string",
  );
}

export async function generateBodyPersona(body: BodyPersonaGenerateRequest): Promise<BodyPersonaGenerateResponse> {
  const client = getAIClient();
  const result = await client.chat.completions.create({
    model: postureExplainModel,
    messages: [
      {
        role: "system",
        content:
          "你是一个温柔、审美化的体态人格生成助手。你需要根据用户全身体态照片和结构化姿态指标，生成中文体态人格、小手账、状态卡和相似体态社区预览。不要做医学诊断，不要评价身材缺陷，不要提体重、三围、肥胖、腿粗、胯宽、驼背严重、高低肩明显等焦虑词。只输出合法 JSON。",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                task:
                  "请结合图片中的整体体态氛围、肩颈打开程度、重心、线条延展和本地指标，动态生成更贴合图片的体态人格内容。必须返回这些键：personaName, description, keywords, strengths, journal, dailyCard, weeklyCard, communityPreview。journal 必须包含 title 为 体态气质档案、体态穿搭推荐、拍照姿势推荐、放松运动推荐、相似体态灵感页 的项目，每项 items 3 条。dailyCard.energy 为 0-100。weeklyCard.changes 包含 松弛感、舒展度、活力感、自信感。communityPreview.similarity 为 72-96。",
                localPersona: body.localPersona,
              },
              null,
              2,
            ),
          },
          {
            type: "image_url",
            image_url: {
              url: body.imageDataUrl,
              detail: "low",
            },
          },
        ],
      },
    ],
    response_format: {
      type: "json_object",
    },
  });

  const output = result.choices[0]?.message.content;
  if (!output) {
    throw new Error("Empty body persona AI response");
  }

  const parsed = JSON.parse(output) as Partial<BodyPersonaGenerateResponse>;
  if (!isBodyPersonaGenerateResponse(parsed)) {
    throw new Error("Invalid body persona AI response");
  }

  return parsed;
}
