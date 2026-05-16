import { ChangeEvent, startTransition, useEffect, useState } from "react";

type Stage = "capture" | "analyzing" | "result" | "report";

type RiskPoint = {
  label: string;
  value: number;
  tone: "high" | "mid";
  detail: string;
};

type Finding = {
  part: string;
  issue: string;
  severity: string;
  message: string;
};

const stageOrder: Stage[] = ["capture", "analyzing", "result", "report"];

const stageMeta: Record<Stage, { title: string; subtitle: string; cta: string }> = {
  capture: {
    title: "Capture",
    subtitle: "拍下当前坐姿，系统从颈部、肩线和腰背入手做风险筛查。",
    cta: "开始分析",
  },
  analyzing: {
    title: "Analyzing",
    subtitle: "正在比对姿态关键点和久坐风险阈值，生成本次体检结果。",
    cta: "分析中",
  },
  result: {
    title: "Result",
    subtitle: "本次检测判定为中等姿势风险，重点关注颈部前伸和腰背负荷。",
    cta: "生成体检卡",
  },
  report: {
    title: "ReportCard",
    subtitle: "导出一张适合展示和复查的姿势体检卡。",
    cta: "重新检测",
  },
};

const sceneOptions = [
  { label: "久坐姿势", value: "久坐姿势" },
  { label: "站姿体态", value: "站姿体态" },
  { label: "深蹲动作", value: "深蹲动作" },
];

const defaultQuestion = "我这个坐姿哪里不对？";

const findings: Finding[] = [
  {
    part: "颈部",
    issue: "头前伸",
    severity: "明显",
    message: "头部重心前移，颈肩负担增加，长时间维持容易诱发酸胀。",
  },
  {
    part: "肩部",
    issue: "圆肩倾向",
    severity: "轻中度",
    message: "双肩轻微内扣，左侧更明显，胸廓打开不足。",
  },
  {
    part: "腰背",
    issue: "躯干前倾",
    severity: "中度",
    message: "上半身前倾明显，久坐时腰背支撑不足。",
  },
];

const suggestions = [
  "把屏幕上沿调整到接近眼平高度，减少持续低头。",
  "坐深椅背，让坐骨稳定落位，肩膀放松回正。",
  "每 30-45 分钟起身活动 2 分钟，做颈肩后缩和胸椎伸展。",
];

const riskPoints: RiskPoint[] = [
  {
    label: "颈部",
    value: 76,
    tone: "high",
    detail: "头前伸明显",
  },
  {
    label: "肩部",
    value: 64,
    tone: "mid",
    detail: "双肩轻度前扣",
  },
  {
    label: "腰背",
    value: 71,
    tone: "high",
    detail: "躯干前倾偏大",
  },
];

const overlayDots = [
  { top: "18%", left: "50%", label: "颈部" },
  { top: "31%", left: "42%", label: "肩部" },
  { top: "31%", left: "58%", label: "肩部" },
  { top: "52%", left: "48%", label: "腰背" },
  { top: "76%", left: "50%", label: "骨盆" },
];

