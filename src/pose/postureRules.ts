import type { Finding, Guidance, LandmarkPoint, PostureAnalysis, RiskPoint, RiskTone } from "./types";

const landmarkIndex = {
  nose: 0,
  leftShoulder: 11,
  rightShoulder: 12,
  leftHip: 23,
  rightHip: 24,
} as const;

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function midpoint(a: LandmarkPoint, b: LandmarkPoint): LandmarkPoint {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: (a.z + b.z) / 2,
    visibility: average([a.visibility ?? 0, b.visibility ?? 0]),
  };
}

function distance(a: LandmarkPoint, b: LandmarkPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function riskTone(value: number): RiskTone {
  if (value >= 70) {
    return "high";
  }

  if (value >= 42) {
    return "mid";
  }

  return "low";
}

function severity(value: number) {
  if (value >= 72) {
    return "明显";
  }

  if (value >= 48) {
    return "轻中度";
  }

  return "轻微";
}

function riskLevel(score: number): PostureAnalysis["riskLevel"] {
  if (score >= 70) {
    return "高风险";
  }

  if (score >= 42) {
    return "中等风险";
  }

  return "低风险";
}

function riskLabel(level: PostureAnalysis["riskLevel"]): PostureAnalysis["riskLabel"] {
  if (level === "高风险") {
    return "High Risk";
  }

  if (level === "中等风险") {
    return "Medium Risk";
  }

  return "Low Risk";
}

function buildGuidance(question: string, level: PostureAnalysis["riskLevel"], findings: Finding[]): Guidance {
  const normalizedQuestion = question.trim();
  const topFindings = findings.slice(0, 2).map((item) => `${item.part}${item.issue}`).join("、");
  const asksAdjustment = /怎么|如何|调整|改善|纠正|建议/.test(normalizedQuestion);
  const asksPain = /腰|疼|痛|麻|伤/.test(normalizedQuestion);
  const asksProblem = /哪里|哪儿|不对|问题|风险/.test(normalizedQuestion) || !normalizedQuestion;

  if (asksPain) {
    return {
      title: "关于腰背负担",
      answer: `${level}。本次画面里更需要关注${topFindings || "躯干支撑"}，这类姿势会增加颈肩或腰背持续受力，但不能据此判断疾病。`,
      suggestions: [
        "先把臀部坐深，让腰背获得稳定支撑，再调整屏幕高度。",
        "如果已经出现持续疼痛、麻木或外伤史，不要只靠姿势调整，应及时就医。",
        "每 30-45 分钟起身活动 2 分钟，优先做胸椎伸展和肩胛后缩。",
      ],
    };
  }

  if (asksAdjustment) {
    return {
      title: "纠正建议",
      answer: `${level}。先处理最明显的${topFindings || "姿势偏移"}，比一次性追求标准坐姿更容易坚持。`,
      suggestions: [
        "把屏幕上沿调整到接近眼平高度，减少低头和头前伸。",
        "肩膀放松向后打开，避免长时间含胸。",
        "坐骨稳定落在椅面上，腰背轻靠椅背。",
      ],
    };
  }

  if (asksProblem) {
    return {
      title: "哪里不对",
      answer: `${level}。主要问题集中在${topFindings || "上半身姿态"}，建议先从颈肩和腰背支撑入手。`,
      suggestions: [
        "优先调整屏幕和头部位置，让耳朵回到肩膀附近。",
        "检查双肩是否一高一低或向前扣，保持胸廓轻微打开。",
        "避免身体向屏幕探出去，必要时把椅子靠近桌面。",
      ],
    };
  }

  return {
    title: "姿势风险解释",
    answer: `${level}。AI 已根据画面关键点计算颈部、肩线和躯干姿态，当前最需要关注${topFindings || "上半身稳定性"}。`,
    suggestions: [
      "先完成屏幕高度、坐深椅背、肩膀放松三个基础调整。",
      "保持脚掌落地，减少腰背代偿。",
      "久坐场景下，每 30-45 分钟起身活动一次。",
    ],
  };
}

export function analyzeSittingPosture(landmarks: LandmarkPoint[], question: string): PostureAnalysis | null {
  const nose = landmarks[landmarkIndex.nose];
  const leftShoulder = landmarks[landmarkIndex.leftShoulder];
  const rightShoulder = landmarks[landmarkIndex.rightShoulder];
  const leftHip = landmarks[landmarkIndex.leftHip];
  const rightHip = landmarks[landmarkIndex.rightHip];

  if (!nose || !leftShoulder || !rightShoulder || !leftHip || !rightHip) {
    return null;
  }

  const shoulderMid = midpoint(leftShoulder, rightShoulder);
  const hipMid = midpoint(leftHip, rightHip);
  const shoulderSpan = Math.max(distance(leftShoulder, rightShoulder), 0.08);
  const torsoHeight = Math.max(Math.abs(hipMid.y - shoulderMid.y), 0.1);

  const headForward = clamp((Math.abs(nose.x - shoulderMid.x) / shoulderSpan - 0.18) * 130);
  const shoulderTilt = clamp((Math.abs(leftShoulder.y - rightShoulder.y) / shoulderSpan - 0.06) * 180);
  const trunkLean = clamp((Math.abs(shoulderMid.x - hipMid.x) / torsoHeight - 0.12) * 150);

  const rawRiskPoints: RiskPoint[] = [
    {
      label: "颈部",
      value: Math.round(headForward),
      tone: riskTone(headForward),
      detail: headForward >= 42 ? "头部相对肩部前移" : "头颈位置基本稳定",
    },
    {
      label: "肩线",
      value: Math.round(shoulderTilt),
      tone: riskTone(shoulderTilt),
      detail: shoulderTilt >= 42 ? "左右肩高度存在差异" : "肩线基本平衡",
    },
    {
      label: "腰背",
      value: Math.round(trunkLean),
      tone: riskTone(trunkLean),
      detail: trunkLean >= 42 ? "躯干相对骨盆前倾" : "躯干支撑较稳定",
    },
  ];

  const findings = rawRiskPoints
    .filter((item) => item.value >= 28)
    .sort((a, b) => b.value - a.value)
    .map<Finding>((item) => {
      if (item.label === "颈部") {
        return {
          part: "颈部",
          issue: "头前伸",
          severity: severity(item.value),
          message: "头部相对肩部前移，长时间保持会增加颈肩负担。",
        };
      }

      if (item.label === "肩线") {
        return {
          part: "肩部",
          issue: "肩线不平衡",
          severity: severity(item.value),
          message: "左右肩高度存在差异，可能与单侧用力或含胸有关。",
        };
      }

      return {
        part: "腰背",
        issue: "躯干前倾",
        severity: severity(item.value),
        message: "上半身相对骨盆前移，久坐时腰背支撑压力会增加。",
      };
    });

  const fallbackFindings: Finding[] = [
    {
      part: "整体",
      issue: "轻微姿态偏移",
      severity: "轻微",
      message: "当前关键点未显示明显异常，建议继续保持屏幕高度和腰背支撑。",
    },
  ];

  const visibleKeypoints = landmarks.filter((landmark) => (landmark.visibility ?? 0) >= 0.45).length;
  const confidence = Math.round(
    average([
      nose.visibility ?? 0,
      leftShoulder.visibility ?? 0,
      rightShoulder.visibility ?? 0,
      leftHip.visibility ?? 0,
      rightHip.visibility ?? 0,
    ]) * 100,
  );
  const riskScore = Math.round(average(rawRiskPoints.map((item) => item.value)));
  const level = riskLevel(riskScore);
  const finalFindings = findings.length > 0 ? findings : fallbackFindings;

  return {
    landmarks,
    detectedKeypoints: visibleKeypoints,
    confidence,
    riskLevel: level,
    riskLabel: riskLabel(level),
    score: clamp(100 - riskScore),
    riskPoints: rawRiskPoints,
    findings: finalFindings,
    guidance: buildGuidance(question, level, finalFindings),
    summary: `${level}，本次根据 ${visibleKeypoints} 个可见关键点完成颈部、肩线和腰背评估。`,
  };
}

