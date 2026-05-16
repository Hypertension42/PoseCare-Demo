export declare const postureExplainSchema: {
    readonly type: "object";
    readonly additionalProperties: false;
    readonly properties: {
        readonly title: {
            readonly type: "string";
        };
        readonly summary: {
            readonly type: "string";
        };
        readonly explanation: {
            readonly type: "string";
        };
        readonly suggestions: {
            readonly type: "array";
            readonly items: {
                readonly type: "string";
            };
            readonly minItems: 3;
            readonly maxItems: 4;
        };
        readonly medicalBoundary: {
            readonly type: "string";
        };
        readonly followUpQuestion: {
            readonly type: "string";
        };
    };
    readonly required: readonly ["title", "summary", "explanation", "suggestions", "medicalBoundary"];
};
