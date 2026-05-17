import { getAIClient, postureExplainModel } from "./openai.js";
import type { BodyPersonaGenerateRequest, BodyPersonaGenerateResponse } from "./types.js";

function isStringArray(value: unknown, minLength: number) {
  return Array.isArray(value) && value.length >= minLength && value.every((item) => typeof item === "string");
}

function clampNumber(value: unknown, fallback: number, min = 0, max = 100) {
  const numberValue = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.round(Math.min(max, Math.max(min, numberValue)));
}

function toStringArray(value: unknown, fallback: string[], minLength: number) {
  const items = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
  const merged = [...items, ...fallback].filter((item, index, list) => list.indexOf(item) === index);
  return merged.slice(0, Math.max(minLength, Math.min(4, merged.length)));
}

export function isBodyPersonaGenerateRequest(body: Partial<BodyPersonaGenerateRequest>): body is BodyPersonaGenerateRequest {
  return Boolean(body.localPersona?.postureId && body.localPersona?.metrics && body.poseSummary?.keypoints && body.poseSummary?.derived);
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

function normalizeJournal(value: unknown): BodyPersonaGenerateResponse["journal"] {
  const required = [
    "体态气质档案",
    "体态穿搭推荐",
    "拍照姿势推荐",
    "放松运动推荐",
    "相似体态灵感页",
  ];
  const fallbackItems: Record<string, string[]> = {
    体态气质档案: ["根据肩颈、重心和线条延展指标，生成你的身体气质档案。", "身体线索会被转译成低焦虑的气质语言。", "本结果用于生活方式建议，不做医学诊断。"],
    体态穿搭推荐: ["选择能保留肩颈留白的上衣。", "用顺垂面料延展整体线条。", "用适合重心的腰线和鞋型增强稳定感。"],
    拍照姿势推荐: ["身体微微侧转，保留肩颈空间。", "让手臂和身体之间留一点空隙。", "镜头保持平视或略低，突出自然延展。"],
    放松运动推荐: ["做 3 分钟肩颈慢拉伸。", "用靠墙呼吸找回站姿支撑。", "睡前做胸腔打开和背部舒展。"],
    相似体态灵感页: ["查看同人格用户的穿搭比例。", "收藏相似体态的拍照姿势。", "参考同体态用户的放松打卡。"],
  };

  if (Array.isArray(value)) {
    return required.map((title) => {
      const matched = value.find((item) => item && typeof item === "object" && "title" in item && item.title === title) as Partial<BodyPersonaGenerateResponse["journal"][number]> | undefined;
      return {
        title,
        subtitle: typeof matched?.subtitle === "string" ? matched.subtitle : "根据体态关键点和指标动态生成。",
        items: toStringArray(matched?.items, fallbackItems[title], 3),
      };
    });
  }

  const objectValue = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return required.map((title) => {
    const rawSection = objectValue[title];
    const section = rawSection && typeof rawSection === "object" ? (rawSection as Record<string, unknown>) : {};
    return {
      title,
      subtitle: typeof section.subtitle === "string" ? section.subtitle : "根据体态关键点和指标动态生成。",
      items: toStringArray(section.items, fallbackItems[title], 3),
    };
  });
}

function normalizeChanges(value: unknown, fallback: BodyPersonaGenerateResponse["weeklyCard"]["changes"]) {
  if (Array.isArray(value)) {
    return fallback.map((item) => {
      const matched = value.find((candidate) => candidate && typeof candidate === "object" && "label" in candidate && candidate.label === item.label) as { value?: unknown } | undefined;
      return { label: item.label, value: clampNumber(matched?.value, item.value) };
    });
  }

  const objectValue = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return fallback.map((item) => ({ label: item.label, value: clampNumber(objectValue[item.label], item.value) }));
}

function normalizeBodyPersonaResponse(value: Partial<BodyPersonaGenerateResponse>, body: BodyPersonaGenerateRequest): BodyPersonaGenerateResponse {
  const fallbackEnergy = clampNumber(
    (body.localPersona.metrics.shoulderEase +
      body.localPersona.metrics.balance +
      body.localPersona.metrics.lineFlow +
      body.localPersona.metrics.relaxation +
      body.localPersona.metrics.presence) /
      5,
    72,
  );
  const fallbackChanges = [
    { label: "松弛感", value: Math.max(5, body.localPersona.metrics.relaxation - 58) },
    { label: "舒展度", value: Math.max(5, body.localPersona.metrics.shoulderEase - 60) },
    { label: "活力感", value: Math.max(5, body.localPersona.metrics.presence - 62) },
    { label: "自信感", value: Math.max(5, body.localPersona.metrics.balance - 61) },
  ];

  return {
    personaName: typeof value.personaName === "string" ? value.personaName : body.localPersona.personaName,
    description: typeof value.description === "string" ? value.description : body.localPersona.description,
    keywords: toStringArray(value.keywords, body.localPersona.keywords, 3),
    strengths: toStringArray(value.strengths, body.localPersona.strengths, 2),
    journal: normalizeJournal(value.journal),
    dailyCard: {
      moodName: typeof value.dailyCard?.moodName === "string" ? value.dailyCard.moodName : "根据体态数据生成的一天",
      energy: clampNumber(value.dailyCard?.energy, fallbackEnergy),
      keywords: toStringArray(value.dailyCard?.keywords, ["轻盈", "恢复", "安静", "舒展"], 3),
      healingCopy:
        typeof value.dailyCard?.healingCopy === "string"
          ? value.dailyCard.healingCopy
          : "今天的身体正在用自己的节奏慢慢打开，不需要用力证明什么。",
    },
    weeklyCard: {
      summary: typeof value.weeklyCard?.summary === "string" ? value.weeklyCard.summary : "这一周，身体状态从轻微收缩慢慢回到更舒展的节奏。",
      keywords: toStringArray(value.weeklyCard?.keywords, ["恢复", "打开", "轻盈"], 3),
      changes: normalizeChanges(value.weeklyCard?.changes, fallbackChanges),
      nextSuggestion:
        typeof value.weeklyCard?.nextSuggestion === "string"
          ? value.weeklyCard.nextSuggestion
          : "下周可以继续观察肩颈留白、站姿重心和线条延展的变化。",
    },
    communityPreview: {
      groupName: typeof value.communityPreview?.groupName === "string" ? value.communityPreview.groupName : `${body.localPersona.personaName}小组`,
      similarity: clampNumber(value.communityPreview?.similarity, 86, 72, 96),
      inspirations: toStringArray(value.communityPreview?.inspirations, ["同人格穿搭比例", "自然侧身拍照模板", "肩颈放松打卡"], 3),
    },
  };
}

export async function generateBodyPersona(body: BodyPersonaGenerateRequest): Promise<BodyPersonaGenerateResponse> {
  const client = getAIClient();
  const messages = [
    {
      role: "system" as const,
      content:
        "你是一个温柔、审美化的体态人格生成助手。你看不到原图，只能根据 MediaPipe 姿态关键点、归一化几何特征和本地体态指标，推断用户的身体气质。生成中文体态人格、小手账、状态卡和相似体态社区预览。不要做医学诊断，不要评价身材缺陷，不要提体重、三围、肥胖、腿粗、胯宽、驼背严重、高低肩明显等焦虑词。只输出合法 JSON，不要输出 markdown。",
    },
    {
      role: "user" as const,
      content: JSON.stringify(
        {
          task:
            "请基于结构化体态数据动态生成更贴合该用户的体态人格内容。你不能声称看到了照片，只能说“根据体态关键点和指标”。必须返回这些键：personaName, description, keywords, strengths, journal, dailyCard, weeklyCard, communityPreview。journal 必须包含 title 为 体态气质档案、体态穿搭推荐、拍照姿势推荐、放松运动推荐、相似体态灵感页 的项目，每项 items 3 条。dailyCard.energy 为 0-100。weeklyCard.changes 包含 松弛感、舒展度、活力感、自信感。communityPreview.similarity 为 72-96。",
          localPersona: body.localPersona,
          poseSummary: body.poseSummary,
        },
        null,
        2,
      ),
    },
  ];
  const firstResult = await client.chat.completions.create({
    model: postureExplainModel,
    messages,
    response_format: {
      type: "json_object",
    },
  });

  let output = firstResult.choices[0]?.message.content;
  if (!output) {
    const retryResult = await client.chat.completions.create({
      model: postureExplainModel,
      messages,
    });
    output = retryResult.choices[0]?.message.content;
  }
  if (!output) {
    throw new Error("Empty body persona AI response");
  }

  const jsonMatch = output.match(/\{[\s\S]*\}/);
  const parsed = normalizeBodyPersonaResponse(JSON.parse(jsonMatch?.[0] ?? output) as Partial<BodyPersonaGenerateResponse>, body);
  if (!isBodyPersonaGenerateResponse(parsed)) {
    throw new Error("Invalid body persona AI response");
  }

  return parsed;
}
