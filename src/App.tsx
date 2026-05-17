import { ChangeEvent, startTransition, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { analyzeBodyPersona, type BodyPersonaResult } from "./pose/bodyPersona";
import { detectPoseLandmarks } from "./pose/poseLandmarker";
import { analyzeSittingPosture } from "./pose/postureRules";
import type { AIExplanation, LandmarkPoint, PostureAnalysis } from "./pose/types";

type Stage = "capture" | "persona" | "journal" | "community";
type ModuleView = "persona" | "posture";

const sampleImageUrl = "/sample-posture.svg";
const IMAGES = [
  { src: "https://fifth-gentle-45902158.figma.site/_components/v2/4de492f6d9cf8244ad5293233e5c6f52407d42fc/1.02464a56.png", bg: "#F4845F", panel: "#F79B7F" },
  { src: "https://fifth-gentle-45902158.figma.site/_components/v2/4de492f6d9cf8244ad5293233e5c6f52407d42fc/2.b977faab.png", bg: "#6BBF7A", panel: "#85CC92" },
  { src: "https://fifth-gentle-45902158.figma.site/_components/v2/4de492f6d9cf8244ad5293233e5c6f52407d42fc/3.4df853b4.png", bg: "#E882B4", panel: "#ED9DC4" },
  { src: "https://fifth-gentle-45902158.figma.site/_components/v2/4de492f6d9cf8244ad5293233e5c6f52407d42fc/4.4457fbce.png", bg: "#6EB5FF", panel: "#8DC4FF" },
] as const;
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
    image.onerror = () => reject(new Error("图片加载失败，请换一张清晰的全身体态照片。"));
    image.src = src;
  });
}

