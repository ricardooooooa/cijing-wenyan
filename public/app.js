const form = document.querySelector("#translateForm");
const sourceText = document.querySelector("#sourceText");
const resultText = document.querySelector("#resultText");
const submitButton = document.querySelector("#submitButton");
const submitLabel = document.querySelector("#submitLabel");
const copyButton = document.querySelector("#copyButton");
const clearButton = document.querySelector("#clearButton");
const counter = document.querySelector("#counter");
const statusPill = document.querySelector("#statusPill");
const modeLabel = document.querySelector("#modeLabel");
const latencyLabel = document.querySelector("#latencyLabel");
const densityRange = document.querySelector("#densityRange");
const densityLabel = document.querySelector("#densityLabel");
const segments = Array.from(document.querySelectorAll(".segment"));

const densityValues = ["light", "medium", "deep"];
const densityNames = ["浅润", "成章", "入境"];
const apiBase = window.CIJING_API_BASE || "";
const directDeepSeek = Boolean(window.CIJING_DIRECT_DEEPSEEK);
const directDeepSeekModel = window.CIJING_DIRECT_DEEPSEEK_MODEL || "deepseek-v4-pro";
const directDeepSeekEndpoint = window.CIJING_DEEPSEEK_ENDPOINT || "https://api.deepseek.com/chat/completions";
const directDeepSeekKeyName = "cijing.deepseek.apiKey";
let selectedStyle = "elegant";
let apiAvailable = true;

const stylePromptLabels = {
  elegant: "elegant 大家: 雅正通畅的标准文言,默认。",
  concise: "concise 简古: 句更短、字更炼,近先秦质朴。",
  memorial: "memorial 奏疏: 庄重的奏议公文口吻。",
  lyrical: "lyrical 清雅: 略带文气,但仍以准确为先,不可因美失真。"
};

const densityPromptLabels = {
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

updateCounter();
loadRuntimeConfig();

segments.forEach((button) => {
  button.addEventListener("click", () => {
    selectedStyle = button.dataset.style;

    segments.forEach((segment) => {
      const active = segment === button;
      segment.classList.toggle("active", active);
      segment.setAttribute("aria-pressed", String(active));
    });
  });
});

densityRange.addEventListener("input", () => {
  densityLabel.textContent = densityNames[Number(densityRange.value)] || "成章";
});

sourceText.addEventListener("input", updateCounter);

sourceText.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    form.requestSubmit();
  }
});

clearButton.addEventListener("click", () => {
  sourceText.value = "";
  sourceText.focus();
  updateCounter();
});

copyButton.addEventListener("click", async () => {
  const value = resultText.textContent.trim();
  if (!value || resultText.classList.contains("placeholder")) {
    return;
  }

  try {
    await copyText(value);
    flashCopyLabel("已复制");
  } catch {
    flashCopyLabel("复制失败");
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const text = sourceText.value.trim();
  if (!text) {
    setStatus("请输入文字");
    sourceText.focus();
    return;
  }

  setLoading(true);
  resultText.classList.remove("placeholder");
  resultText.textContent = "化辞中...";
  modeLabel.textContent = apiAvailable ? "请求中" : "离线预览";
  latencyLabel.textContent = "等待";

  const startedAt = performance.now();

  try {
    if (!apiAvailable) {
      throw new Error("api unavailable");
    }

    const density = densityValues[Number(densityRange.value)] || "medium";
    const payload = directDeepSeek
      ? await translateWithDirectDeepSeek({
        text,
        style: selectedStyle,
        density
      })
      : await translateWithBackend({
        text,
        style: selectedStyle,
        density
      });

    resultText.textContent = payload.result || "";
    modeLabel.textContent = payload.mode === "ai" ? payload.providerLabel || "AI" : "离线预览";
    latencyLabel.textContent =
      payload.mode === "ai"
        ? `${payload.model || ""} · ${formatSeconds(payload.latencyMs || performance.now() - startedAt)}`
        : "本地";
    setStatus(payload.mode === "ai" ? "转换完成" : "离线预览");
  } catch (error) {
    const offlineResult = offlineRewrite(text, selectedStyle);
    resultText.classList.remove("placeholder");
    resultText.textContent = offlineResult;
    modeLabel.textContent = "离线预览";
    latencyLabel.textContent = "本地";
    setStatus("静态预览");
  } finally {
    setLoading(false);
  }
});

function updateCounter() {
  counter.textContent = `${sourceText.value.length} / 2000`;
}

function setStatus(value) {
  statusPill.textContent = value;
}

function setLoading(loading) {
  document.body.classList.toggle("is-loading", loading);
  submitButton.disabled = loading;
  submitLabel.textContent = loading ? "化辞中" : "化为文言";
}

async function loadRuntimeConfig() {
  if (directDeepSeek) {
    apiAvailable = true;
    statusPill.textContent = "DeepSeek 直连";
    modeLabel.textContent = "DeepSeek";
    latencyLabel.textContent = directDeepSeekModel;
    return;
  }

  try {
    const response = await fetch(buildApiUrl("api/config"));
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || !contentType.includes("application/json")) {
      throw new Error("api unavailable");
    }

    const config = await response.json();
    apiAvailable = Boolean(config.online);
    statusPill.textContent = config.online
      ? `${config.providerLabel} 已接入`
      : "离线预览";
    modeLabel.textContent = config.online ? config.providerLabel : "预览";
    latencyLabel.textContent = config.online ? config.model : "本地";
  } catch {
    apiAvailable = false;
    statusPill.textContent = "静态预览";
    modeLabel.textContent = "预览";
    latencyLabel.textContent = "本地";
  }
}

