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

const literarySystemPrompt = `你是一位中学语文文言文教师,把现代汉语准确译为规范文言文,
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

function buildLiteraryUserPrompt({ style, density, text }) {
  return [
    `style: ${style}`,
    `density: ${density}`,
    "请按上述标准,将下列现代汉语译为规范文言文。只输出译文:",
    text
  ].join("\n");
}

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
        content: literarySystemPrompt
      },
      {
        role: "user",
        content: buildLiteraryUserPrompt({ style, density, text })
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
    temperature: Number(env.AI_TEMPERATURE || 0.25),
    topP: Number(env.AI_TOP_P || 0.85),
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
  const compact = text.replace(/\s+/g, "");
  const themed = themedOfflineRewrite(compact);
  if (themed) {
    return applyOfflineStyle(themed, style);
  }

  const replacements = [
    ["今天我们开始做", "今启"],
    ["可以把现代汉语转换成文言文", "使今言化为古文"],
    ["现代汉语", "今言"],
    ["文言文", "古文"],
    ["转换成", "化为"],
    ["转换", "化"],
    ["用户使用反馈", "用户有言"],
    ["一点都不雅", "殊乏雅致"],
    ["全是直译", "多循字面"],
    ["没有意境", "少烟霞之致"],
    ["超级文学家", "文章大家"],
    ["界面简洁", "界面清简"],
    ["简洁", "清简"],
    ["精致", "精雅"],
    ["顺手", "从容便捷"],
    ["并且", "且"],
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
    .replace(/；+/g, "；")
    .replace(/。+/g, "。")
    .replace(/\s+/g, "")
    .trim();

  output = output
    .split(/[。；;]/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .map(polishOfflineSentence)
    .join("；");

  return applyOfflineStyle(output, style);
}

function themedOfflineRewrite(compact) {
  if (/(一点都不雅|不雅|全是直译|没有意境|少意境|超级文学家|文学家)/.test(compact)) {
    return "其辞未臻雅驯，徒循字面而少烟霞之致；当更张笔法，取意炼神，使一语落纸，便有大家风骨。";
  }

  if (/现代汉语.*文言文/.test(compact) && /(网页|小程序|页面)/.test(compact)) {
    return "今开辞镜之牖，纳今言而生古意；屏间惟取清润，指下自得从容。";
  }

  if (/(界面|页面).*(高级|苹果|简洁|精致)/.test(compact)) {
    return "其界面当清如素笺，润若玉色；举手之间，繁者自隐，雅意自生。";
  }

  return "";
}

function polishOfflineSentence(sentence) {
  return sentence
    .replace(/今日吾等始/g, "今启")
    .replace(/吾等始/g, "吾辈始")
    .replace(/之网页/g, "之页")
    .replace(/愿界面/g, "愿其界面")
    .replace(/希望/g, "愿")
    .replace(/使用起来/g, "用之")
    .replace(/很/g, "颇")
    .replace(/可化今言为古文/g, "使今言化为古文")
    .replace(/界面清简、精雅/g, "界面清润精雅");
}

function applyOfflineStyle(output, style) {
  const normalized = normalizeOfflinePunctuation(output);

  if (style === "memorial") {
    return `臣谨言：${normalized}`;
  }

  if (style === "concise") {
    return normalized.replace(/；/g, "。");
  }

  return normalized;
}

function normalizeOfflinePunctuation(output) {
  const normalized = String(output || "")
    .replace(/\s+/g, "")
    .replace(/，+/g, "，")
    .replace(/；+/g, "；")
    .replace(/。+/g, "。")
    .replace(/；。/g, "。")
    .trim();

  if (!normalized) {
    return "辞意未明，姑俟再书。";
  }

  return /[。？！]$/.test(normalized) ? normalized : `${normalized}。`;
}
