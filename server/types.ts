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

export type PersonaMetrics = {
  shoulderEase: number;
  balance: number;
  lineFlow: number;
  relaxation: number;
  presence: number;
  stability: number;
};

export type BodyPersonaGenerateRequest = {
  imageDataUrl: string;
  localPersona: {
    personaName: string;
    postureId: string;
    description: string;
    keywords: string[];
    strengths: string[];
    metrics: PersonaMetrics;
    detectedKeypoints: number;
    confidence: number;
  };
};

export type BodyPersonaGenerateResponse = {
  personaName: string;
  description: string;
  keywords: string[];
  strengths: string[];
  journal: Array<{
    title: string;
    subtitle: string;
    items: string[];
  }>;
  dailyCard: {
    moodName: string;
    energy: number;
    keywords: string[];
    healingCopy: string;
  };
  weeklyCard: {
    summary: string;
    keywords: string[];
    changes: Array<{ label: string; value: number }>;
    nextSuggestion: string;
  };
  communityPreview: {
    groupName: string;
    similarity: number;
    inspirations: string[];
  };
};
