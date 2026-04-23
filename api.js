// API abstraction for multiple LLM providers.
// Each provider normalizes to the same interface:
//   call(systemPrompt, userMessage, temperature, useSearch) → parsed JSON

export const PROVIDERS = {
  anthropic: {
    name: "Anthropic",
    models: [
      { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
      { id: "claude-opus-4-20250514", label: "Claude Opus 4" },
    ],
    supportsSearch: true,
  },
  openai: {
    name: "OpenAI",
    models: [
      { id: "gpt-4o", label: "GPT-4o" },
      { id: "gpt-4o-mini", label: "GPT-4o Mini" },
      { id: "o3-mini", label: "o3-mini" },
    ],
    supportsSearch: false,
  },
};

// Default config — used when no keys are provided (works inside Claude.ai)
export const DEFAULT_CONFIG = {
  researcher: { provider: "anthropic", model: "claude-sonnet-4-20250514" },
  adversary: { provider: "anthropic", model: "claude-sonnet-4-20250514" },
};

// ── Anthropic API ──

async function callAnthropic(apiKey, model, systemPrompt, userMessage, temperature, useSearch) {
  const headers = { "Content-Type": "application/json" };

  // When running inside Claude.ai, no API key is needed
  if (apiKey) {
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
  }

  const body = {
    model,
    max_tokens: 1000,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
    temperature,
  };

  if (useSearch) {
    body.tools = [{ type: "web_search_20250305", name: "web_search" }];
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const text = data.content
    ?.filter((block) => block.type === "text")
    .map((block) => block.text || "")
    .join("\n") || "";

  return parseJSON(text);
}

// ── OpenAI API ──

async function callOpenAI(apiKey, model, systemPrompt, userMessage, temperature) {
  if (!apiKey) throw new Error("OpenAI requires an API key");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || "";
  return parseJSON(text);
}

// ── Shared ──

function parseJSON(raw) {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}

// Unified call interface
export async function apiCall(config, systemPrompt, userMessage, temperature = 0.5, useSearch = false) {
  const { provider, model, apiKey } = config;

  switch (provider) {
    case "anthropic":
      return callAnthropic(apiKey, model, systemPrompt, userMessage, temperature, useSearch);
    case "openai":
      return callOpenAI(apiKey, model, systemPrompt, userMessage, temperature);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
