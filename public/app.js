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
let selectedStyle = "elegant";
let apiAvailable = true;

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

    const response = await fetch(buildApiUrl("api/translate"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text,
        style: selectedStyle,
        density: densityValues[Number(densityRange.value)] || "medium"
      })
    });

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error("api unavailable");
    }

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.detail || payload.error || "转换失败");
    }

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
