var _a;
import OpenAI from "openai";
var client = null;
export function getOpenAIClient() {
    var apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error("Missing OPENAI_API_KEY");
    }
    client !== null && client !== void 0 ? client : (client = new OpenAI({ apiKey: apiKey }));
    return client;
}
export var postureExplainModel = (_a = process.env.OPENAI_POSTURE_MODEL) !== null && _a !== void 0 ? _a : "gpt-5.4-nano";
