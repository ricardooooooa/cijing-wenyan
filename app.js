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
let selectedStyle = "elegant";

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
  modeLabel.textContent = "请求中";
  latencyLabel.textContent = "等待";

  const startedAt = performance.now();

  try {
    const response = await fetch("/api/translate", {
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
    resultText.classList.add("placeholder");
    resultText.textContent = error.message || "转换失败，请稍后再试。";
    modeLabel.textContent = "错误";
    latencyLabel.textContent = formatSeconds(performance.now() - startedAt);
    setStatus("服务异常");
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
    const response = await fetch("/api/config");
    const config = await response.json();

    if (!response.ok) {
      return;
    }

    statusPill.textContent = config.online
      ? `${config.providerLabel} 已接入`
      : "离线预览";
    modeLabel.textContent = config.online ? config.providerLabel : "预览";
    latencyLabel.textContent = config.online ? config.model : "本地";
  } catch {
    statusPill.textContent = "本地就绪";
  }
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
