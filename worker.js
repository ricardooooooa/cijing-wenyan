const maxBodyBytes = 64 * 1024;

const providerPresets = {
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
  deepseek: {
    label: "DeepSeek",
    envKey: "DEEPSEEK_API_KEY",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-v4-pro",
    auth: "bearer",
    maxTokenField: "max_tokens"
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
  elegant: "典雅凝练",
  concise: "简古有力",
  memorial: "奏疏体",
  lyrical: "清雅含蓄"
};

const densityLabels = {
  light: "稍作文言化，保留原意与清晰度",
  medium: "文言气息明显，句式自然",
  deep: "更近古文，辞气凝练，但不堆砌生僻字"
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/config") {
      return sendJson(publicConfig(env));
    }

    if (url.pathname === "/api/translate") {
      return handleTranslate(request, env);
    }

    return env.ASSETS.fetch(request);
  }
};

async function handleTranslate(request, env) {
  if (request.method !== "POST") {
    return sendJson({ error: "Method not allowed" }, 405);
  }

  let body;

  try {
    body = await readJsonBody(request);
  } catch (error) {
    return sendJson({ error: error.message }, 400);
  }

  const text = String(body.text || "").trim();
  const style = String(body.style || "elegant");
  const density = String(body.density || "medium");

  if (!text) {
    return sendJson({ error: "请输入需要转换的文字" }, 400);
  }

  if (text.length > 2000) {
    return sendJson({ error: "单次输入请控制在 2000 字以内" }, 400);
  }

  const config = resolveAiConfig(env);

  if (!config.apiKey) {
    return sendJson({
      result: offlineRewrite(text, style),
      mode: "offline",
      provider: "offline",
      model: "local-preview",
      note: "未检测到 AI 密钥，当前为离线预览结果。"
    });
  }

  const startedAt = Date.now();

  try {
    const result = await callAi({
      config,
      text,
      style: styleLabels[style] || styleLabels.elegant,
      density: densityLabels[density] || densityLabels.medium
    });

    return sendJson({
      result,
      mode: "ai",
      provider: config.provider,
      providerLabel: config.label,
      model: config.model,
      latencyMs: Date.now() - startedAt
    });
  } catch (error) {
    return sendJson(
      {
        error: "AI 服务暂不可用",
        detail: error.message
      },
      502
    );
  }
}

async function callAi({ config, text, style, density }) {
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
        content:
          "你是一名严谨的文言文改写师。只输出改写后的文言文，不加标题、解释、引号或项目符号。保留原意、人名、地名、数字、专有名词和必要现代术语；AI、API、LLM、大模型、网页、小程序等技术词可保留原词，不强行古化或缩略；不得编造事实；句式自然，避免生硬堆砌冷僻字。"
      },
      {
        role: "user",
        content:
          `风格：${style}\n` +
          `程度：${density}\n` +
          "请将下列现代汉语改写为对应文言文：\n" +
          text
      }
    ],
    ...config.extraBody
  };

  if (config.maxOutputTokens > 0) {
    body[config.maxTokenField] = config.maxOutputTokens;
  }

  try {
    const response = await fetch(buildChatCompletionsUrl(config.baseUrl), {
      method: "POST",
      signal: controller.signal,
      headers: buildAuthHeaders(config),
      body: JSON.stringify(body)
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = payload.error?.message || payload.message || `HTTP ${response.status}`;
      throw new Error(message);
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

function resolveAiConfig(env) {
  const provider = normalizeProvider(env.AI_PROVIDER || detectProvider(env));
  const preset = providerPresets[provider] || providerPresets.custom;
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
    temperature: Number(env.AI_TEMPERATURE || 0.45),
    topP: Number(env.AI_TOP_P || 0.95),
    timeoutMs: Number(env.AI_TIMEOUT_MS || 45000),
    extraBody: preset.extraBody || {}
  };
}

function publicConfig(env) {
  const config = resolveAiConfig(env);
  return {
    provider: config.provider,
    providerLabel: config.label,
    model: config.model,
    online: Boolean(config.apiKey)
  };
}

function detectProvider(env) {
  if (env.MIMO_API_KEY) return "mimo";
  if (env.DEEPSEEK_API_KEY) return "deepseek";
  if (env.DASHSCOPE_API_KEY) return "dashscope";
  if (env.OPENROUTER_API_KEY) return "openrouter";
  if (env.OPENAI_API_KEY) return "openai";
  return "mimo";
}

function normalizeProvider(provider) {
  const value = String(provider || "mimo").trim().toLowerCase();
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
    headers["HTTP-Referer"] = "https://cijing.example";
    headers["X-Title"] = "Cijing Wenyan";
  }

  return headers;
}

async function readJsonBody(request) {
  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBodyBytes) {
    throw new Error("请求内容过大");
  }

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error("请求 JSON 格式无效");
  }
}

function sendJson(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function offlineRewrite(text, style) {
  const replacements = [
    ["我们", "吾等"],
    ["你们", "尔等"],
    ["他们", "彼辈"],
    ["因为", "盖因"],
    ["所以", "故"],
    ["但是", "然"],
    ["如果", "若"],
    ["已经", "已"],
    ["正在", "方"],
    ["需要", "须"],
    ["希望", "愿"],
    ["可以", "可"],
    ["不能", "不可"],
    ["没有", "未有"],
    ["今天", "今日"],
    ["明天", "翌日"],
    ["昨天", "昨者"],
    ["这里", "此地"],
    ["那里", "彼处"],
    ["事情", "事"],
    ["问题", "患"],
    ["方法", "法"],
    ["重要", "要"],
    ["完成", "竟"],
    ["开始", "始"],
    ["喜欢", "喜"],
    ["知道", "知"],
    ["认为", "以为"],
    ["告诉", "告"],
    ["帮助", "助"],
    ["查看", "察"],
    ["输入", "录入"],
    ["文字", "文辞"],
    ["我", "吾"],
    ["你", "子"],
    ["他", "彼"],
    ["她", "彼"],
    ["的", "之"],
    ["了", "矣"]
  ];

  let output = text
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
    return `臣谨按：${output}`;
  }

  if (style === "lyrical") {
    return `余观其意，${output}`;
  }

  return output;
}
