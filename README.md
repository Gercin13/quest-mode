# Quest Mode — Netlify Deploy Guide

Прототип ADHD-додатку з повноцінним LLM-flow (4 кроки інтервʼю з OpenAI).

## 🚀 Швидкий деплой (15-30 хвилин)

### Крок 1 · Створи акаунти (5 хв)

Тобі потрібні **3 безкоштовні акаунти**:

1. **GitHub** → https://github.com/signup
   - Це для збереження коду
2. **Netlify** → https://app.netlify.com/signup
   - Зайди через GitHub (один клік)
   - Це для хостингу
3. **OpenAI Platform** → https://platform.openai.com/signup
   - Це для LLM (GPT-4o)
   - **Поповни на $5-10** тут: https://platform.openai.com/account/billing

### Крок 2 · Отримай OpenAI API Key (2 хв)

1. Відкрий https://platform.openai.com/api-keys
2. Натисни **"Create new secret key"**
3. Назва: `quest-mode`
4. **Скопіюй ключ** (починається з `sk-...`) — побачиш його лише ОДИН раз!
5. Збережи в надійне місце (наприклад, у Notes)

### Крок 3 · Створи GitHub репо (3 хв)

1. Зайди на https://github.com → натисни **"+"** у правому верхньому кутку → **"New repository"**
2. Назва: `quest-mode` (або як хочеш)
3. Тип: **Public** (не страшно — API key буде на Netlify, не в коді)
4. Не став галочки на README/gitignore
5. Натисни **"Create repository"**

### Крок 4 · Завантаж файли в репо (5 хв)

На сторінці новоствореного репо:

1. Натисни **"uploading an existing file"** (синє посилання)
2. **Перетягни всі файли і папки** з папки `netlify-deploy/`:
   - `index.html`
   - `netlify.toml`
   - `.gitignore`
   - папка `netlify/` (з функцією chat.mjs + prompts.mjs)
   - папка `prompts/` (з оригінальними `.txt` файлами — для довідки)
3. Внизу натисни **"Commit changes"**

✅ Тепер код у GitHub.

### Крок 5 · Деплой на Netlify (5 хв)

1. Зайди на https://app.netlify.com
2. Натисни **"Add new site"** → **"Import an existing project"**
3. Обери **"GitHub"** — авторизуй якщо запитує
4. Знайди свій репо `quest-mode` у списку → клік
5. На екрані налаштувань збору **нічого не міняй** (Netlify сам прочитає `netlify.toml`)
6. Натисни **"Deploy site"**

⏳ Чекай 30-60 секунд — побачиш зелене **"Published"**.

🎉 Сайт доступний на адресі типу `https://random-name-12345.netlify.app`.

### Крок 6 · Додай OpenAI API Key (2 хв)

⚠️ **Без цього кроку чат не працюватиме!**

1. У Netlify, на сторінці свого сайту: **Site configuration** → **Environment variables**
2. Натисни **"Add a variable"** → **"Add a single variable"**
3. Заповни:
   - **Key:** `OPENAI_API_KEY`
   - **Value:** твій ключ з кроку 2 (`sk-...`)
4. Натисни **"Create variable"**
5. **Перезапусти деплой:** Deploys → Trigger deploy → Deploy site

### Крок 7 · Тестування

