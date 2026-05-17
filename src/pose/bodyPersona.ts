import type { LandmarkPoint } from "./types";

export type PersonaMetrics = {
  shoulderEase: number;
  balance: number;
  lineFlow: number;
  relaxation: number;
  presence: number;
  stability: number;
};

export type JournalSection = {
  title: string;
  subtitle: string;
  items: string[];
};

export type BodyPersonaResult = {
  landmarks: LandmarkPoint[];
  detectedKeypoints: number;
  confidence: number;
  personaName: string;
  postureId: string;
  description: string;
  keywords: string[];
  strengths: string[];
  metrics: PersonaMetrics;
  journal: JournalSection[];
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

const landmarkIndex = {
  nose: 0,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
};

const personaFamilies = [
  {
    prefix: "晨雾",
    symbol: "SWAN",
    base: "天鹅型人格",
    keywords: ["清透", "轻盈", "向上", "安静"],
    style: ["方领针织或微宽松衬衫，给肩颈保留呼吸感。", "高腰直筒裤、A 字半裙和垂坠面料会放大轻盈线条。", "配饰选细长耳饰、低饱和丝巾，避免过厚重的堆叠。"],
    pose: ["身体侧转 30 度，靠近镜头的脚向前半步。", "肩膀自然下沉，手臂和身体之间留一点空隙。", "镜头略低于胸口，眼神看向侧前方。"],
    relax: ["颈侧拉伸 30 秒，动作保持轻柔。", "肩膀向后画圈 60 秒，让胸腔慢慢打开。", "靠墙站立呼吸 90 秒，感受后背被支撑。"],
  },
  {
    prefix: "暖阳",
    symbol: "DEER",
    base: "小鹿型人格",
    keywords: ["柔和", "灵动", "恢复", "亲近"],
    style: ["柔软针织、短外套和轻量半裙适合你的亲近感。", "上半身可以用浅色或细纹理，把视觉重心抬起来。", "鞋包选择圆润廓形，减少过强硬的切割线。"],
    pose: ["一只脚轻轻点地，身体微微前倾。", "手可以搭在包带或发尾上，避免僵硬贴身。", "让下巴微收，保留自然笑意。"],
    relax: ["做 4 组慢呼吸，先把节奏降下来。", "胸前交叉抱肩再打开，重复 8 次。", "睡前用热毛巾敷肩颈 3 分钟。"],
  },
  {
    prefix: "山茶",
    symbol: "FLOW",
    base: "舒展型人格",
    keywords: ["舒展", "稳定", "明亮", "从容"],
    style: ["长线条外套、直筒裙和顺垂裤装能承接你的稳定感。", "领口适合 V 领、方领或开襟层次，增加上半身留白。", "颜色可以选奶油白、茶棕、橄榄绿这类温和但有质感的色系。"],
    pose: ["正面站姿时把重心放在两脚之间。", "手臂自然离开身体，肩颈保持向外打开。", "镜头保持平视，突出从容的站姿稳定感。"],
    relax: ["靠墙天使 8 次，感受肩胛慢慢滑动。", "猫牛式 60 秒，给脊柱一点流动感。", "髋部前侧拉伸左右各 40 秒。"],
  },
  {
    prefix: "月光",
    symbol: "LUNE",
    base: "清泉型人格",
    keywords: ["细腻", "流动", "克制", "松弛"],
    style: ["适合有流动感的衬衫、薄开衫和半透层次。", "裤装选择直线但不紧绷的版型，让身体线条更安静。", "避免大面积硬挺垫肩，保留自然垂落。"],
    pose: ["身体转向窗边或光源，形成柔和侧影。", "一只手轻触手腕或衣角，制造细腻动作。", "头部轻轻偏向高肩的反方向，让肩颈更舒展。"],
    relax: ["坐姿侧弯左右各 45 秒。", "手臂贴墙滑动 10 次，打开胸口。", "用 5 分钟慢走结束久坐状态。"],
  },
];

function clamp(value: number, min = 0, max = 100) {
  return Math.round(Math.min(max, Math.max(min, value)));
}

function point(landmarks: LandmarkPoint[], index: number) {
  const candidate = landmarks[index];
  if (!candidate || (candidate.visibility ?? 0) < 0.35) {
    return null;
  }
  return candidate;
}

function distance(a: LandmarkPoint, b: LandmarkPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function averageVisibility(landmarks: LandmarkPoint[]) {
  const visible = landmarks.filter((item) => (item.visibility ?? 0) >= 0.35);
  if (visible.length === 0) {
    return 0;
  }
  return visible.reduce((sum, item) => sum + (item.visibility ?? 0.5), 0) / visible.length;
}

function idNumber(metrics: PersonaMetrics, detectedKeypoints: number) {
  const raw =
    metrics.shoulderEase * 29 +
    metrics.balance * 31 +
    metrics.lineFlow * 17 +
    metrics.relaxation * 13 +
    metrics.presence * 11 +
    detectedKeypoints * 7;
  return String(raw % 10000).padStart(4, "0");
}

function chooseFamily(metrics: PersonaMetrics) {
  const openness = metrics.shoulderEase + metrics.lineFlow;
  const softness = metrics.relaxation + metrics.balance;
  const grounded = metrics.stability + metrics.balance;

  if (openness >= 150) {
    return personaFamilies[0];
  }
  if (softness >= 145) {
    return personaFamilies[1];
  }
  if (grounded >= 145) {
    return personaFamilies[2];
  }
  return personaFamilies[3];
}

export function analyzeBodyPersona(landmarks: LandmarkPoint[]): BodyPersonaResult | null {
  const leftShoulder = point(landmarks, landmarkIndex.leftShoulder);
  const rightShoulder = point(landmarks, landmarkIndex.rightShoulder);
  const leftHip = point(landmarks, landmarkIndex.leftHip);
  const rightHip = point(landmarks, landmarkIndex.rightHip);

  if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) {
    return null;
  }

  const detectedKeypoints = landmarks.filter((item) => (item.visibility ?? 0) >= 0.35).length;
  const confidence = clamp(averageVisibility(landmarks) * 100);
  const nose = point(landmarks, landmarkIndex.nose);
  const leftAnkle = point(landmarks, landmarkIndex.leftAnkle);
  const rightAnkle = point(landmarks, landmarkIndex.rightAnkle);
  const leftWrist = point(landmarks, landmarkIndex.leftWrist);
  const rightWrist = point(landmarks, landmarkIndex.rightWrist);

  const shoulderTilt = Math.abs(leftShoulder.y - rightShoulder.y);
  const hipTilt = Math.abs(leftHip.y - rightHip.y);
  const shoulderWidth = Math.max(distance(leftShoulder, rightShoulder), 0.01);
  const hipWidth = Math.max(distance(leftHip, rightHip), 0.01);
  const torsoCenterX = (leftShoulder.x + rightShoulder.x + leftHip.x + rightHip.x) / 4;
  const hipCenterX = (leftHip.x + rightHip.x) / 2;
  const shoulderCenterX = (leftShoulder.x + rightShoulder.x) / 2;
  const upperBodyLength = Math.max(Math.abs((leftHip.y + rightHip.y) / 2 - (leftShoulder.y + rightShoulder.y) / 2), 0.01);
  const ankleCenterX = leftAnkle && rightAnkle ? (leftAnkle.x + rightAnkle.x) / 2 : hipCenterX;
  const wristSpread = leftWrist && rightWrist ? distance(leftWrist, rightWrist) : shoulderWidth;

  const shoulderEase = clamp(92 - shoulderTilt * 280 - Math.abs(shoulderWidth - hipWidth) * 28 + confidence * 0.08);
  const balance = clamp(94 - Math.abs(torsoCenterX - 0.5) * 135 - Math.abs(shoulderCenterX - hipCenterX) * 190 - hipTilt * 160);
  const lineFlow = clamp(52 + upperBodyLength * 130 + (nose ? Math.max(0, leftShoulder.y - nose.y) * 80 : 0));
  const relaxation = clamp(72 - shoulderTilt * 150 + Math.min(wristSpread / shoulderWidth, 1.8) * 8 - Math.abs(shoulderCenterX - hipCenterX) * 80);
  const presence = clamp(48 + shoulderWidth * 130 + upperBodyLength * 55 + confidence * 0.12);
  const stability = clamp(92 - Math.abs(ankleCenterX - hipCenterX) * 155 - hipTilt * 120);
  const metrics = { shoulderEase, balance, lineFlow, relaxation, presence, stability };
  const family = chooseFamily(metrics);
  const postureId = `${family.prefix === "晨雾" ? "MIST" : family.prefix === "暖阳" ? "SUN" : family.prefix === "山茶" ? "CAMELLIA" : "MOON"}-${family.symbol}-${idNumber(metrics, detectedKeypoints)}`;
  const moodName = relaxation >= 76 ? "微风感松弛" : lineFlow >= 76 ? "慢慢打开" : balance >= 76 ? "安静回稳" : "被照顾的一天";
  const energy = clamp((shoulderEase + balance + lineFlow + relaxation + presence) / 5);

  return {
    landmarks,
    detectedKeypoints,
    confidence,
    personaName: `${family.prefix}${family.base}`,
    postureId,
    description: `你拥有一种${family.keywords[0]}、${family.keywords[1]}的身体气质。肩颈和重心里能看到自己的节奏，线条不是被评判的对象，而是你表达气质的线索。`,
    keywords: family.keywords,
    strengths: [
      shoulderEase >= 72 ? "肩颈有自然留白，适合放大清爽感。" : "肩颈今天有些疲惫，稍微打开就会更轻盈。",
      balance >= 72 ? "身体重心比较稳定，镜头前容易显得从容。" : "重心还有更舒展的空间，适合用站姿和呼吸慢慢找回稳定。",
      lineFlow >= 72 ? "线条延展感明显，适合长线条穿搭和侧身拍照。" : "线条正在恢复打开，柔和层次会比强硬剪裁更友好。",
    ],
    metrics,
    journal: [
      {
        title: "体态气质档案",
        subtitle: "把身体特征翻译成温和的气质语言。",
        items: [
          `肩颈舒展度 ${shoulderEase}：${shoulderEase >= 75 ? "有向外打开的轻盈感。" : "有些保护感，适合先做低强度放松。"}`,
          `站姿稳定感 ${stability}：${stability >= 75 ? "重心比较安定，画面感更从容。" : "可以通过双脚均匀站立来找回支撑。"}`,
          `线条延展感 ${lineFlow}：${lineFlow >= 75 ? "身体纵向线条清楚。" : "还有慢慢打开的空间。"}`,
        ],
      },
      { title: "体态穿搭推荐", subtitle: "不是流行什么穿什么，而是找到适合你的身体气质。", items: family.style },
      { title: "拍照姿势推荐", subtitle: `你的专属拍照姿势：${family.prefix}侧身站。`, items: family.pose },
      { title: "放松运动推荐", subtitle: "今天不用用力改变身体，只需要让身体慢慢打开。", items: family.relax },
      {
        title: "相似体态灵感页",
        subtitle: "先做精选预览，后续再接真实社区。",
        items: ["查看同人格用户的穿搭比例。", "收藏相似体态的拍照姿势。", "把状态卡同步到同人格小组。"],
      },
    ],
    dailyCard: {
      moodName,
      energy,
      keywords: energy >= 76 ? ["轻盈", "恢复", "安静", "柔软"] : ["照顾", "回稳", "呼吸", "打开"],
      healingCopy: "你今天的身体像一阵慢慢吹开的风，不急着证明什么，只是在恢复自己的节奏。",
    },
    weeklyCard: {
      summary: "从轻微收缩到慢慢舒展，身体正在找回更舒服的节奏。",
      keywords: ["恢复", "打开", "轻盈"],
      changes: [
        { label: "松弛感", value: Math.max(6, relaxation - 58) },
        { label: "舒展度", value: Math.max(5, shoulderEase - 60) },
        { label: "活力感", value: Math.max(4, presence - 62) },
        { label: "自信感", value: Math.max(5, balance - 61) },
      ],
      nextSuggestion: "下周保持每天一次全身照打卡，重点观察肩颈留白和站姿重心。",
    },
    communityPreview: {
      groupName: `${family.prefix}${family.base}小组`,
      similarity: clamp((balance + shoulderEase + lineFlow) / 3 + 8, 72, 96),
      inspirations: ["同人格方领穿搭合集", "自然侧身站拍照模板", "3 分钟肩颈云朵放松"],
    },
  };
}
