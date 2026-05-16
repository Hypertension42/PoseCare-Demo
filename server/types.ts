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

export type PostureExplainRequest = {
  question: string;
  riskLevel: "低风险" | "中等风险" | "高风险";
  score: number;
  confidence: number;
  detectedKeypoints: number;
  findings: Finding[];
  riskPoints: RiskPoint[];
  summary: string;
};

export type PostureExplainResponse = {
  title: string;
  summary: string;
  explanation: string;
  suggestions: string[];
  medicalBoundary: string;
  followUpQuestion?: string;
};

