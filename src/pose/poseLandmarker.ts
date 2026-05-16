import {
  FilesetResolver,
  PoseLandmarker,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";

import type { LandmarkPoint } from "./types";

let landmarkerPromise: Promise<PoseLandmarker> | null = null;

const wasmUrl = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const modelUrl =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

async function getPoseLandmarker() {
  landmarkerPromise ??= FilesetResolver.forVisionTasks(wasmUrl).then((vision) =>
    PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: modelUrl,
        delegate: "GPU",
      },
      runningMode: "IMAGE",
      numPoses: 1,
    }),
  );

  return landmarkerPromise;
}

export async function detectPoseLandmarks(image: HTMLImageElement): Promise<LandmarkPoint[]> {
  const landmarker = await getPoseLandmarker();
  const result = landmarker.detect(image);
  const firstPose = result.landmarks[0] ?? [];

  return firstPose.map((landmark: NormalizedLandmark) => ({
    x: landmark.x,
    y: landmark.y,
    z: landmark.z,
    visibility: landmark.visibility,
  }));
}
