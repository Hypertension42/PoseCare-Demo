import { ChangeEvent, startTransition, useMemo, useRef, useState } from "react";

import { detectPoseLandmarks } from "./pose/poseLandmarker";
import { analyzeSittingPosture } from "./pose/postureRules";
import type { LandmarkPoint, PostureAnalysis } from "./pose/types";

type Stage = "capture" | "analyzing" | "result" | "report";
type SpeechRecognitionEventLike = {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
};
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
type WindowWithSpeech = Window &
  typeof globalThis & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

const stageOrder: Stage[] = ["capture", "analyzing", "result", "report"];

const defaultQuestion = "我这个坐姿哪里不对？";
const sampleImageUrl = "/sample-posture.svg";

const stageTitle: Record<Stage, string> = {
  capture: "Capture",
  analyzing: "Analyzing",
  result: "Result",
  report: "ReportCard",
};

const poseConnections: Array<[number, number]> = [
  [0, 11],
  [0, 12],
  [11, 12],
  [11, 23],
  [12, 24],
  [23, 24],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片加载失败，请换一张清晰的单人坐姿图。"));
    image.src = src;
  });
}

function visibleLandmarks(landmarks: LandmarkPoint[]) {
  return landmarks.filter((landmark) => (landmark.visibility ?? 0) >= 0.45);
}

function connectionKey([from, to]: [number, number]) {
  return `${from}-${to}`;
}

function buildConnectionStyle(from: LandmarkPoint, to: LandmarkPoint) {
  const fromX = from.x * 100;
  const fromY = from.y * 100;
  const toX = to.x * 100;
  const toY = to.y * 100;
  const deltaX = toX - fromX;
  const deltaY = toY - fromY;
  const length = Math.hypot(deltaX, deltaY);
  const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

  return {
    left: `${fromX}%`,
    top: `${fromY}%`,
    width: `${length}%`,
    transform: `rotate(${angle}deg)`,
  };
}

