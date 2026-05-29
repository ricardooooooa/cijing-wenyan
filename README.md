# 辞镜

输入现代汉语，输出规范文言文。前端仍可托管在 GitHub Pages；AI 密钥只放在独立后端环境变量中。

## 架构

```text
GitHub Pages(public/) -> DeepSeek API
```

GitHub Pages 不能运行 `/api/translate` 与 `/api/config`。如果后端部署在 Vercel，国内微信网络可能打不开。当前 GitHub Pages 线上版采用最简单的国内可用方案：浏览器直连 DeepSeek 官方 API，首次使用时在本机浏览器输入 DeepSeek Key。

Key 不写进仓库、不写进 HTML/JS 固定代码，也不会由 GitHub Pages 下发；它只保存在当前浏览器的 `localStorage`，请求时直接发给 DeepSeek。

备用后端接口仍保留：

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

## GitHub Pages 国内直连方案

`public/runtime-config.js` 在 GitHub Pages 域名下启用直连 DeepSeek：

```js
if (window.location.hostname.endsWith("github.io")) {
  window.CIJING_DIRECT_DEEPSEEK = true;
  window.CIJING_DIRECT_DEEPSEEK_MODEL = "deepseek-v4-pro";
}
```

使用方式：

1. 打开 GitHub Pages 页面。
2. 第一次点击转换时，输入 DeepSeek API Key。
3. 之后同一台手机/浏览器会自动复用本机保存的 Key。
4. 如果 Key 输错，接口返回 401/403 后会自动清除，下次点击会重新提示输入。

## 备用：部署 Vercel 后端

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

如需让 GitHub Pages 走 Vercel 后端，关闭 `CIJING_DIRECT_DEEPSEEK`，改用 `window.CIJING_API_BASE = "https://你的-vercel-域名"`。

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
