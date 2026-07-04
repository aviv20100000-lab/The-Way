# 📁 THE WAY — מבנה הפרויקט

## 🎯 סקירה כללית
אפליקציה Web PWA למעקב משקל ותזונה עם AI שמנתח תמונות אוכל וצעדים

---

## 📦 קבצי הגדרה בשורש

```
package.json           # תלויות: Next.js, React, Anthropic AI, Turso DB, TailwindCSS
tsconfig.json         # הגדרות TypeScript (strict mode, paths alias @/*)
postcss.config.mjs    # Tailwind CSS configuration
next.config.ts        # Next.js config
.env.local            # משתנים סביבתיים: ANTHROPIC_API_KEY, TURSO_URL, VAPID_KEYS וכו'
```

---

## 🗂️ **src/lib** — יסודות המערכת

### תיקייה: `src/lib/`
| קובץ | תיאור |
|------|-------|
| **db.ts** | חיבור לTurso (SQLite בענן) — initDb() יוצרת את כל הטבלאות |
| **anthropic.ts** | Claude Vision API — `analyzeFoodPhoto()` ו `extractStepsFromScreenshot()` |
| **auth.ts** | JWT + bcrypt — התחברות, verification, cookies |
| **types.ts** | TypeScript interfaces: User, Food, Meal, WeightLog, etc. |
| **meals.ts** | פונקציות ל-CRUD ארוחות |
| **seed.ts** | אתחול DB עם מזון לדוגמה + חשבונות בדיקה |
| **claude.ts** | (אפשרי) עוזר נוסף ל-Claude API |

---

## 🔐 **src/app/api** — API Endpoints

### אימות (Auth)
```
/api/auth/login/       ← POST: התחברות עם אימייל + סיסמה → JWT
/api/auth/logout/      ← POST: יציאה (מחיקת cookie)
/api/auth/me/          ← GET: מידע המשתמש הנוכחי
```

### AI & ניתוח
```
/api/analyze-food/     ← POST: העלה תמונה אוכל → Claude Vision מנתח → {items, total_calories}
/api/ai/analyze-meal/  ← POST: (גרסה חלופית) ניתוח אוכל
/api/analyze-steps/    ← POST: העלה סקרינשוט → AI קורא צעדים → {steps}
/api/ai/analyze-steps/ ← POST: (גרסה חלופית) ניתוח צעדים
```

### מעקב מתאמנים
```
/api/clients/          ← GET: רשימת מתאמנים של המאמן
                       ← POST: הוסף מתאמן חדש
/api/goals/            ← GET/POST/PUT: יעדים (משקל יעד, מים יומיים וכו')
```

### יומנים ומעקבים
```
/api/meals/            ← GET: ארוחות ליום ספציפי
                       ← POST: הוסף ארוחה חדשה (עם תמונה)

/api/weight/           ← GET: היסטוריית משקל
                       ← POST: הוסף מדידת משקל

/api/water/            ← GET: צריכת מים יומית
                       ← POST: הוסף כמות מים (250ml וכו')

/api/steps/            ← GET: צעדים יומיים / leaderboard
                       ← POST: העלה סקרינשוט מהבריאות

/api/leaderboard/      ← GET: תחרות צעדים (יומי/שבועי)
```

### ציטוטים ומוטיבציה
```
/api/quotes/           ← GET: ציטוט אקראי לעמוד הבית
                       ← POST: הוסף ציטוט (מאמן בלבד)
                       ← DELETE: הסר ציטוט (מאמן בלבד)
```

### Push Notifications
```
/api/push/subscribe/   ← POST: הרשם ל-push notifications
/api/push/send/        ← POST: שלח notification למתאמן
```

### ניהול
```
/api/admin/seed-quotes/ ← GET: זרע 12 ציטוטים לתוך DB (token=dev)
```

---

## 🎨 **src/app/pages** — UI (Next.js App Router)

| עמוד | תיאור |
|------|-------|
| **layout.tsx** | Layout ראשי: head, manifest, PWA icons |
| **page.tsx** | דף ריק / redirect לאימות |
| **login/page.tsx** | עמוד התחברות (אימייל + סיסמה) |
| **client/page.tsx** | דשבורד המתאמן: 4 טאבים (בית, אוכל, משקל, תחרות) |
| **coach/page.tsx** | דשבורד המאמן: ניהול מתאמנים, צפייה בארוחות, סינונים |
| **pwa-register.tsx** | רישום service worker ל-PWA |

---

## 🧩 **src/components** — UI Components

| קובץ | תיאור |
|------|-------|
| **ui.tsx** | Components משותפים: Header, NutritionBadge, MealCard |

---

## 📱 **public** — Static Files

```
manifest.json    ← PWA manifest (name, icons, display mode וכו')
icon-192.png     ← PWA icon (192x192)
uploads/         ← תמונות אוכל + סקרינשוטים צעדים (שנוצרות בזמן ריצה)
```

---

## 📊 **Database Schema (Turso/SQLite)**

### טבלאות ראשיות:

