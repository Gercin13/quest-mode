// Netlify Function: OpenAI Whisper transcription proxy for Quest Mode
// Receives a recorded audio blob (multipart/form-data) and returns text.
// Whisper auto-detects the spoken language — no language hint needed,
// so transcription is accurate in any language the user speaks.
//
// Uses the same OPENAI_API_KEY as /api/chat.

const API_URL = "https://api.openai.com/v1/audio/transcriptions";
const ENV_KEY_NAME = "OPENAI_API_KEY";
const MODEL = "whisper-1"; // multilingual, auto language detection

export default async (req, context) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, corsHeaders);
  }

  const apiKey = Netlify.env.get(ENV_KEY_NAME);
  if (!apiKey) {
    return json({
      error: `${ENV_KEY_NAME} not configured. Add it in Netlify Site → Environment Variables.`
    }, 500, corsHeaders);
  }

  // Read the uploaded audio
  let inForm;
  try {
    inForm = await req.formData();
  } catch (e) {
    return json({ error: "Expected multipart/form-data with an audio file" }, 400, corsHeaders);
  }

  const file = inForm.get("file") || inForm.get("audio");
  if (!file || typeof file === "string") {
    return json({ error: "No audio file provided" }, 400, corsHeaders);
  }

  // Forward to OpenAI. No "language" param => Whisper auto-detects the language.
  const out = new FormData();
  out.append("file", file, file.name || "voice.webm");
  out.append("model", MODEL);
  out.append("response_format", "json");

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}` },
      body: out,
    });

    if (!response.ok) {
      const errText = await response.text();
      let userMsg = `OpenAI error: ${response.status}`;
      if (response.status === 401) {
        userMsg = "Invalid API key. Check OPENAI_API_KEY in Netlify env vars.";
      } else if (response.status === 402 || response.status === 429) {
        userMsg = "OpenAI rate limit or insufficient credits. Add funds at https://platform.openai.com/account/billing or wait a moment.";
      }
      return json({ error: userMsg, detail: errText.slice(0, 500) }, 500, corsHeaders);
    }

    const data = await response.json();
    return json({ text: (data.text || "").trim() }, 200, corsHeaders);
  } catch (err) {
    return json({ error: "Server error", detail: err.message }, 500, corsHeaders);
  }
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

export const config = {
  path: "/api/transcribe",
};