export default function App() {
  const [stage, setStage] = useState<Stage>("capture");
  const [question, setQuestion] = useState(defaultQuestion);
  const [previewUrl, setPreviewUrl] = useState(sampleImageUrl);
  const [analysis, setAnalysis] = useState<PostureAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isModelReady, setIsModelReady] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported] = useState(() => {
    const speechWindow = window as WindowWithSpeech;
    return Boolean(speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition);
  });
  const latestBlobUrl = useRef<string | null>(null);

  const landmarks = analysis?.landmarks ?? [];
  const visiblePoints = useMemo(() => visibleLandmarks(landmarks), [landmarks]);
  const canShowResult = stage === "result" || stage === "report";

  async function runAnalysis() {
    setStage("analyzing");
    setAnalysisError(null);

    try {
      const image = await loadImage(previewUrl);
      const detectedLandmarks = await detectPoseLandmarks(image);
      setIsModelReady(true);

      if (detectedLandmarks.length === 0) {
        setAnalysis(null);
        setAnalysisError("没有识别到完整人体姿态。请上传清晰、单人、上半身和骨盆都在画面里的坐姿照片。");
        setStage("capture");
        return;
      }

      const nextAnalysis = analyzeSittingPosture(detectedLandmarks, question);

      if (!nextAnalysis) {
        setAnalysis(null);
        setAnalysisError("关键点不足，暂时无法评估颈肩腰背。请换一张人体更完整的坐姿图片。");
        setStage("capture");
        return;
      }

      startTransition(() => {
        setAnalysis(nextAnalysis);
        setStage("result");
      });
    } catch (error) {
      setAnalysis(null);
      setAnalysisError(error instanceof Error ? error.message : "姿态识别失败，请稍后重试。");
      setStage("capture");
    }
  }

  function goToNextStage() {
    if (stage === "capture") {
      void runAnalysis();
      return;
    }

    if (stage === "result") {
      startTransition(() => {
        setStage("report");
      });
      return;
    }

    if (stage === "report") {
      startTransition(() => {
        setStage("capture");
      });
    }
  }

  function handleSampleFrame() {
    if (latestBlobUrl.current) {
      URL.revokeObjectURL(latestBlobUrl.current);
      latestBlobUrl.current = null;
    }

    setPreviewUrl(sampleImageUrl);
    setQuestion(defaultQuestion);
    setAnalysis(null);
    setAnalysisError(null);
    startTransition(() => {
      setStage("capture");
    });
  }

  function handleUploadChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (latestBlobUrl.current) {
      URL.revokeObjectURL(latestBlobUrl.current);
    }

    const nextUrl = URL.createObjectURL(file);
    latestBlobUrl.current = nextUrl;
    setPreviewUrl(nextUrl);
    setAnalysis(null);
    setAnalysisError(null);
    startTransition(() => {
      setStage("capture");
    });
  }

  function handleVoiceQuestion() {
    const speechWindow = window as WindowWithSpeech;
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

    if (!Recognition) {
      setAnalysisError("当前浏览器不支持语音识别，请直接输入问题。");
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "zh-CN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript.trim();
      if (transcript) {
        setQuestion(transcript);
        setAnalysis(null);
      }
    };
    recognition.onerror = () => {
      setAnalysisError("语音识别失败，请换文字输入。");
    };
    recognition.onend = () => {
      setIsListening(false);
    };

    setAnalysisError(null);
    setIsListening(true);
    recognition.start();
  }

  const currentSubtitle =
    stage === "capture"
      ? "上传一张清晰坐姿图，AI 会读取人体关键点，再回答你的姿势问题。"
      : stage === "analyzing"
        ? "正在加载姿态模型并检测人体关键点，随后用坐姿规则生成风险结果。"
        : analysis?.summary ?? "请先完成一次坐姿图片分析。";

  const ctaText =
    stage === "capture"
      ? "开始真实分析"
      : stage === "analyzing"
        ? "识别中"
        : stage === "result"
          ? "生成体检卡"
          : "重新检测";

  return (
    <main className="app-shell">
      <section className="phone-frame">
        <header className="topbar">
          <div>
            <p className="eyebrow">PoseCare / 视觉搜索 Demo</p>
            <h1>姿势问诊镜</h1>
          </div>
          <span className={`status-pill ${analysis ? analysis.riskPoints[0]?.tone ?? "mid" : "mid"}`}>
            {analysis?.riskLevel ?? "待分析"}
          </span>
        </header>

        <nav className="stage-switcher" aria-label="流程状态">
          {stageOrder.map((item) => (
            <button
              key={item}
              type="button"
              className={item === stage ? "stage-btn active" : "stage-btn"}
              onClick={() => setStage(item)}
              disabled={item === "analyzing" || ((item === "result" || item === "report") && !analysis)}
            >
              {stageTitle[item]}
            </button>
          ))}
        </nav>

        <section className="hero-panel">
          <div className="hero-layout">
            <div className="hero-visual">
              <div className="scan-stage" data-stage={stage}>
                <div className="scan-grid" />
                <div className="pose-card">
                  <img className="pose-photo" src={previewUrl} alt="姿势检测画面" />
                  <div className="pose-overlay" aria-hidden="true">
                    {poseConnections.map(([fromIndex, toIndex]) => {
                      const from = landmarks[fromIndex];
                      const to = landmarks[toIndex];

                      if (!from || !to || (from.visibility ?? 0) < 0.35 || (to.visibility ?? 0) < 0.35) {
                        return null;
                      }

                      return (
                        <span
                          key={connectionKey([fromIndex, toIndex])}
                          className="pose-bone"
                          style={buildConnectionStyle(from, to)}
                        />
                      );
                    })}

                    {visiblePoints.map((landmark, index) => (
                      <span
                        key={`${index}-${landmark.x}-${landmark.y}`}
                        className="pose-landmark"
                        style={{ left: `${landmark.x * 100}%`, top: `${landmark.y * 100}%` }}
                      />
                    ))}

                    {analysis?.riskPoints.map((item) => {
                      const target =
                        item.label === "颈部"
                          ? landmarks[0]
                          : item.label === "肩线"
                            ? landmarks[11]
                            : landmarks[23];

                      if (!target) {
                        return null;
                      }

                      return (
                        <span
                          key={item.label}
                          className={`risk-dot ${item.tone}`}
                          style={{ left: `${target.x * 100}%`, top: `${target.y * 100}%` }}
                          title={item.detail}
                        />
                      );
                    })}
                  </div>
                  <div className="scan-badge">
                    {stage === "analyzing"
                      ? "detecting landmarks"
                      : analysis
                        ? `${analysis.detectedKeypoints} keypoints`
                        : "upload posture image"}
                  </div>
                </div>

                <div className="pulse-ring pulse-ring-1" />
                <div className="pulse-ring pulse-ring-2" />
              </div>

              <div className="visual-caption">
                <span>{isModelReady ? "模型已加载" : "模型待加载"}</span>
                <strong>{analysis ? `${analysis.riskLevel} / ${analysis.score} 分` : "久坐姿势 / 单图分析"}</strong>
              </div>
            </div>

            <div className="hero-side">
              <div className="hero-copy">
                <p className="eyebrow">{stageTitle[stage]}</p>
                <h2>{currentSubtitle}</h2>
              </div>

              <div className="capture-tools">
                <div className="scene-tabs" aria-label="检测场景">
                  <button type="button" className="scene-tab active">
                    久坐姿势
                  </button>
                  <button type="button" className="scene-tab locked" disabled>
                    站姿待支持
                  </button>
                  <button type="button" className="scene-tab locked" disabled>
                    深蹲待支持
                  </button>
                </div>

                <div className="tool-row">
                  <label className="upload-btn">
                    上传图片
                    <input accept="image/*" type="file" onChange={handleUploadChange} />
                  </label>
                  <button type="button" className="ghost-btn" onClick={handleSampleFrame}>
                    使用样例
                  </button>
                  <button
                    type="button"
                    className={isListening ? "ghost-btn voice-btn active" : "ghost-btn voice-btn"}
                    onClick={handleVoiceQuestion}
                    disabled={!speechSupported || isListening}
                  >
                    {speechSupported ? (isListening ? "正在听" : "语音提问") : "语音不可用"}
                  </button>
                </div>

                <label className="question-box">
                  <span>提问</span>
                  <textarea
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    rows={2}
                  />
                </label>

                {analysisError && <p className="inline-error">{analysisError}</p>}
              </div>
            </div>
          </div>
        </section>

        <section className="metrics-strip">
          <div className="metric-chip">
            <span>场景</span>
            <strong>久坐姿势</strong>
          </div>
          <div className="metric-chip">
            <span>关键点</span>
            <strong>{analysis ? analysis.detectedKeypoints : "--"}</strong>
          </div>
          <div className="metric-chip">
            <span>置信度</span>
            <strong>{analysis ? `${analysis.confidence}%` : "--"}</strong>
          </div>
        </section>

        {canShowResult && analysis && (
          <>
            <section className="card-section">
              <div className="section-head">
                <h3>风险概览</h3>
                <span className={`risk-label ${analysis.riskPoints[0]?.tone ?? "mid"}`}>
                  {analysis.riskLabel}
                </span>
              </div>

              <div className="risk-list">
                {analysis.riskPoints.map((item) => (
                  <div key={item.label} className="risk-row">
                    <div className="risk-title">
                      <strong>{item.label}</strong>
                      <p>{item.detail}</p>
                    </div>
                    <div className="bar-wrap">
                      <div className={`bar ${item.tone}`} style={{ width: `${item.value}%` }} />
                    </div>
                    <span>{item.value}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="grid-two">
              <article className="info-card">
                <div className="section-head">
                  <h3>发现</h3>
                  <span>{analysis.findings.length} 条</span>
                </div>
                <ul className="bullet-list">
                  {analysis.findings.map((item) => (
                    <li key={`${item.part}-${item.issue}`}>
                      <strong>
                        {item.part} / {item.issue} / {item.severity}
                      </strong>
                      <span>{item.message}</span>
                    </li>
                  ))}
                </ul>
              </article>

              <article className="info-card">
                <div className="section-head">
                  <h3>{analysis.guidance.title}</h3>
                  <span>问题驱动</span>
                </div>
                <p className="agent-answer">{analysis.guidance.answer}</p>
                <ul className="bullet-list compact">
                  {analysis.guidance.suggestions.map((item) => (
                    <li key={item}>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            </section>

            <section className="medical-note">
              <h3>医学边界提示</h3>
              <p>
                本结果用于姿势风险筛查与健康提醒，不替代医生诊断。若疼痛持续、麻木加重或存在外伤，请及时就医。
              </p>
            </section>
          </>
        )}

        {stage === "report" && analysis && (
          <section className="report-card">
            <div className="report-card__header">
              <div>
                <p className="eyebrow">PoseCare ReportCard</p>
                <h3>姿势体检卡</h3>
              </div>
              <span className="report-score">{analysis.score} / 100</span>
            </div>

            <div className="report-layout">
              <img className="report-photo" src={previewUrl} alt="检测画面" />
              <div className="report-summary">
                <p className="report-highlight">{analysis.summary}</p>
                <ul className="report-pills">
                  {analysis.findings.map((item) => (
                    <li key={`${item.part}-${item.issue}`}>{item.issue}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="report-advice">
              {analysis.guidance.suggestions.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          </section>
        )}

        <footer className="bottom-bar">
          <div>
            <strong>{stageTitle[stage]}</strong>
            <span>{stageOrder.indexOf(stage) + 1}/4</span>
          </div>
          <button
            type="button"
            className="primary-btn"
            onClick={goToNextStage}
            disabled={stage === "analyzing"}
          >
            {ctaText}
          </button>
        </footer>
      </section>
    </main>
  );
}
