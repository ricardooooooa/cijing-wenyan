# 辞镜

一个本地运行的网页应用：输入现代汉语，输出对应文言文。前端负责高级质感交互，后端负责安全调用 AI。

## 运行

```powershell
npm start
```

打开：

```text
http://localhost:4173
```

## 微信可打开的线上链接

已发布到 Cloudflare Worker：

```text
https://cijing-wenyan.lumingfei693.workers.dev
```

这个链接是 HTTPS，可直接复制到微信聊天里打开。线上接口也在同一个域名下，密钥保存在 Cloudflare Worker Secret 中，不会暴露给浏览器。

## 默认模型

当前默认接入小米 MiMo：

```text
AI_PROVIDER=mimo
MIMO_API_KEY=你的 MiMo 密钥
AI_MODEL=mimo-v2.5-pro
```

未配置密钥时，页面会自动使用离线预览，方便先看界面和流程。

## 随时切换 LLM

复制 `.env.example` 为 `.env`，改下面三项即可：

```text
AI_PROVIDER=custom
AI_API_KEY=你的密钥
AI_BASE_URL=https://api.example.com/v1
AI_MODEL=provider/model-name
```

已内置预设：`mimo`、`deepseek`、`dashscope`、`openrouter`、`openai`、`custom`。多数 OpenAI 兼容接口不需要改代码，只换 `.env`。

## 发布

首次或换密钥后，把密钥写入 Cloudflare Worker Secret：

```powershell
$mimoKey = (Get-Content .env | Where-Object { $_ -match '^MIMO_API_KEY=' }) -replace '^MIMO_API_KEY=', ''
$mimoKey | npx wrangler secret put MIMO_API_KEY
```

发布：

```powershell
npm run deploy
```

## 文件

- `server.js`：本地网页服务、AI 提供商预设、转换接口
- `worker.js`：Cloudflare Worker 线上服务和 AI 代理
- `wrangler.toml`：Cloudflare Worker 发布配置
- `public/index.html`：页面结构
- `public/styles.css`：界面视觉
- `public/app.js`：交互逻辑
- `public/assets/ink-paper-bg.png`：背景素材
