const providerPresets = {
  deepseek: {
    label: "DeepSeek",
    envKey: "DEEPSEEK_API_KEY",
    model: "deepseek-v4-pro"
  },
  mimo: {
    label: "Xiaomi MiMo",
    envKey: "MIMO_API_KEY",
    model: "mimo-v2.5-pro"
  },
  custom: {
    label: "Custom LLM",
    envKey: "AI_API_KEY",
    model: "gpt-4o-mini"
  }
};

export function onRequestGet(context) {
  const env = context.env || {};
  const provider = normalizeProvider(env.AI_PROVIDER || detectProvider(env));
  const preset = providerPresets[provider] || providerPresets.custom;
  const apiKey = env.AI_API_KEY || env[preset.envKey] || "";

  return json({
    provider,
    providerLabel: env.AI_PROVIDER_LABEL || preset.label,
    model: env.AI_MODEL || preset.model,
    online: Boolean(apiKey)
  });
}

function detectProvider(env) {
  if (env.DEEPSEEK_API_KEY) return "deepseek";
  if (env.MIMO_API_KEY) return "mimo";
  return "deepseek";
}

function normalizeProvider(provider) {
  const value = String(provider || "deepseek").trim().toLowerCase();
  return providerPresets[value] ? value : "custom";
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
