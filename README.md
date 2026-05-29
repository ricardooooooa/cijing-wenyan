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

## 当前线上链接

海外/备用链接：

```text
https://cijing-wenyan.lumingfei693.workers.dev
```

国内微信不建议使用 `workers.dev`，它在大陆网络可能需要代理。当前项目已新增腾讯 EdgeOne Pages 结构：`edgeone.json` 与 `edge-functions/api/*`。部署到 EdgeOne 后，页面和 API 都在国内可访问域名下，密钥放在 EdgeOne 环境变量里，不会暴露给浏览器。

## 最简非腾讯路线：Zeabur

如果不想用腾讯云/实名认证，最简单路线是把整个 Node 服务部署到 Zeabur。这个项目已经是单服务结构：`server.js` 同时提供页面和 `/api/translate`，密钥只放在 Zeabur 环境变量里。

部署时设置：

```text
MIMO_API_KEY=你的 MiMo 密钥
AI_PROVIDER=mimo
AI_MODEL=mimo-v2.5-pro
AI_MAX_OUTPUT_TOKENS=1600
```

项目里已提供 `zbpack.json`：

```text
build_command: npm ci
start_command: npm start
```

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

### Cloudflare Worker 备用发布

首次或换密钥后，把密钥写入 Cloudflare Worker Secret：

```powershell
$mimoKey = (Get-Content .env | Where-Object { $_ -match '^MIMO_API_KEY=' }) -replace '^MIMO_API_KEY=', ''
$mimoKey | npx wrangler secret put MIMO_API_KEY
```

发布：

```powershell
npm run deploy
```

### 腾讯 EdgeOne Pages 国内发布

EdgeOne Pages 适合国内微信访问。需要在 EdgeOne Pages 控制台创建项目，并设置这些环境变量：

```text
AI_PROVIDER=mimo
MIMO_API_KEY=你的 MiMo 密钥
AI_MODEL=mimo-v2.5-pro
AI_MAX_OUTPUT_TOKENS=1600
```

项目配置已写入 `edgeone.json`。从 GitHub 导入仓库后，EdgeOne 会使用：

```text
installCommand: npm ci
buildCommand: npm run check
outputDirectory: ./public
```

## 文件

- `server.js`：本地网页服务、AI 提供商预设、转换接口
- `worker.js`：Cloudflare Worker 线上服务和 AI 代理
- `wrangler.toml`：Cloudflare Worker 发布配置
- `edgeone.json`：腾讯 EdgeOne Pages 发布配置
- `edge-functions/api/config.js`：EdgeOne 配置接口
- `edge-functions/api/translate.js`：EdgeOne 文言文转换接口
- `public/index.html`：页面结构
- `public/styles.css`：界面视觉
- `public/app.js`：交互逻辑
- `public/assets/ink-paper-bg.png`：背景素材
