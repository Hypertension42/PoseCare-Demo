import {
  FilesetResolver,
  PoseLandmarker,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";

import type { LandmarkPoint } from "./types";

let imageLandmarkerPromise: Promise<PoseLandmarker> | null = null;
let videoLandmarkerPromise: Promise<PoseLandmarker> | null = null;

const wasmUrl = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const modelUrl =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

async function createPoseLandmarker(runningMode: "IMAGE" | "VIDEO") {
  return FilesetResolver.forVisionTasks(wasmUrl).then((vision) =>
    PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: modelUrl,
        delegate: "GPU",
      },
      runningMode,
      numPoses: 1,
    }),
  );
}

async function getImagePoseLandmarker() {
  imageLandmarkerPromise ??= createPoseLandmarker("IMAGE");
  return imageLandmarkerPromise;
}

async function getVideoPoseLandmarker() {
  videoLandmarkerPromise ??= createPoseLandmarker("VIDEO");
  return videoLandmarkerPromise;
}

export async function detectPoseLandmarks(image: HTMLImageElement): Promise<LandmarkPoint[]> {
  const landmarker = await getImagePoseLandmarker();
  const result = landmarker.detect(image);
  const firstPose = result.landmarks[0] ?? [];

  return firstPose.map((landmark: NormalizedLandmark) => ({
    x: landmark.x,
    y: landmark.y,
    z: landmark.z,
    visibility: landmark.visibility,
  }));
}

export async function detectPoseLandmarksFromVideo(
  video: HTMLVideoElement,
  timestampMs: number,
): Promise<LandmarkPoint[]> {
  const landmarker = await getVideoPoseLandmarker();
  const result = landmarker.detectForVideo(video, timestampMs);
  const firstPose = result.landmarks[0] ?? [];

  return firstPose.map((landmark: NormalizedLandmark) => ({
    x: landmark.x,
    y: landmark.y,
    z: landmark.z,
    visibility: landmark.visibility,
  }));
}
