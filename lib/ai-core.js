const maxBodyBytes = 64 * 1024;

const providerPresets = {
  deepseek: {
    label: "DeepSeek",
    envKey: "DEEPSEEK_API_KEY",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-v4-pro",
    auth: "bearer",
    maxTokenField: "max_tokens",
    extraBody: {
      thinking: { type: "disabled" }
    }
  },
  mimo: {
    label: "Xiaomi MiMo",
    envKey: "MIMO_API_KEY",
    baseUrl: "https://api.xiaomimimo.com/v1",
    model: "mimo-v2.5-pro",
    auth: "api-key",
    maxTokenField: "max_completion_tokens",
    extraBody: {
      thinking: { type: "disabled" }
    }
  },
  dashscope: {
    label: "Qwen DashScope",
    envKey: "DASHSCOPE_API_KEY",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-plus-latest",
    auth: "bearer",
    maxTokenField: "max_tokens"
  },
  openrouter: {
    label: "OpenRouter",
    envKey: "OPENROUTER_API_KEY",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "anthropic/claude-sonnet-4.5",
    auth: "bearer",
    maxTokenField: "max_tokens"
  },
  openai: {
    label: "OpenAI",
    envKey: "OPENAI_API_KEY",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    auth: "bearer",
    maxTokenField: "max_tokens"
  },
  custom: {
    label: "Custom LLM",
    envKey: "AI_API_KEY",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    auth: "bearer",
    maxTokenField: "max_tokens"
  }
};

const styleLabels = {
  elegant: "elegant 大家: 雅正通畅的标准文言,默认。",
  concise: "concise 简古: 句更短、字更炼,近先秦质朴。",
  memorial: "memorial 奏疏: 庄重的奏议公文口吻。",
  lyrical: "lyrical 清雅: 略带文气,但仍以准确为先,不可因美失真。"
};

const densityLabels = {
  light: "light 浅润: 浅近文言,便于理解。",
  medium: "medium 成章: 标准文言。",
  deep: "deep 入境: 更纯熟老练的文言,但绝不堆砌或偏意。"
};

const translatorSystemPrompt = `你是一位中学语文文言文教师,把现代汉语准确译为规范文言文,
须达到教材与考试可接受的标准:准确、规范、雅正,而非辞藻堆砌。

标准(优先级从高到低):
1. 信(准确):原文每层意思都译出,不增、不减、不曲解。宁朴实,不失真。
2. 达(规范):
   - 虚词(之/乎/者/也/矣/焉/以/而等)用得其所,不滥用、不缺位。
   - 不得残留白话:的、了、着、吗、呢、把、被(助词)、很、非常、一下等,一律转为文言。
   - 不生造词。现代专名(网页、手机等)无确切古译时保留原词,不硬凑致误。
   - 句式合文言习惯:判断、被动、省略、倒装自然得体。
3. 雅(雅正):风格如《古文观止》《教材选文》般清通简洁,不堆砌、不滥情。

铁律(违反即判不及格):
- 绝不编造典故、诗句、出处、人名地名;无典可用就平实直译。
- 绝不增添原文没有的情节、情感或评价。

风格档(style):
- elegant 大家:雅正通畅的标准文言,默认。
- concise 简古:句更短、字更炼,近先秦质朴。
- memorial 奏疏:庄重的奏议公文口吻。
- lyrical 清雅:略带文气,但仍以准确为先,不可因美失真。

程度档(density,只调文言化程度,不调准确度):
- light 浅润:浅近文言,便于理解。
- medium 成章:标准文言。
- deep 入境:更纯熟老练的文言,但绝不堆砌或偏意。

输出:只输出译文本身,不加解释、引号或前后语;原文多句则保持对应句读。

示例:
输入:因为他学习很努力,所以考试取得了好成绩。
输出:彼学甚勤,故试得佳绩。
输入:我喜欢你。
输出:吾心悦汝。
输入:今天天气很好,我们一起去公园散步吧。
输出:今日天朗,可偕游于园。`;

function publicConfig(env = process.env) {
  const config = resolveAiConfig(env);
  return {
    provider: config.provider,
    providerLabel: config.label,
    model: config.model,
    online: Boolean(config.apiKey)
  };
}