```sql
users
├─ id (PRIMARY KEY)
├─ name, email, password_hash
├─ role ('coach' | 'client')
└─ coach_id (FK) ← מתאמן מחובר לאיזה מאמן

foods
├─ id (PRIMARY KEY)
├─ name_he, name_en
└─ calories, protein, carbs, fat, serving_size

meals ← ארוחות שנרשמו
├─ id (PRIMARY KEY)
├─ user_id (FK)
├─ photo_url
├─ meal_type ('breakfast'|'lunch'|'dinner'|'snack')
└─ logged_at

meal_items ← פריטים בכל ארוחה
├─ id (PRIMARY KEY)
├─ meal_id (FK)
├─ food_id (FK)
└─ quantity

weight_logs
├─ id (PRIMARY KEY)
├─ user_id (FK)
├─ weight_kg
└─ logged_at

steps_logs
├─ id (PRIMARY KEY)
├─ user_id (FK)
├─ steps
├─ screenshot_url
└─ logged_at

water_logs
├─ id (PRIMARY KEY)
├─ user_id (FK)
├─ amount_ml
└─ logged_at

goals
├─ user_id (PRIMARY KEY, FK)
├─ target_weight_kg
├─ daily_calories
└─ daily_water_ml

quotes
├─ id (PRIMARY KEY)
├─ text
├─ author
├─ active (1|0)
└─ created_at

push_subscriptions
├─ id (PRIMARY KEY)
├─ user_id (FK)
├─ endpoint, p256dh, auth ← push notification details
└─ created_at

ai_meal_logs
├─ id (PRIMARY KEY)
├─ user_id (FK)
├─ photo_url
├─ ai_response (JSON)
└─ logged_at
```

---

## 🔄 **Data Flow**

```
MetAmtzenim (מתאמנים):
┌──────────────┐
│ צלם ארוחה   │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────┐
│ POST /api/analyze-food           │
│ + תמונה                          │
│ → Claude Vision מנתח             │
│ → שמור בdb: ai_meal_logs         │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────┐
│ הצג תוצאות:     │
│ - סוגי מזון    │
│ - קלוריות      │
│ - נוטריצנטים   │
└──────────────────┘
```

```
תחרות צעדים:
┌──────────────────────┐
│ צלם סקרינשוט בריאות │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────────────┐
│ POST /api/analyze-steps      │
│ → Claude Vision קורא מספר   │
│ → שמור בdb: steps_logs       │
└──────┬───────────────────────┘
       │
       ▼
┌──────────────────────────┐
│ GET /api/steps?type=lb  │
│ → Leaderboard יומי/שבועי│
└──────────────────────────┘
```

---

## 🔐 **Authentication & Sessions**

1. **Login**: אימייל + סיסמה → bcrypt verify → JWT token
2. **Token**: Signed JWT (HS256) + stored in httpOnly cookie
3. **Session**: Checked in API routes via `getSessionUser()` middleware
4. **Expiry**: 365 days

---

## 🎯 **Client Features (4 Tabs)**

### 🏠 Home
- Motivational quote (random)
- Steps today (progress bar vs 10k goal)
- Water intake (progress vs 2L goal)
- Latest weight + progress to goal
- Notification toggle

### 🍽️ Food
- Camera button → upload image
- Claude AI analyzes → shows items with calories
- 3-portion size options suggested by AI
- Save to daily log

### ⚖️ Weight
- Progress journey (start → current → goal)
- Emoji runner tracking progress
- Milestone messages (halfway point, goal reached)
- Add weight entry
- Weight history timeline

### 👟 Steps
- Screenshot uploader (from iPhone Health)
- Claude reads step count automatically
- Daily leaderboard
- Weekly leaderboard
- Tap to upload new screenshot

---

## ⚙️ **Tech Stack**

| Layer | Tech |
|-------|------|
| **Frontend** | React 19 + Next.js 15 (App Router) |
| **Styling** | TailwindCSS 4 |
| **Backend** | Next.js API Routes |
| **Database** | Turso (SQLite in the cloud) |
| **AI** | Anthropic Claude 3.5 Sonnet (Vision) |
| **Auth** | JWT + bcrypt |
| **Notifications** | Web Push API |
| **PWA** | Service Worker (mobile-installable) |
| **Package Manager** | Bun |

---

## 🚀 **Environment Variables (.env.local)**

```env
ANTHROPIC_API_KEY=sk-ant-...           # Claude API key
TURSO_URL=libsql://...                 # Turso DB URL
TURSO_TOKEN=eyJ...                     # Turso auth token
JWT_SECRET=the-way-...                 # Session signing key
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...       # Push notifications (public)
VAPID_PRIVATE_KEY=...                  # Push notifications (private)
VAPID_EMAIL=mailto:...                 # Push notifications sender email
NEXT_PUBLIC_URL=http://localhost:3000  # Fallback for image URLs
```

---

## 📝 **Scripts**

```bash
npm run dev      # Start dev server (Turbopack) on port 3000
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

---

## ✅ **What's Working**

- ✅ Authentication (login/logout/session)
- ✅ Food photo analysis with AI
- ✅ Steps screenshot reading with AI
- ✅ Weight tracking with progress visualization
- ✅ Water intake logging
- ✅ Motivational quotes rotation
- ✅ Daily + weekly leaderboards
- ✅ Coach dashboard + client management
- ✅ PWA installable on iPhone
- ✅ Push notifications (infrastructure)

---

## 🔮 **Next Steps (Optional)**

- Automatic water reminders (push notifications)
- Context-aware quotes (after milestones)
- Statistics dashboard (weekly summaries)
- Export data as PDF
- Coaching notes system
- Progress photos gallery
