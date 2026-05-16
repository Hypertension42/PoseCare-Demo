import { aiBaseUrl, aiProvider, getAIClient, postureExplainModel } from "./openai.js";

export function getPostureHealth() {
    return {
        ok: true,
        provider: aiProvider,
        model: postureExplainModel,
        baseUrl: aiBaseUrl,
        hasApiKey: Boolean(process.env.AI_API_KEY),
    };
}

export function isPostureExplainRequest(body) {
    return Boolean(body.question && body.riskLevel && body.findings && body.riskPoints);
}

export async function generatePostureExplanation(body) {
    var _a;
    const client = getAIClient();
    const result = await client.chat.completions.create({
        model: postureExplainModel,
        messages: [
            {
                role: "system",
                content: "You are a posture risk explanation assistant for a consumer health demo. Explain the posture result in Chinese. Do not diagnose disease. Give practical, short, safe guidance based on the structured posture data only. Return valid JSON only with these keys: title, summary, explanation, suggestions, medicalBoundary, followUpQuestion. suggestions must be an array of 3 to 4 strings. followUpQuestion can be null.",
            },
            {
                role: "user",
                content: JSON.stringify(body, null, 2),
            },
        ],
        response_format: {
            type: "json_object",
        },
    });
    const output = (_a = result.choices[0]) === null || _a === void 0 ? void 0 : _a.message.content;
    if (!output) {
        throw new Error("Empty AI response");
    }
    return JSON.parse(output);
}