async function translateText({ text, style = "elegant", density = "medium", env = process.env }) {
  const normalizedText = String(text || "").trim();

  if (!normalizedText) {
    return {
      status: 400,
      payload: { error: "请输入需要转换的文字" }
    };
  }

  if (normalizedText.length > 2000) {
    return {
      status: 400,
      payload: { error: "单次输入请控制在 2000 字以内" }
    };
  }

  const config = resolveAiConfig(env);

  if (!config.apiKey) {
    return {
      status: 200,
      payload: {
        result: offlineRewrite(normalizedText, style),
        mode: "offline",
        provider: "offline",
        model: "local-preview",
        note: "未检测到 AI 密钥，当前为离线预览结果。"
      }
    };
  }

  const startedAt = Date.now();
  const result = await callAi({
    config,
    text: normalizedText,
    style: styleLabels[style] || styleLabels.elegant,
    density: densityLabels[density] || densityLabels.medium
  });

  return {
    status: 200,
    payload: {
      result,
      mode: "ai",
      provider: config.provider,
      providerLabel: config.label,
      model: config.model,
      latencyMs: Date.now() - startedAt
    }
  };
}

async function handleConfigRequest(request, response, env = process.env) {
  if (handleCorsPreflight(request, response, env)) {
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    sendJson(response, 405, { error: "Method not allowed" }, request, env);
    return;
  }

  sendJson(response, 200, publicConfig(env), request, env);
}

async function handleTranslateRequest(request, response, env = process.env) {
  if (handleCorsPreflight(request, response, env)) {
    return;
  }

  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed" }, request, env);
    return;
  }

  try {
    const body = await readJsonBody(request);
    const translated = await translateText({
      text: body.text,
      style: String(body.style || "elegant"),
      density: String(body.density || "medium"),
      env
    });

    sendJson(response, translated.status, translated.payload, request, env);
  } catch (error) {
    const status = error.statusCode || 502;
    sendJson(
      response,
      status,
      {
        error: status === 502 ? "AI 服务暂不可用" : "请求处理失败",
        detail: error.message
      },
      request,
      env
    );
  }
}

async function callAi({ config, text, style, density }) {
  if (typeof fetch !== "function") {
    throw new Error("当前 Node.js 版本不支持 fetch，请使用 Node.js 18 或更高版本。");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  const body = {
    model: config.model,
    temperature: config.temperature,
    top_p: config.topP,
    stream: false,
    messages: [
      {
        role: "system",
        content: translatorSystemPrompt
      },
      {
        role: "user",
        content: buildUserPrompt({ style, density, text })
      }
    ],
    ...config.extraBody
  };

  if (config.maxOutputTokens > 0) {
    body[config.maxTokenField] = config.maxOutputTokens;
  }

  try {
    const aiResponse = await fetch(buildChatCompletionsUrl(config.baseUrl), {
      method: "POST",
      signal: controller.signal,
      headers: buildAuthHeaders(config),
      body: JSON.stringify(body)
    });

    const payload = await aiResponse.json().catch(() => ({}));

    if (!aiResponse.ok) {
      const message = payload.error?.message || payload.message || `HTTP ${aiResponse.status}`;
      const error = new Error(message);
      error.statusCode = 502;
      throw error;
    }

    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("AI 响应中没有可用文本。");
    }

    return content.trim();
  } finally {
    clearTimeout(timeout);
  }
}

function buildUserPrompt({ style, density, text }) {
  return [
    `style: ${style}`,
    `density: ${density}`,
    "请按上述标准,将下列现代汉语译为规范文言文。只输出译文:",
    text
  ].join("\n");
}

function resolveAiConfig(env = process.env) {
  const provider = normalizeProvider(env.AI_PROVIDER || detectProvider(env));
  const preset = providerPresets[provider] || providerPresets.deepseek;
  const apiKey = env.AI_API_KEY || env[preset.envKey] || "";

  return {
    provider,
    label: env.AI_PROVIDER_LABEL || preset.label,
    apiKey,
    baseUrl: env.AI_BASE_URL || preset.baseUrl,
    model: env.AI_MODEL || preset.model,
    auth: env.AI_AUTH_HEADER || preset.auth,
    maxTokenField: env.AI_MAX_TOKEN_FIELD || preset.maxTokenField,
    maxOutputTokens: Number(env.AI_MAX_OUTPUT_TOKENS || 1600),
    temperature: Number(env.AI_TEMPERATURE || 0.25),
    topP: Number(env.AI_TOP_P || 0.85),
    timeoutMs: Number(env.AI_TIMEOUT_MS || 45000),
    extraBody: preset.extraBody || {}
  };
}

function detectProvider(env = process.env) {
  if (env.DEEPSEEK_API_KEY) return "deepseek";
  if (env.MIMO_API_KEY) return "mimo";
  if (env.DASHSCOPE_API_KEY) return "dashscope";
  if (env.OPENROUTER_API_KEY) return "openrouter";
  if (env.OPENAI_API_KEY) return "openai";
  return "deepseek";
}