export default function App() {
  const [stage, setStage] = useState<Stage>("capture");
  const [scene, setScene] = useState(sceneOptions[0].value);
  const [question, setQuestion] = useState(defaultQuestion);
  const [previewUrl, setPreviewUrl] = useState("/sample-posture.svg");

  useEffect(() => {
    if (stage !== "analyzing") {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      startTransition(() => {
        setStage("result");
      });
    }, 1800);

    return () => window.clearTimeout(timeoutId);
  }, [stage]);

  function goToNextStage() {
    if (stage === "capture") {
      startTransition(() => {
        setStage("analyzing");
      });
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
      return;
    }
  }

  function handleSampleFrame() {
    setPreviewUrl("/sample-posture.svg");
    setQuestion(defaultQuestion);
    setScene(sceneOptions[0].value);
    startTransition(() => {
      setStage("capture");
    });
  }

  function handleUploadChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const nextUrl = URL.createObjectURL(file);
    setPreviewUrl((currentUrl) => {
      if (currentUrl.startsWith("blob:")) {
        URL.revokeObjectURL(currentUrl);
      }
      return nextUrl;
    });
    startTransition(() => {
      setStage("capture");
    });
  }

  return (
    <main className="app-shell">
      <section className="phone-frame">
        <header className="topbar">
          <div>
            <p className="eyebrow">PoseCare / 视觉搜索 Demo</p>
            <h1>姿势问诊镜</h1>
          </div>
          <span className="status-pill">中等风险</span>
        </header>

        <nav className="stage-switcher" aria-label="流程状态">
          {stageOrder.map((item) => (
            <button
              key={item}
              type="button"
              className={item === stage ? "stage-btn active" : "stage-btn"}
              onClick={() => setStage(item)}
            >
              {stageMeta[item].title}
            </button>
          ))}
        </nav>

        <section className="hero-panel">
          <div className="hero-layout">
            <div className="hero-visual">
              <div className="scan-stage" data-stage={stage}>
                <div className="scan-grid" />
                <div className="pose-card">
                  <img className="pose-photo" src={previewUrl} alt="姿势检测样例" />
                  <div className="pose-overlay" aria-hidden="true">
                    <div className="skeleton skeleton-head" />
                    <div className="skeleton skeleton-neck" />
                    <div className="skeleton skeleton-shoulder" />
                    <div className="skeleton skeleton-spine" />
                    <div className="skeleton skeleton-hip" />
                    {overlayDots.map((dot) => (
                      <span
                        key={`${dot.top}-${dot.left}-${dot.label}`}
                        className="risk-dot"
                        style={{ top: dot.top, left: dot.left }}
                        title={dot.label}
                      />
                    ))}
                  </div>
                  <div className="scan-badge">AI posture overlay</div>
                </div>

                <div className="pulse-ring pulse-ring-1" />
                <div className="pulse-ring pulse-ring-2" />
              </div>

              <div className="visual-caption">
                <span>当前样例</span>
                <strong>久坐姿势 / 中等风险</strong>
              </div>
            </div>

            <div className="hero-side">
              <div className="hero-copy">
                <p className="eyebrow">{stageMeta[stage].title}</p>
                <h2>{stageMeta[stage].subtitle}</h2>
              </div>

              <div className="capture-tools">
                <div className="scene-tabs" aria-label="检测场景">
                  {sceneOptions.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      className={item.value === scene ? "scene-tab active" : "scene-tab"}
                      onClick={() => setScene(item.value)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="tool-row">
                  <label className="upload-btn">
                    上传图片
                    <input
                      accept="image/*"
                      type="file"
                      onChange={handleUploadChange}
                    />
                  </label>
                  <button type="button" className="ghost-btn" onClick={handleSampleFrame}>
                    使用样例
                  </button>
                  <button type="button" className="ghost-btn voice-btn">
                    按住提问
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
              </div>
            </div>
          </div>
        </section>

        <section className="metrics-strip">
          <div className="metric-chip">
            <span>场景</span>
            <strong>{scene}</strong>
          </div>
          <div className="metric-chip">
            <span>本次检测</span>
            <strong>12s</strong>
          </div>
          <div className="metric-chip">
            <span>置信度</span>
            <strong>93%</strong>
          </div>
        </section>

        {(stage === "result" || stage === "report") && (
          <>
            <section className="card-section">
              <div className="section-head">
                <h3>风险概览</h3>
                <span className="risk-label">Medium Risk</span>
              </div>

              <div className="risk-list">
                {riskPoints.map((item) => (
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
                  <span>3 条</span>
                </div>
                <ul className="bullet-list">
                  {findings.map((item) => (
                    <li key={item.issue}>
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
                  <h3>建议</h3>
                  <span>3 条</span>
                </div>
                <ul className="bullet-list">
                  {suggestions.map((item) => (
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

        {stage === "report" && (
          <section className="report-card">
            <div className="report-card__header">
              <div>
                <p className="eyebrow">PoseCare ReportCard</p>
                <h3>姿势体检卡</h3>
              </div>
              <span className="report-score">68 / 100</span>
            </div>

            <div className="report-layout">
              <img className="report-photo" src={previewUrl} alt="检测画面" />
              <div className="report-summary">
                <p className="report-highlight">
                  中等风险，重点关注颈部前伸、双肩前扣和腰背负荷。
                </p>
                <ul className="report-pills">
                  <li>颈部前伸</li>
                  <li>圆肩倾向</li>
                  <li>腰背前倾</li>
                </ul>
              </div>
            </div>

            <div className="report-advice">
              {suggestions.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          </section>
        )}

        <footer className="bottom-bar">
          <div>
            <strong>{stageMeta[stage].title}</strong>
            <span>{stageOrder.indexOf(stage) + 1}/4</span>
          </div>
          <button
            type="button"
            className="primary-btn"
            onClick={goToNextStage}
            disabled={stage === "analyzing"}
          >
            {stageMeta[stage].cta}
          </button>
        </footer>
      </section>
    </main>
  );
}