async function translateWithBackend({ text, style, density }) {
  const response = await fetch(buildApiUrl("api/translate"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ text, style, density })
  });

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error("api unavailable");
  }

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.detail || payload.error || "转换失败");
  }

  return payload;
}

async function translateWithDirectDeepSeek({ text, style, density }) {
  const apiKey = getDirectDeepSeekKey();
  const startedAt = performance.now();
  const response = await fetch(directDeepSeekEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: directDeepSeekModel,
      temperature: 0.25,
      top_p: 0.85,
      max_tokens: 1600,
      stream: false,
      messages: [
        {
          role: "system",
          content: translatorSystemPrompt
        },
        {
          role: "user",
          content: buildDirectDeepSeekPrompt({ style, density, text })
        }
      ]
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem(directDeepSeekKeyName);
    }

    throw new Error(payload.error?.message || payload.message || "DeepSeek 调用失败");
  }

  const result = payload.choices?.[0]?.message?.content?.trim();
  if (!result) {
    throw new Error("DeepSeek 没有返回可用文本");
  }

  return {
    result,
    mode: "ai",
    provider: "deepseek",
    providerLabel: "DeepSeek",
    model: directDeepSeekModel,
    latencyMs: performance.now() - startedAt
  };
}

function getDirectDeepSeekKey() {
  const saved = localStorage.getItem(directDeepSeekKeyName);
  if (saved) {
    return saved;
  }

  const value = window.prompt("请输入 DeepSeek API Key。Key 只保存在本机浏览器，不会写入网页代码。");
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    throw new Error("missing deepseek key");
  }

  localStorage.setItem(directDeepSeekKeyName, trimmed);
  return trimmed;
}

function buildDirectDeepSeekPrompt({ style, density, text }) {
  return [
    `style: ${stylePromptLabels[style] || stylePromptLabels.elegant}`,
    `density: ${densityPromptLabels[density] || densityPromptLabels.medium}`,
    "请按上述标准,将下列现代汉语译为规范文言文。只输出译文:",
    text
  ].join("\n");
}

function buildApiUrl(path) {
  const normalizedBase = apiBase.replace(/\/$/, "");
  return normalizedBase ? `${normalizedBase}/${path}` : path;
}

async function copyText(value) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();

  if (!copied) {
    throw new Error("copy failed");
  }
}

function flashCopyLabel(label) {
  copyButton.textContent = label;
  setTimeout(() => {
    copyButton.textContent = "复制";
  }, 1400);
}

function formatSeconds(ms) {
  return `${Math.max(0.1, Math.round(ms / 100) / 10)} 秒`;
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
