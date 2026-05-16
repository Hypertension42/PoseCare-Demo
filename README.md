# PoseCare Demo

PoseCare 是医学健康方向的赛道二 Demo。用户上传一张坐姿照片，系统使用浏览器端姿态识别读取人体关键点，再输出颈部、肩线、腰背风险、纠正建议和可分享的姿势体检卡。

## v0.0.4 范围

- 保留移动端 Web/H5 前端外壳和报告卡设计。
- 支持单张图片上传和内置样例展示。
- 支持浏览器摄像头预览，并可拍照后直接进入分析。
- 接入 MediaPipe Pose Landmarker，在浏览器端识别人体关键点。
- 根据鼻子、肩膀、髋部关键点计算坐姿风险。
- 分析完成后，把结构化结果发送到后端，再调用 DeepSeek API 生成姿势解释。
- 支持浏览器语音识别时的语音提问；不支持时使用文字输入兜底。
- 若 AI 接口不可用，则自动回退到本地模板解释。

## 当前边界

- v0.0.4 主打“久坐姿势”一个场景。
- 站姿、深蹲、康复动作暂不作为稳定演示范围。
- 内置样例是手绘图，模型可能无法识别；正式演示应上传清晰、单人、上半身和骨盆都在画面里的真实坐姿照片。
- 摄像头版本当前采用“预览 -> 拍照 -> 单图分析”链路，还没有接连续视频识别。
- 本结果用于姿势风险筛查和健康提醒，不替代医生诊断。
- AI key 只放在服务端，不放在浏览器端。

## 本地运行

```bash
npm install
cp .env.example .env
npm run dev
```

`.env` 至少需要配置：

```bash
AI_PROVIDER=deepseek
AI_API_KEY=your_key_here
AI_BASE_URL=https://api.deepseek.com
AI_MODEL=deepseek-v4-flash
```

## 构建

```bash
npm run build
```

## 部署到 Vercel

本项目已经适配 Vercel：

- 前端：Vite 构建到 `dist/`
- 后端：`api/health.ts` 和 `api/posture-explain.ts` 作为 Vercel Serverless Functions

在 Vercel 新建项目时选择该 GitHub 仓库，保持默认 Vite 配置即可：

```bash
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

然后在 Vercel Project Settings -> Environment Variables 配置：

```bash
AI_PROVIDER=deepseek
AI_API_KEY=your_key_here
AI_BASE_URL=https://api.deepseek.com
AI_MODEL=deepseek-v4-flash
```

部署后可以访问 `/api/health` 检查服务端环境变量是否生效。

## 架构文档

详细架构见：

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
