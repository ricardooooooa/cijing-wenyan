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
const densityNames = ["轻", "适中", "深"];
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
  densityLabel.textContent = densityNames[Number(densityRange.value)] || "适中";
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
