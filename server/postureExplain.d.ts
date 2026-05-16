import type { PostureExplainRequest, PostureExplainResponse } from "./types.js";
export declare function getPostureHealth(): {
    ok: boolean;
    provider: string;
    model: string;
    baseUrl: string;
    hasApiKey: boolean;
};
export declare function isPostureExplainRequest(body: Partial<PostureExplainRequest>): body is PostureExplainRequest;
export declare function generatePostureExplanation(body: PostureExplainRequest): Promise<PostureExplainResponse>;