function visibleLandmarks(landmarks: LandmarkPoint[]) {
  return landmarks.filter((landmark) => (landmark.visibility ?? 0) >= 0.45);
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

function metricEntries(result: BodyPersonaResult) {
  return [
    ["肩颈舒展", result.metrics.shoulderEase],
    ["重心平衡", result.metrics.balance],
    ["线条延展", result.metrics.lineFlow],
    ["松弛感", result.metrics.relaxation],
    ["气质外放", result.metrics.presence],
    ["站姿稳定", result.metrics.stability],
  ] as const;
}

function journalGuides(result: BodyPersonaResult) {
  return result.journal.filter((section) => ["体态穿搭推荐", "拍照姿势推荐", "放松运动推荐"].includes(section.title));
}

function guideByTitle(result: BodyPersonaResult, title: string) {
  return journalGuides(result).find((section) => section.title === title);
}

function weeklyMoodCurve(result: BodyPersonaResult) {
  const today = result.dailyCard.energy;
  const relaxationDelta = result.weeklyCard.changes.find((item) => item.label === "松弛感")?.value ?? 8;
  const stretchDelta = result.weeklyCard.changes.find((item) => item.label === "舒展度")?.value ?? 6;
  const start = Math.max(42, today - relaxationDelta - Math.round(stretchDelta / 2));
  const labels = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

  return labels.map((label, index) => {
    const progress = index / (labels.length - 1);
    const wave = Math.sin(index * 1.15) * 4;
    const value = Math.round(start + (today - start) * progress + wave);
    return { label, value: Math.min(96, Math.max(35, value)) };
  });
}

export default function App() {
  const [stage, setStage] = useState<Stage>("capture");
  const [previewUrl, setPreviewUrl] = useState(sampleImageUrl);
  const [result, setResult] = useState<BodyPersonaResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [view, setView] = useState<"hero" | "content">("hero");
  const [moduleView, setModuleView] = useState<ModuleView>("persona");
  const [postureQuestion, setPostureQuestion] = useState("我这个坐姿哪里不对？");
  const [postureAnalysis, setPostureAnalysis] = useState<PostureAnalysis | null>(null);
  const [postureAiError, setPostureAiError] = useState<string | null>(null);
  const [isPostureAiLoading, setIsPostureAiLoading] = useState(false);
  const latestBlobUrl = useRef<string | null>(null);

  const landmarks = result?.landmarks ?? [];
  const visiblePoints = visibleLandmarks(landmarks);
  const currentTheme = IMAGES[activeIndex];

  useEffect(() => {
    IMAGES.forEach((item) => {
      const image = new Image();
      image.src = item.src;
    });
  }, []);

  useEffect(() => {
    const updateMobile = () => setIsMobile(window.innerWidth < 640);
    updateMobile();
    window.addEventListener("resize", updateMobile);
    return () => window.removeEventListener("resize", updateMobile);
  }, []);

  useEffect(() => {
    return () => {
      if (latestBlobUrl.current) {
        URL.revokeObjectURL(latestBlobUrl.current);
      }
    };
  }, []);

  async function runAnalysisForSource(sourceUrl: string) {
    setStage("capture");
    setAnalysisError(null);
    setPostureAiError(null);
    setIsAnalyzing(true);

    try {
      const image = await loadImage(sourceUrl);
      const detectedLandmarks = await detectPoseLandmarks(image);

      if (detectedLandmarks.length === 0) {
        setResult(null);
        setPostureAnalysis(null);
        setAnalysisError("没有识别到完整人体姿态。请上传清晰、单人、尽量露出全身的照片。");
        return;
      }

      const nextResult = analyzeBodyPersona(detectedLandmarks);
      const nextPostureAnalysis = analyzeSittingPosture(detectedLandmarks, postureQuestion);
      if (!nextResult) {
        setResult(null);
        setPostureAnalysis(nextPostureAnalysis);
        setAnalysisError("关键点不足。请让头部、肩膀、骨盆和腿部都进入画面。");
        return;
      }

      startTransition(() => {
        setResult(nextResult);
        setPostureAnalysis(nextPostureAnalysis);
        setStage("persona");
      });

      if (nextPostureAnalysis) {
        void requestPostureExplanation(nextPostureAnalysis);
      }
    } catch (error) {
      setResult(null);
      setPostureAnalysis(null);
      setAnalysisError(error instanceof Error ? error.message : "体态识别失败，请稍后重试。");
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function requestPostureExplanation(analysis: PostureAnalysis) {
    setIsPostureAiLoading(true);
    setPostureAiError(null);

    try {
      const response = await fetch("/api/posture-explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: postureQuestion,
          riskLevel: analysis.riskLevel,
          score: analysis.score,
          confidence: analysis.confidence,
          detectedKeypoints: analysis.detectedKeypoints,
          findings: analysis.findings,
          riskPoints: analysis.riskPoints,
          summary: analysis.summary,
        }),
      });

      if (!response.ok) {
        throw new Error("AI 姿势解释接口暂不可用，已显示本地规则建议。");
      }

      const aiExplanation = (await response.json()) as AIExplanation;
      setPostureAnalysis((current) => (current ? { ...current, aiExplanation } : current));
    } catch (error) {
      setPostureAiError(error instanceof Error ? error.message : "AI 姿势解释失败，已显示本地规则建议。");
    } finally {
      setIsPostureAiLoading(false);
    }
  }

  function handlePostureQuestionSubmit() {
    if (!postureAnalysis) {
      void runAnalysisForSource(previewUrl);
      return;
    }

    const nextAnalysis = analyzeSittingPosture(postureAnalysis.landmarks, postureQuestion);
    if (!nextAnalysis) {
      setPostureAiError("关键点不足，无法生成坐姿问诊结果。");
      return;
    }

    setPostureAnalysis(nextAnalysis);
    void requestPostureExplanation(nextAnalysis);
  }

  function handlePhotoInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (latestBlobUrl.current) {
      URL.revokeObjectURL(latestBlobUrl.current);
    }

    const nextUrl = URL.createObjectURL(file);
    latestBlobUrl.current = nextUrl;
    setPreviewUrl(nextUrl);
    setResult(null);
    setPostureAnalysis(null);
    setAnalysisError(null);
    setStage("capture");
    event.target.value = "";
    void runAnalysisForSource(nextUrl);
  }

  function handleSampleFrame() {
    setPreviewUrl(sampleImageUrl);
    setResult(null);
    setPostureAnalysis(null);
    setAnalysisError(null);
    setStage("capture");
  }

  function navigate(direction: "next" | "prev") {
    if (isAnimating) return;
    setIsAnimating(true);
    setActiveIndex((current) => (direction === "next" ? (current + 1) % IMAGES.length : (current + IMAGES.length - 1) % IMAGES.length));
    window.setTimeout(() => setIsAnimating(false), 650);
  }

  async function shareDailyCard() {
    if (!result) return;

    const shareText = `${result.personaName}｜今日体态状态：${result.dailyCard.moodName}，状态值 ${result.dailyCard.energy}。${result.dailyCard.healingCopy}`;

    if (navigator.share) {
      await navigator.share({
        title: "我的今日体态状态卡",
        text: shareText,
      });
      return;
    }

    await navigator.clipboard?.writeText(shareText);
  }

  if (view === "hero") {
    return (
      <main className="app-shell has-hero">
        <section
          className="hero-panel hero-canvas"
          style={{ backgroundColor: currentTheme.bg, transition: "background-color 650ms cubic-bezier(0.4,0,0.2,1)" }}
        >
          <div className="toonhub-hero" style={{ backgroundColor: currentTheme.bg, transition: "background-color 650ms cubic-bezier(0.4,0,0.2,1)" }}>
            <div className="toonhub-grain" aria-hidden="true" />
            <div className="toonhub-ghost">3D SHAPE</div>
            <div className="toonhub-brand">TOONHUB</div>
            <div className="toonhub-carousel">
              {IMAGES.map((item, index) => {
                const center = activeIndex;
                const left = (activeIndex + IMAGES.length - 1) % IMAGES.length;
                const right = (activeIndex + 1) % IMAGES.length;
                const back = (activeIndex + 2) % IMAGES.length;
                const role = index === center ? "center" : index === left ? "left" : index === right ? "right" : index === back ? "back" : "back";
                const roleStyles = {
                  center: {
                    left: "50%",
                    bottom: isMobile ? "22%" : 0,
                    height: isMobile ? "60%" : "92%",
                    opacity: 1,
                    filter: "none",
                    transform: `translateX(-50%) scale(${isMobile ? 1.25 : 1.68})`,
                    zIndex: 20,
                  },
                  left: {
                    left: isMobile ? "20%" : "30%",
                    bottom: isMobile ? "32%" : "12%",
                    height: isMobile ? "16%" : "28%",
                    opacity: 0.85,
                    filter: "blur(2px)",
                    transform: "translateX(-50%) scale(1)",
                    zIndex: 10,
                  },
                  right: {
                    left: isMobile ? "80%" : "70%",
                    bottom: isMobile ? "32%" : "12%",
                    height: isMobile ? "16%" : "28%",
                    opacity: 0.85,
                    filter: "blur(2px)",
                    transform: "translateX(-50%) scale(1)",
                    zIndex: 10,
                  },
                  back: {
                    left: "50%",
                    bottom: isMobile ? "32%" : "12%",
                    height: isMobile ? "13%" : "22%",
                    opacity: 1,
                    filter: "blur(4px)",
                    transform: "translateX(-50%) scale(1)",
                    zIndex: 5,
                  },
                }[role];

                return (
                  <div
                    key={item.src}
                    className="toonhub-item"
                    style={{
                      ...roleStyles,
                      transition:
                        "transform 650ms cubic-bezier(0.4,0,0.2,1), filter 650ms cubic-bezier(0.4,0,0.2,1), opacity 650ms cubic-bezier(0.4,0,0.2,1), left 650ms cubic-bezier(0.4,0,0.2,1)",
                      willChange: "transform, filter, opacity",
                    }}
                  >
                    <img src={item.src} alt="" draggable={false} style={{ filter: "drop-shadow(0 26px 28px rgba(0, 0, 0, 0.18))" }} />
                  </div>
                );
              })}
            </div>
            <div className="toonhub-bottom-left">
              <p>TOONHUB FIGURINES</p>
              <p className="hidden-copy">
                The artwork is stunning, shipped fully prepared. The finish is a vision, the 3D craft is flawless. Many thanks! Wishing you the win. Order now.
              </p>
              <div className="toonhub-nav">
                <button type="button" onClick={() => navigate("prev")} aria-label="previous">
                  <ArrowLeft size={26} strokeWidth={2.25} />
                </button>
                <button type="button" onClick={() => navigate("next")} aria-label="next">
                  <ArrowRight size={26} strokeWidth={2.25} />
                </button>
              </div>
            </div>
            <button type="button" className="toonhub-link" onClick={() => setView("content")}>
              DISCOVER IT <ArrowRight size={20} strokeWidth={2.25} />
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell content-page">
      <section className="product-frame content-frame">
        <header className="topbar">
          <div>
            <p className="eyebrow">Posture Persona / v0.0.1</p>
            <h1>专属体态人格</h1>
          </div>
          <span className="status-pill">{result?.postureId ?? "AI 体态识别"}</span>
        </header>

        <section className="hero-panel">
            <div className="hero-copy">
              <p className="eyebrow">拍一张照，生成你的专属体态人格。</p>
              <h2>两个模块：体态人格负责表达，姿势问诊镜负责解释。</h2>
              <p>同一张照片会生成专属体态人格，也可以进入坐姿问诊，查看颈部、肩线和腰背的风险解释。</p>
            </div>
        </section>

        <nav className="module-switcher" aria-label="功能模块">
          <button type="button" className={moduleView === "persona" ? "active" : ""} onClick={() => setModuleView("persona")}>
            <span>模块 01</span>
            专属体态人格
          </button>
          <button type="button" className={moduleView === "posture" ? "active" : ""} onClick={() => setModuleView("posture")}>
            <span>模块 02</span>
            姿势问诊镜 Beta
          </button>
        </nav>

        <section className="content-shell" id="capture">
          <article className="persona-card primary-persona-card">
            <p className="eyebrow">{moduleView === "persona" ? "专属体态人格" : "姿势问诊镜 Beta"}</p>
            {moduleView === "posture" && postureAnalysis ? (
              <div className="posture-report-card">
                <div className="posture-score-head">
                  <span>{postureAnalysis.riskLabel}</span>
                  <strong>{postureAnalysis.score}</strong>
                </div>
                <h2>{postureAnalysis.riskLevel}</h2>
                <p>{postureAnalysis.summary}</p>
                <div className="risk-point-grid">
                  {postureAnalysis.riskPoints.map((point) => (
                    <div key={point.label} className={`risk-point tone-${point.tone}`}>
                      <span>{point.label}</span>
                      <strong>{point.value}</strong>
                      <em>{point.detail}</em>
                    </div>
                  ))}
                </div>
              </div>
            ) : moduleView === "posture" ? (
              <div className="empty-state posture-empty-state">
                <h2>上传一张坐姿照片。</h2>
                <p>系统会检测颈部、肩线和腰背状态，并回答你的姿势问题。</p>
              </div>
            ) : result ? (
              <>
                <div className="persona-cover">
                  <span>{result.postureId}</span>
                  <h2>{result.personaName}</h2>
                  <p>{result.description}</p>
                  <div className="keyword-row">
                    {result.keywords.map((keyword) => (
                      <strong key={keyword}>{keyword}</strong>
                    ))}
                  </div>
                </div>
                <div className="metrics-grid">
                  {metricEntries(result).map(([label, value]) => (
                    <div key={label} className="metric-tile">
                      <span>{label}</span>
                      <strong>{value}</strong>
                      <div className="bar-wrap">
                        <div className="bar" style={{ width: `${value}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="empty-state">
                <h2>生成您的体态风格。</h2>
                <p>上传或拍摄一张全身照，判断您的气质类型。</p>
              </div>
            )}
          </article>

          <article className="capture-card">
            <div className="scan-stage" data-stage={stage}>
              <div className="scan-grid" />
              <div className="pose-card">
                <img className="pose-photo" src={previewUrl} alt="体态识别画面" />
                <div className="pose-overlay" aria-hidden="true">
                  {poseConnections.map(([fromIndex, toIndex]) => {
                    const from = landmarks[fromIndex];
                    const to = landmarks[toIndex];
                    if (!from || !to || (from.visibility ?? 0) < 0.35 || (to.visibility ?? 0) < 0.35) {
                      return null;
                    }
                    return <span key={`${fromIndex}-${toIndex}`} className="pose-bone" style={buildConnectionStyle(from, to)} />;
                  })}
                  {visiblePoints.map((landmark, index) => (
                    <span key={`${index}-${landmark.x}-${landmark.y}`} className="pose-landmark" style={{ left: `${landmark.x * 100}%`, top: `${landmark.y * 100}%` }} />
                  ))}
                </div>
                <div className="scan-badge">{result ? `${result.detectedKeypoints} keypoints` : "full-body photo"}</div>
              </div>
              <div className="pulse-ring pulse-ring-1" />
              <div className="pulse-ring pulse-ring-2" />
            </div>

            <div className="capture-tools">
              <div className="tool-row">
                <label className="upload-btn camera-shot-btn">
                  现场拍一张照
                  <input accept="image/*" capture="environment" type="file" onChange={handlePhotoInputChange} />
                </label>
                <label className="upload-btn">
                  上传全身照
                  <input accept="image/*" type="file" onChange={handlePhotoInputChange} />
                </label>
                <button type="button" className="ghost-btn" onClick={handleSampleFrame}>
                  使用样例
                </button>
              </div>

              {analysisError && <p className="inline-error">{analysisError}</p>}
              <button type="button" className="primary-btn analysis-btn" onClick={() => void runAnalysisForSource(previewUrl)} disabled={isAnalyzing}>
                {isAnalyzing ? "正在生成" : "生成体态人格"}
              </button>
              <p className="capture-note">v0 默认不上传原始照片到大模型；当前用浏览器姿态关键点生成体态人格。后续可把结构化指标交给 DeepSeek 做文案增强。</p>
            </div>
          </article>
        </section>

        {moduleView === "posture" && (
          <section className="posture-consult-section">
            <article className="posture-question-card">
              <p className="eyebrow">Pose Consultation</p>
              <h2>姿势问诊镜</h2>
              <p>输入你想问的问题，系统会基于当前照片的姿态关键点回答。AI 接口不可用时，会自动使用本地规则建议。</p>
              <div className="posture-question-row">
                <input value={postureQuestion} onChange={(event) => setPostureQuestion(event.target.value)} placeholder="例如：我这个坐姿哪里不对？" />
                <button type="button" className="primary-btn" onClick={handlePostureQuestionSubmit} disabled={isAnalyzing || isPostureAiLoading}>
                  {isPostureAiLoading ? "AI 分析中" : "开始问诊"}
                </button>
              </div>
              {postureAiError && <p className="inline-error">{postureAiError}</p>}
            </article>

            {postureAnalysis && (
              <div className="posture-result-grid">
                <article className="posture-answer-card">
                  <p className="eyebrow">{postureAnalysis.aiExplanation ? "AI 姿势解释" : postureAnalysis.guidance.title}</p>
                  <h3>{postureAnalysis.aiExplanation?.title ?? postureAnalysis.guidance.title}</h3>
                  <p>{postureAnalysis.aiExplanation?.explanation ?? postureAnalysis.guidance.answer}</p>
                  <ul className="bullet-list compact">
                    {(postureAnalysis.aiExplanation?.suggestions ?? postureAnalysis.guidance.suggestions).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <small>{postureAnalysis.aiExplanation?.medicalBoundary ?? "本结果仅用于姿势风险筛查和生活方式建议，不能替代医生诊断。"}</small>
                </article>

                <article className="posture-findings-card">
                  <p className="eyebrow">关键发现</p>
                  <div className="finding-list">
                    {postureAnalysis.findings.map((finding) => (
                      <div key={`${finding.part}-${finding.issue}`}>
                        <span>{finding.severity}</span>
                        <strong>
                          {finding.part}：{finding.issue}
                        </strong>
                        <p>{finding.message}</p>
                      </div>
                    ))}
                  </div>
                </article>
              </div>
            )}
          </section>
        )}

        {result && (
          <>
            <section className="privacy-note">
              <strong>隐私与边界</strong>
              <p>默认不公开原始照片，不展示体重、三围等敏感数据；社区先只做剪影和内容预览。本产品用于生活方式建议，不做医学诊断。</p>
            </section>
          </>
        )}

        {moduleView === "persona" && result && (
          <>
            <section className="guide-section">
              <div className="guide-header">
                <p className="guide-badge">Persona Journal</p>
                <h2>体态人格小手账</h2>
                <p>
                  围绕你的专属体态人格
                  <br />
                  展开三类生活方式指南
                </p>
              </div>

              <div className="guide-grid">
                <article className="guide-card guide-card-photo">
                  <div className="guide-prompt">
                    {guideByTitle(result, "拍照姿势推荐")?.items.map((item) => (
                      <span key={item}>{item}</span>
                    ))}
                  </div>
                  <div className="guide-pill">
                    <strong>✦</strong>
                    专属拍照姿势
                  </div>
                  <svg className="guide-cursor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 2L20 11L11 13L9 22L4 2Z" />
                  </svg>
                  <h3>拍照姿势推荐</h3>
                </article>

                <article className="guide-card guide-card-style">
                  <div className="guide-style-stack">
                    {guideByTitle(result, "体态穿搭推荐")?.items.map((item) => (
                      <span key={item}>{item}</span>
                    ))}
                  </div>
                  <h3>穿搭指南</h3>
                </article>

                <article className="guide-card guide-card-relax">
                  <div className="guide-mesh" />
                  <div className="guide-relax-orb">
                    <span>3 min</span>
                  </div>
                  <div className="guide-search">
                    {guideByTitle(result, "放松运动推荐")?.items[0] ?? "放松动作"}
                  </div>
                  <h3>放松运动指南</h3>
                </article>
              </div>
            </section>

            <section className="status-grid">
              <article className="daily-card">
                <p className="eyebrow">今日体态状态卡</p>
                <h3>{result.dailyCard.moodName}</h3>
                <strong>{result.dailyCard.energy}</strong>
                <p>{result.dailyCard.healingCopy}</p>
                <div className="keyword-row">
                  {result.dailyCard.keywords.map((keyword) => (
                    <span key={keyword}>{keyword}</span>
                  ))}
                </div>
                <button type="button" className="share-card-btn" onClick={() => void shareDailyCard()}>
                  一键分享
                </button>
              </article>

              <article className="weekly-card">
                <p className="eyebrow">本周体态状态卡</p>
                <h3>{result.weeklyCard.summary}</h3>
                <div className="mood-curve-card">
                  <div className="mood-curve-head">
                    <span>本周体态情绪变化曲线</span>
                    <strong>{weeklyMoodCurve(result).at(-1)?.value ?? result.dailyCard.energy}</strong>
                  </div>
                  <div className="mood-curve-chart">
                    {weeklyMoodCurve(result).map((point) => (
                      <div key={point.label} className="mood-curve-day">
                        <div className="mood-curve-track">
                          <span style={{ height: `${point.value}%` }} />
                        </div>
                        <strong>{point.value}</strong>
                        <em>{point.label}</em>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="weekly-bars">
                  {result.weeklyCard.changes.map((item) => (
                    <div key={item.label}>
                      <span>{item.label}</span>
                      <div className="bar-wrap">
                        <div className="bar" style={{ width: `${Math.min(100, item.value * 4)}%` }} />
                      </div>
                      <strong>+{item.value}%</strong>
                    </div>
                  ))}
                </div>
                <p>{result.weeklyCard.nextSuggestion}</p>
              </article>

              <article className="community-card">
                <p className="eyebrow">相似体态社区预览</p>
                <h3>{result.communityPreview.groupName}</h3>
                <strong>{result.communityPreview.similarity}% 相似</strong>
                <ul className="bullet-list compact">
                  {result.communityPreview.inspirations.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            </section>
          </>
        )}
      </section>
    </main>
  );
}