1. Відкрий свій `*.netlify.app` URL
2. Пройди онбординг: введи імʼя → почни Крок 1
3. ШІ має поставити перше питання
4. Відповідай як зазвичай
5. Якщо щось не працює — див. [Troubleshooting](#-troubleshooting)

---

## 🔧 Як змінити сайт

Будь-яка зміна:
1. Відредагуй файл прямо у GitHub (натисни ✏️ біля файлу)
2. Внизу натисни **"Commit changes"**
3. Netlify автоматично перебудує сайт за 30-60 секунд

---

## 🤖 Які моделі використовуються

У файлі `netlify/functions/chat.mjs`:

```javascript
const MODELS = {
  chat: "gpt-4o-mini",  // Steps 1, 2, 4 — інтервʼю (дешева)
  analysis: "gpt-4o"    // Step 3 — аналіз (потужна)
};
```

**GPT-4o-mini** — для інтервʼю-кроків:
- $0.15 за 1M вхідних токенів
- $0.60 за 1M вихідних токенів
- ~$0.05-0.15 за повний онбординг (без Кроку 3)

**GPT-4o** — для Кроку 3 (аналіз):
- $2.50 за 1M вхідних токенів
- $10.00 за 1M вихідних токенів
- ~$0.10-0.20 за один аналіз

**Сумарно ~$0.30-0.50 за нового користувача.**

---

## 🎨 Як додати власний домен (опційно)

1. Купи домен на [Cloudflare Registrar](https://dash.cloudflare.com/?to=/:account/domains/register) (~$14/рік для `.app`)
2. У Netlify: Site configuration → Domain management → **Add custom domain**
3. Введи свій домен (`questmode.app`)
4. Netlify покаже DNS записи — додай їх у Cloudflare
5. Через 1-24 год домен запрацює, HTTPS автоматично

---

## 💰 Скільки коштує?

### Що безкоштовне
- Netlify Hosting: 100 GB трафіку, 125K викликів функцій, custom domain — все free
- GitHub: безлімітно для public репо
- Sentry, PostHog: free tiers

### Що платне
- **OpenAI** — pay-as-you-go:
  - GPT-4o-mini (для Кроків 1, 2, 4): ~$0.15-0.30 за повний онбординг
  - GPT-4o (для Кроку 3): ~$0.20 за аналіз
  - **Сумарно: $0.30-0.50 за нового користувача**
- **Домен** (опційно): $14/рік

### Приклади бюджетів
- 50 тестових користувачів: **~$25 OpenAI** (одноразово)
- 500 MAU: **~$200/міс OpenAI** (плюс $0 за інфру)
- 5000 MAU: **~$2K/міс OpenAI** + $25 Netlify Pro

### Як контролювати витрати
1. У OpenAI Platform: **Usage limits** → встанови `Hard limit: $50/міс`
2. У Netlify Functions: вже є rate limiting у коді (50 запитів/IP/година)

---

## 🐛 Troubleshooting

### "OPENAI_API_KEY not configured"
- Не додав env variable → див. Крок 6
- Або не перезапустив деплой після додавання

### "Invalid API key"
- Невалідний API key → перевір що скопіював правильно
- Або термін дії ключа вийшов → створи новий на https://platform.openai.com/api-keys

### "OpenAI rate limit or insufficient credits"
- Закінчились кредити → поповни на https://platform.openai.com/account/billing
- Або rate limit OpenAI → почекай хвилину
- Перевір налаштування `Usage limits` в OpenAI Platform

### Чат "залипає" на typing-індикаторі
- Ймовірно, помилка стрімінгу → відкрий DevTools (F12) → Console, подивись що пише
- Або перезавантаж сторінку — стан збере

### "An unexpected error occurred"
- Netlify Functions logs: Site → Functions → click `chat` → див. логи
- Якщо `import` помилка → перевір що файл `prompts.mjs` є в `netlify/functions/`

### Хочу повернутись до початку
- Відкрий додаток → внизу натисни "Почати спочатку"
- Або очисти localStorage у DevTools → Application → Local Storage

---

## 📁 Структура проєкту

```
.
├── index.html              # Головна сторінка з чат-UI
├── netlify.toml            # Конфіг Netlify
├── .gitignore              # Файли що ігноруються в git
├── netlify/
│   └── functions/
│       ├── chat.mjs        # API endpoint /api/chat (OpenAI proxy)
│       └── prompts.mjs     # 4 мастер-промпти як константи
└── prompts/                # Оригінали мастер-промптів (для довідки)
    ├── step1_pointA.txt
    ├── step2_pointB.txt
    ├── step3_analysis.txt
    └── step4_avatar.txt
```

---

## 🔄 Як оновити мастер-промпти

Якщо змінив один з `.txt` файлів у папці `prompts/`:

1. Відкрий `netlify/functions/prompts.mjs`
2. Знайди відповідний промпт (step1/step2/step3/step4)
3. Скопіюй новий текст у lapki (` `... `)
4. **ВАЖЛИВО:** заекрануй усі backticks (` ` ` → `\\``) і `${` (→ `\\${`)
5. Commit → Netlify автоматично перерозгорне

Або просто скажи мені — допоможу оновити автоматично.

---

## 📞 Що далі

Коли цей MVP запрацює, можна додавати:

1. **Дашборд із квестами** (як було в HTML-прототипі) — гра-механіка XP/streak
2. **Auth** через Netlify Identity або Magic.link
3. **Cross-device sync** через Supabase
4. **Calendar інтеграції** (Google, Notion)
5. **Власний домен** + лендинг з waitlist

Для всіх цих кроків — використовуй цей репо як базу.