function normalizeProvider(provider) {
  const value = String(provider || "deepseek").trim().toLowerCase();
  return providerPresets[value] ? value : "custom";
}

function buildChatCompletionsUrl(baseUrl) {
  const normalized = String(baseUrl || "").replace(/\/$/, "");
  if (normalized.endsWith("/chat/completions")) {
    return normalized;
  }
  return `${normalized}/chat/completions`;
}

function buildAuthHeaders(config) {
  const headers = {
    "Content-Type": "application/json"
  };

  if (config.auth === "api-key") {
    headers["api-key"] = config.apiKey;
    return headers;
  }

  headers.Authorization = `Bearer ${config.apiKey}`;

  if (config.provider === "openrouter") {
    headers["HTTP-Referer"] = "https://ricardooooooa.github.io/cijing-wenyan/";
    headers["X-Title"] = "Cijing Wenyan";
  }

  return headers;
}

function handleCorsPreflight(request, response, env) {
  if (request.method !== "OPTIONS") {
    return false;
  }

  response.writeHead(204, corsHeaders(request, env));
  response.end();
  return true;
}

function sendJson(response, statusCode, payload, request, env) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...corsHeaders(request, env)
  });
  response.end(JSON.stringify(payload));
}

function corsHeaders(request, env = process.env) {
  const origin = request.headers?.origin || request.headers?.Origin || "";
  const allowed = String(env.CORS_ORIGIN || env.ALLOWED_ORIGIN || "*")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const allowOrigin =
    allowed.includes("*") || !origin
      ? "*"
      : allowed.includes(origin)
        ? origin
        : allowed[0] || "*";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

function readJsonBody(request) {
  if (typeof request.body === "string") {
    try {
      return Promise.resolve(request.body ? JSON.parse(request.body) : {});
    } catch {
      const error = new Error("请求 JSON 格式无效");
      error.statusCode = 400;
      return Promise.reject(error);
    }
  }

  if (Buffer.isBuffer(request.body)) {
    try {
      return Promise.resolve(request.body.length ? JSON.parse(request.body.toString("utf8")) : {});
    } catch {
      const error = new Error("请求 JSON 格式无效");
      error.statusCode = 400;
      return Promise.reject(error);
    }
  }

  if (request.body && typeof request.body === "object" && !Buffer.isBuffer(request.body)) {
    return Promise.resolve(request.body);
  }

  return new Promise((resolve, reject) => {
    let raw = "";
    request.on("data", (chunk) => {
      raw += chunk;
      if (Buffer.byteLength(raw) > maxBodyBytes) {
        const error = new Error("请求内容过大");
        error.statusCode = 413;
        reject(error);
        request.destroy();
      }
    });

    request.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        const error = new Error("请求 JSON 格式无效");
        error.statusCode = 400;
        reject(error);
      }
    });

    request.on("error", reject);
  });
}

function offlineRewrite(text, style) {
  const replacements = [
    ["因为", "因"],
    ["所以", "故"],
    ["但是", "然"],
    ["如果", "若"],
    ["已经", "既"],
    ["正在", "方"],
    ["需要", "须"],
    ["希望", "愿"],
    ["可以", "可"],
    ["不能", "不可"],
    ["没有", "无"],
    ["今天", "今日"],
    ["明天", "明日"],
    ["昨天", "昨日"],
    ["我们", "吾辈"],
    ["你们", "尔等"],
    ["他们", "彼等"],
    ["我", "吾"],
    ["你", "汝"],
    ["他", "彼"],
    ["她", "彼"],
    ["的", "之"],
    ["了", "矣"],
    ["很", "甚"],
    ["非常", "甚"],
    ["喜欢", "心悦"],
    ["努力", "勤"],
    ["学习", "学"],
    ["成绩", "绩"]
  ];

  let output = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/[?？]/g, "乎？")
    .replace(/[!！]/g, "矣。")
    .replace(/[,，]/g, "，")
    .replace(/[.。]+/g, "。");

  for (const [from, to] of replacements) {
    output = output.split(from).join(to);
  }

  output = output
    .replace(/，+/g, "，")
    .replace(/。+/g, "。")
    .replace(/\s+/g, "")
    .trim();

  if (!/[。？！]$/.test(output)) {
    output += "。";
  }

  if (style === "memorial") {
    return `臣谨言：${output}`;
  }

  return output;
}

module.exports = {
  handleConfigRequest,
  handleTranslateRequest,
  publicConfig,
  resolveAiConfig,
  translateText,
  translatorSystemPrompt
};
