import "dotenv/config";

import express from "express";

import {
    generatePostureExplanation,
    getPostureHealth,
    isPostureExplainRequest,
} from "./postureExplain.js";

var app = express();
var port = Number(process.env.PORT || 8787);

app.use(express.json({ limit: "1mb" }));

app.get("/api/health", function (_request, response) {
    response.json(getPostureHealth());
});

app.post("/api/posture-explain", async function (request, response) {
    var body = request.body;
    if (!isPostureExplainRequest(body)) {
        response.status(400).json({ error: "Invalid posture explanation payload." });
        return;
    }

    try {
        var explanation = await generatePostureExplanation(body);
        response.json(explanation);
    }
    catch (error) {
        response.status(500).json({
            error: error instanceof Error ? error.message : "Failed to generate AI explanation.",
        });
    }
});

app.listen(port, function () {
    console.log("PoseCare AI server listening on http://localhost:".concat(port));
});
