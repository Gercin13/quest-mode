// Netlify Function: OpenAI streaming proxy for Quest Mode
// Handles 4 master prompts (Point A, Point B, Analysis, Avatar)
// User message + conversation history → OpenAI → streaming response
//
// Get API key: https://platform.openai.com/api-keys

import { PROMPTS } from "./prompts.mjs";

// ===== Provider Configuration =====
const API_URL = "https://api.openai.com/v1/chat/completions";
const ENV_KEY_NAME = "OPENAI_API_KEY";

// Models per step:
//  - "gpt-4o-mini" for interview steps (fast, cheap, follows instructions well)
//  - "gpt-4o" for analysis (better reasoning capability)
const MODELS = {
  chat: "gpt-4o-mini",  // Steps 1, 2, 4 — interview-style
  analysis: "gpt-4o"    // Step 3 — needs reasoning
};

export default async (req, context) => {
  // CORS for browser
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const apiKey = Netlify.env.get(ENV_KEY_NAME);
  if (!apiKey) {
    return new Response(JSON.stringify({
      error: `${ENV_KEY_NAME} not configured. Add it in Netlify Site → Environment Variables.`
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { step, messages, lang = "uk" } = body;

  // "hint" and "quickplan" are special lightweight steps
  const validSteps = [...Object.keys(PROMPTS), "hint", "quickplan"];
  if (!step || !validSteps.includes(step)) {
    return new Response(JSON.stringify({
      error: "Invalid step. Must be one of: " + validSteps.join(", ")
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!Array.isArray(messages)) {
    return new Response(JSON.stringify({ error: "messages must be an array" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Limit conversation history to last 50 messages to control cost
  const trimmedHistory = messages.slice(-50);

  let systemPrompt;
  let model;

  if (step === "hint") {
    // Lightweight prompt for form-field suggestions
    systemPrompt = `Ти — короткий помічник для заповнення анкети про сфери життя.
Правила:
- Якщо текст порожній — задай 1-2 наводящих питання щоб допомогти почати (конкретних, не загальних).
- Якщо є текст — запропонуй доповнення: конкретні цифри, факти, частоти які можна додати.
- Максимум 2-3 речення. Будь практичним, не мотиваційним.
- Відповідай тією ж мовою що і користувач.
- НЕ повторюй те що вже написано.`;
    model = "gpt-4o-mini";
  } else if (step === "quickplan") {
    // Quick plan generation from goals only (solo path)
    systemPrompt = `Ти — планувальник для людини з ADHD. Тобі дають цілі на 90 днів.
Твоя задача: створити простий щоденний розклад з 5-7 конкретних дій.

Формат відповіді — JSON масив:
[
  {"name": "Назва дії", "time": "08:00", "freq": "daily", "xp": 10, "emoji": "🌅"},
  ...
]

Правила:
- Кожна дія має бути маленькою і конкретною (15-30 хв максимум)
- XP: легка дія = 10, середня = 25, складна = 50
- freq: "daily", "weekdays", "3x_week"
- Часи мають бути реалістичними
- Включи 1-2 дії на відновлення (прогулянка, дихання)
- Відповідай ТІЛЬКИ JSON масивом, без тексту до/після
- ${lang === "en" ? "Names in English" : "Назви українською"}`;
    model = "gpt-4o-mini";
  } else {
    systemPrompt = PROMPTS[step] + "\n\n" +
      (lang === "en"
        ? "IMPORTANT: Respond in English regardless of the master prompt language."
        : "ВАЖЛИВО: Відповідай українською мовою.");
    model = step === "step3" ? MODELS.analysis : MODELS.chat;
  }

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          ...trimmedHistory,
        ],
        stream: true,
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      let userMsg = `OpenAI error: ${response.status}`;
      // Friendly error mapping
      if (response.status === 401) {
        userMsg = "Invalid API key. Check OPENAI_API_KEY in Netlify env vars.";
      } else if (response.status === 402 || response.status === 429) {
        userMsg = "OpenAI rate limit or insufficient credits. Add funds at https://platform.openai.com/account/billing or wait a moment.";
      }
      return new Response(JSON.stringify({
        error: userMsg,
        detail: errText.slice(0, 500),
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stream the response back to the client (SSE format)
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({
      error: "Server error",
      detail: err.message,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

export const config = {
  path: "/api/chat",
};
