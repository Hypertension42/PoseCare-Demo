import OpenAI from "openai";
var client = null;
export var aiProvider = process.env.AI_PROVIDER || "deepseek";
export var aiBaseUrl = process.env.AI_BASE_URL || "https://api.deepseek.com";
export var postureExplainModel = process.env.AI_MODEL || "deepseek-v4-flash";
export function getAIClient() {
    var apiKey = process.env.AI_API_KEY;
    if (!apiKey) {
        throw new Error("Missing AI_API_KEY");
    }
    client !== null && client !== void 0 ? client : (client = new OpenAI({
        apiKey: apiKey,
        baseURL: aiBaseUrl,
    }));
    return client;
}
