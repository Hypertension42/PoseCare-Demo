export type LandmarkPoint = {
  x: number;
  y: number;
  z: number;
  visibility?: number;
};

export type RiskTone = "low" | "mid" | "high";

export type RiskPoint = {
  label: string;
  value: number;
  tone: RiskTone;
  detail: string;
};

export type Finding = {
  part: string;
  issue: string;
  severity: string;
  message: string;
};

export type Guidance = {
  title: string;
  answer: string;
  suggestions: string[];
};

export type AIExplanation = {
  title: string;
  summary: string;
  explanation: string;
  suggestions: string[];
  medicalBoundary: string;
  followUpQuestion?: string;
};

export type PostureAnalysis = {
  landmarks: LandmarkPoint[];
  detectedKeypoints: number;
  confidence: number;
  riskLevel: "低风险" | "中等风险" | "高风险";
  riskLabel: "Low Risk" | "Medium Risk" | "High Risk";
  score: number;
  riskPoints: RiskPoint[];
  findings: Finding[];
  guidance: Guidance;
  aiExplanation?: AIExplanation;
  summary: string;
};
