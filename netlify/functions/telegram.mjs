// Netlify Function: Telegram Bot webhook for Quest Mode
// Handles: /start, /quests, /done, /streak, /help
// Storage: Netlify Blobs (built-in KV store)

import { getStore } from "@netlify/blobs";

const TELEGRAM_API = "https://api.telegram.org/bot";

function getToken() {
  return Netlify.env.get("TELEGRAM_BOT_TOKEN");
}

async function tg(method, body) {
  const token = getToken();
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not set");
  const res = await fetch(`${TELEGRAM_API}${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function sendMessage(chatId, text, extra = {}) {
  return tg("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", ...extra });
}

// Get or create user store
async function getUser(chatId) {
  const store = getStore("quest-users");
  try {
    const raw = await store.get(String(chatId));
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
}

async function saveUser(chatId, data) {
  const store = getStore("quest-users");
  await store.set(String(chatId), JSON.stringify(data));
}

// Get connect code data (temporary)
async function getConnectData(code) {
  const store = getStore("quest-connect");
  try {
    const raw = await store.get(code);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
}

async function saveConnectData(code, data) {
  const store = getStore("quest-connect");
  await store.set(code, JSON.stringify(data));
}

// ===== COMMAND HANDLERS =====

async function handleStart(chatId, args) {
  // Check if there's a connect code
  if (args) {
    const data = await getConnectData(args);
    if (data) {
      // Save user with quest data from app
      const user = {
        name: data.name || "Hero",
        quests: data.quests || [],
        completedToday: [],
        todayDate: todayKey(),
        streak: 0,
        totalDone: 0,
        lang: data.lang || "uk",
      };
      await saveUser(chatId, user);
      const questList = user.quests.map((q, i) => `${q.emoji} ${q.name}`).join("\n");
      await sendMessage(chatId,
        `🌱 <b>Привіт, ${user.name}!</b>\n\n` +
        `Quest Mode підключено! Ось твої квести:\n\n${questList}\n\n` +
        `Команди:\n/quests — показати квести\n/done — відмітити виконане\n/streak — статистика\n/help — допомога`
      );
      return;
    }
  }

  // No connect code — manual setup
  const user = await getUser(chatId);
  if (user) {
    await sendMessage(chatId,
      `🌱 <b>З поверненням, ${user.name}!</b>\n\n` +
      `Команди:\n/quests — показати квести\n/done — відмітити виконане\n/streak — статистика\n/help — допомога`
    );
    return;
  }

  // New user without connect code
  await sendMessage(chatId,
    `🌱 <b>Привіт! Це Quest Mode бот.</b>\n\n` +
    `Щоб підключити свої квести:\n` +
    `1️⃣ Відкрий <a href="https://celebrated-jelly-12f862.netlify.app/">Quest Mode</a>\n` +
    `2️⃣ Натисни 🤖 <b>Telegram</b> на дашборді\n` +
    `3️⃣ Скопіюй код і надішли мені\n\n` +
    `Або надішли свої квести текстом (по одному на рядок) і я їх збережу!`
  );
}

async function handleQuests(chatId) {
  const user = await getUser(chatId);
  if (!user || !user.quests?.length) {
    await sendMessage(chatId, "❌ Квести не знайдено. Підключи Quest Mode через /start або надішли квести текстом.");
    return;
  }
  rolloverUser(user);
  const lines = user.quests.map((q, i) => {
    const done = user.completedToday.includes(i);
    return `${done ? "✅" : "⬜"} ${q.emoji} ${q.name} ${done ? "" : "(+" + q.xp + " XP)"}`;
  });
  const doneCount = user.completedToday.length;
  const total = user.quests.length;
  await sendMessage(chatId,
    `📋 <b>Квести на сьогодні</b> (${doneCount}/${total})\n\n${lines.join("\n")}\n\n` +
    `Відмітити: /done 1 (номер квесту)`
  );
}

async function handleDone(chatId, args) {
  const user = await getUser(chatId);
  if (!user || !user.quests?.length) {
    await sendMessage(chatId, "❌ Спершу підключи квести через /start");
    return;
  }
  rolloverUser(user);

  if (!args) {
    // Show inline keyboard with quest buttons
    const buttons = user.quests.map((q, i) => {
      const done = user.completedToday.includes(i);
      return [{ text: `${done ? "✅" : "⬜"} ${q.emoji} ${q.name}`, callback_data: `done_${i}` }];
    });
    await sendMessage(chatId, "Натисни на квест щоб відмітити:", {
      reply_markup: { inline_keyboard: buttons },
    });
    return;
  }

  const idx = parseInt(args) - 1;
  if (isNaN(idx) || idx < 0 || idx >= user.quests.length) {
    await sendMessage(chatId, `❌ Невірний номер. Введи від 1 до ${user.quests.length}`);
    return;
  }

  if (user.completedToday.includes(idx)) {
    await sendMessage(chatId, `✅ Вже виконано: ${user.quests[idx].emoji} ${user.quests[idx].name}`);
    return;
  }

  user.completedToday.push(idx);
  user.totalDone = (user.totalDone || 0) + 1;
  const xp = user.quests[idx].xp || 25;

  // Check if all done
  const allDone = user.completedToday.length === user.quests.length;
  if (allDone && user.completedToday.length === 1) {
    // First task today — update streak
    user.streak = (user.streak || 0) + 1;
  }

  await saveUser(chatId, user);

  let msg = `✅ <b>${user.quests[idx].emoji} ${user.quests[idx].name}</b>\n+${xp} XP! `;
  msg += `(${user.completedToday.length}/${user.quests.length})`;

  if (allDone) {
    msg += `\n\n🎉 <b>Всі квести виконано!</b> Ти молодець, ${user.name}! 🔥`;
    if (user.streak > 1) msg += `\nСерія: ${user.streak} днів поспіль!`;
  }

  await sendMessage(chatId, msg);
}

async function handleStreak(chatId) {
  const user = await getUser(chatId);
  if (!user) {
    await sendMessage(chatId, "❌ Спершу підключи Quest Mode через /start");
    return;
  }
  rolloverUser(user);
  const doneToday = user.completedToday?.length || 0;
  const total = user.quests?.length || 0;

  await sendMessage(chatId,
    `📊 <b>Статистика ${user.name}</b>\n\n` +
    `🔥 Серія: <b>${user.streak || 0}</b> днів\n` +
    `✅ Всього виконано: <b>${user.totalDone || 0}</b>\n` +
    `📋 Сьогодні: <b>${doneToday}/${total}</b>\n\n` +
    `${user.streak >= 7 ? "🏆 Неймовірна дисципліна!" :
      user.streak >= 3 ? "💪 Гарна серія, тримай!" :
      user.streak >= 1 ? "🌱 Початок покладено!" :
      "Починай виконувати квести — /quests"}`
  );
}

async function handleHelp(chatId) {
  await sendMessage(chatId,
    `🌱 <b>Quest Mode — команди</b>\n\n` +
    `/quests — показати сьогоднішні квести\n` +
    `/done — відмітити квест виконаним\n` +
    `/done 1 — відмітити квест №1\n` +
    `/streak — твоя статистика\n` +
    `/reset — скинути прогрес на сьогодні\n` +
    `/help — ця довідка\n\n` +
    `💡 Підключи квести через Quest Mode додаток для персоналізації!`
  );
}

async function handleReset(chatId) {
  const user = await getUser(chatId);
  if (!user) return;
  user.completedToday = [];
  user.todayDate = todayKey();
  await saveUser(chatId, user);
  await sendMessage(chatId, "🔄 Прогрес на сьогодні скинуто. /quests — почати знову.");
}

async function handleTextMessage(chatId, text) {
  // Try to parse as quest list or connect code
  const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 2);

  // Check if it's a connect code (base64)
  if (lines.length === 1 && lines[0].length > 20 && !lines[0].includes(" ")) {
    try {
      const decoded = JSON.parse(atob(lines[0]));
      if (decoded.quests) {
        const user = {
          name: decoded.name || "Hero",
          quests: decoded.quests,
          completedToday: [],
          todayDate: todayKey(),
          streak: 0,
          totalDone: 0,
          lang: decoded.lang || "uk",
        };
        await saveUser(chatId, user);
        const questList = user.quests.map(q => `${q.emoji} ${q.name}`).join("\n");
        await sendMessage(chatId,
          `✅ <b>Квести підключено!</b>\n\n${questList}\n\n/quests — переглянути\n/done — відмітити виконане`
        );
        return;
      }
    } catch (e) {}
  }

  // Parse as plain text quest list
  if (lines.length >= 1 && lines.length <= 10) {
    const quests = lines.map((l, i) => ({
      emoji: ["🎯","⚡","🌅","💪","📚","🔥","✨","🌟"][i] || "▪️",
      name: l.replace(/^[\d\.\-\)\s]+/, "").trim(), // Remove numbering
      xp: 25,
    }));

    let user = await getUser(chatId);
    if (!user) {
      user = { name: "Hero", quests: [], completedToday: [], todayDate: todayKey(), streak: 0, totalDone: 0, lang: "uk" };
    }
    user.quests = quests;
    user.completedToday = [];
    await saveUser(chatId, user);

    const questList = quests.map(q => `${q.emoji} ${q.name}`).join("\n");
    await sendMessage(chatId,
      `✅ <b>Збережено ${quests.length} квестів!</b>\n\n${questList}\n\n/quests — переглянути\n/done — відмітити виконане`
    );
    return;
  }

  await sendMessage(chatId, "🤔 Не зрозумів. Надішли список квестів (по одному на рядок) або скористайся /help");
}

// Handle callback query (inline button press)
async function handleCallback(callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  if (data.startsWith("done_")) {
    const idx = parseInt(data.split("_")[1]);
    const user = await getUser(chatId);
    if (!user || !user.quests) return;
    rolloverUser(user);

    if (!user.completedToday.includes(idx)) {
      user.completedToday.push(idx);
      user.totalDone = (user.totalDone || 0) + 1;
      if (user.completedToday.length === 1) {
        user.streak = (user.streak || 0) + 1;
      }
      await saveUser(chatId, user);
    }

    // Update the message with new button states
    const buttons = user.quests.map((q, i) => {
      const done = user.completedToday.includes(i);
      return [{ text: `${done ? "✅" : "⬜"} ${q.emoji} ${q.name}`, callback_data: `done_${i}` }];
    });

    const doneCount = user.completedToday.length;
    const total = user.quests.length;
    let statusText = `Натисни на квест (${doneCount}/${total}):`;
    if (doneCount === total) statusText = `🎉 Всі ${total} квестів виконано! Молодець!`;

    await tg("editMessageText", {
      chat_id: chatId,
      message_id: callbackQuery.message.message_id,
      text: statusText,
      reply_markup: { inline_keyboard: buttons },
    });

    await tg("answerCallbackQuery", {
      callback_query_id: callbackQuery.id,
      text: `✅ +${user.quests[idx]?.xp || 25} XP!`,
    });
  }
}

// Helpers
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function rolloverUser(user) {
  const today = todayKey();
  if (user.todayDate !== today) {
    if (user.completedToday?.length === 0) {
      user.streak = 0; // Broke the streak
    }
    user.completedToday = [];
    user.todayDate = today;
  }
}

// ===== MAIN HANDLER =====
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
    return new Response("OK", { status: 200, headers: corsHeaders });
  }

  const token = getToken();
  if (!token) {
    return new Response(JSON.stringify({ error: "TELEGRAM_BOT_TOKEN not set" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return new Response("Bad JSON", { status: 400 });
  }

  // Handle sync request from Quest Mode app
  if (body.action === "sync") {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    await saveConnectData(code, body.data);

    // Get bot username for deep link
    const me = await tg("getMe", {});
    const botUsername = me.result?.username || "quest_mode_bot";

    return new Response(JSON.stringify({
      ok: true,
      code,
      botLink: `https://t.me/${botUsername}?start=${code}`,
      botUsername,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Handle Telegram webhook update
  try {
    if (body.callback_query) {
      await handleCallback(body.callback_query);
    } else if (body.message) {
      const msg = body.message;
      const chatId = msg.chat.id;
      const text = (msg.text || "").trim();

      if (text.startsWith("/start")) {
        await handleStart(chatId, text.replace("/start", "").trim());
      } else if (text === "/quests") {
        await handleQuests(chatId);
      } else if (text.startsWith("/done")) {
        await handleDone(chatId, text.replace("/done", "").trim());
      } else if (text === "/streak") {
        await handleStreak(chatId);
      } else if (text === "/help") {
        await handleHelp(chatId);
      } else if (text === "/reset") {
        await handleReset(chatId);
      } else if (text.startsWith("/")) {
        await sendMessage(chatId, "❓ Невідома команда. /help — список команд.");
      } else {
        await handleTextMessage(chatId, text);
      }
    }
  } catch (err) {
    console.error("Telegram handler error:", err);
  }

  return new Response("OK", { status: 200, headers: corsHeaders });
};

export const config = {
  path: "/api/telegram",
};
