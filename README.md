# 辞镜

输入现代汉语，输出规范文言文。前端仍可托管在 GitHub Pages；AI 密钥只放在独立后端环境变量中。

## 架构

```text
GitHub Pages(public/) -> window.CIJING_API_BASE -> Vercel Serverless(/api/*) -> DeepSeek
```

GitHub Pages 不能运行 `/api/translate` 与 `/api/config`，所以线上 AI 必须走独立后端。当前默认后端按 Vercel Serverless 配置，接口为：

```text
GET  /api/config
POST /api/translate
```

## 本地运行

复制环境变量模板：

```powershell
Copy-Item .env.example .env
```

填写 `.env`：

```text
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=你的 DeepSeek Key
AI_BASE_URL=https://api.deepseek.com
AI_MODEL=deepseek-v4-pro
AI_MAX_OUTPUT_TOKENS=1600
CORS_ORIGIN=http://localhost:4173
```

启动：

```powershell
npm start
```

打开：

```text
http://localhost:4173
```

## 部署 Vercel 后端

在 Vercel 导入这个 GitHub 仓库，项目会使用根目录 `vercel.json` 与 `api/*` serverless 函数。

在 Vercel Project Settings -> Environment Variables 设置：

```text
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=你的 DeepSeek Key
AI_BASE_URL=https://api.deepseek.com
AI_MODEL=deepseek-v4-pro
AI_MAX_OUTPUT_TOKENS=1600
CORS_ORIGIN=https://ricardooooooa.github.io
```

部署完成后，确认：

```text
https://你的-vercel-域名/api/config
```

返回里应有：

```json
{"provider":"deepseek","providerLabel":"DeepSeek","model":"deepseek-v4-pro","online":true}
```

## 连接 GitHub Pages 前端

`public/runtime-config.js` 负责把静态页面指向后端：

```js
if (!window.CIJING_API_BASE && window.location.hostname.endsWith("github.io")) {
  window.CIJING_API_BASE = "https://cijing-wenyan.vercel.app";
}
```

如果 Vercel 给你的域名不是这个，改成你的实际后端域名后重新发布 GitHub Pages。本地 `localhost` 不会被强制指向 Vercel，仍走本地 `/api/*`。不要把任何 API Key 写进 `runtime-config.js`、`app.js` 或 HTML。

## 发布 GitHub Pages

```powershell
git subtree split --prefix public -b gh-pages
git push --force-with-lease origin gh-pages:gh-pages
git branch -D gh-pages
```

线上页面：

```text
https://ricardooooooa.github.io/cijing-wenyan/
```

## 切换 LLM

保持 OpenAI 兼容接口时，只改后端环境变量：

```text
AI_PROVIDER=custom
AI_API_KEY=你的密钥
AI_BASE_URL=https://api.example.com/v1
AI_MODEL=provider/model-name
```

已内置：`deepseek`、`mimo`、`dashscope`、`openrouter`、`openai`、`custom`。

## 文件

- `lib/ai-core.js`：统一 AI 配置、教学级 prompt、DeepSeek 调用、CORS、API 处理
- `api/config.js`：Vercel `/api/config`
- `api/translate.js`：Vercel `/api/translate`
- `vercel.json`：Vercel serverless 配置
- `server.js`：本地静态服务，并复用同一套 API 逻辑
- `public/runtime-config.js`：GitHub Pages 前端的后端地址注入点
- `public/app.js`：前端交互逻辑，后端不可达时才走离线兜底
- `worker.js`：Cloudflare Worker 备用后端
- `edge-functions/api/*`：EdgeOne 备用后端
