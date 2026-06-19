# 🎯 THE WAY — סיכום מלא

## 📱 מה בנינו

אפליקציה web-based (PWA) למעקב משקל, תזונה וכושר עם AI שמנתח תמונות אוכל וסקרינשוטים של צעדים.

---

## 🎭 3 תפקידים

### 1️⃣ **מתאמן (Client)**
- **עמוד הבית**: ציטוט יומי, צעדים היום, צריכת מים, משקל אחרון
- **טאב אוכל 🍽️**: צלם אוכל → AI מנתח → 3 אפשרויות גודל מנה
- **טאב משקל ⚖️**: הוסף משקל + גרף התקדמות → ציטוט כשמגיע לחצי דרך
- **טאב תחרות 👟**: העלה סקרינשוט מהבריאות → AI קורא צעדים → leaderboard יומי/שבועי

### 2️⃣ **מאמן (Coach)**
- **דאשבורד מלא**: רואה את כל המתאמנים
- **ניהול מתאמנים**: הוסף מתאמן חדש (שם + אימייל + סיסמה)
- **צפייה בארוחות**: סנן לפי תאריך / מתאמן / סוג ארוחה
- **ניהול ציטוטים**: הוסף ציטוטים חדשים (יהיו בעמוד הבית של המתאמנים)
- **תחרויות**: רואה את כל המתאמנים בleaderboard

### 3️⃣ **מערכת (AI)**
- **Claude Vision**: קורא תמונות אוכל + מחזיר קלוריות/חלבון/פחמימות/שומן
- **Claude Vision**: קורא סקרינשוטים מהבריאות + מחזיר מספר צעדים
- **הודעות דחופות**: שלח push notifications (כדי שלא יעברו על זה)

---

## 🔓 חשבונות לדוגמה

```
מאמן:
  אימייל: coach@theway.com
  סיסמה: 123456

מתאמנים:
  אימייל: dani@theway.com
  סיסמה: 123456
  
  אימייל: michal@theway.com
  סיסמה: 123456
```

---

## 🗂️ מבנה קבצים (כל קובץ = מה הוא עושה)

### **Root Config Files**
- `package.json` — תלויות וסקריפטים
- `tsconfig.json` — הגדרות TypeScript
- `next.config.ts` — הגדרות Next.js
- `.env.local` — משתנים סביבתיים (API keys)
- `PROJECT_STRUCTURE.md` — **תיעוד מלא של כל קובץ**

### **Database & Logic** (`src/lib/`)
- `db.ts` — חיבור Turso + יצירת טבלאות
- `anthropic.ts` — Claude Vision API קוד
- `auth.ts` — JWT + bcrypt בנטו
- `types.ts` — TypeScript interfaces
- `meals.ts` — פונקציות CRUD ארוחות
- `seed.ts` — ריצה ראשונית עם דוגמאות

### **API Routes** (`src/app/api/`)
#### Auth
- `/auth/login` — התחברות
- `/auth/logout` — יציאה
- `/auth/me` — פרטי משתמש נוכחי

#### AI & Analysis
- `/analyze-food` — תמונה אוכל → נתזה וקלוריות
- `/analyze-steps` — סקרינשוט → צעדים

#### Tracking
- `/weight` — משקל (GET = היסטוריה, POST = הוסף)
- `/water` — מים (GET = סך היום, POST = הוסף כוס)
- `/steps` — צעדים (GET = יומי/leaderboard, POST = העלה סקרינשוט)
- `/leaderboard` — תחרויות (יומי/שבועי)
- `/goals` — יעדים (משקל, קלוריות, מים)

#### Motivation
- `/quotes` — ציטוטים (GET = אקראי, POST = הוסף)

#### Notifications
- `/push/subscribe` — הרשם ל-push
- `/push/send` — שלח הודעה

#### Admin
- `/admin/seed-quotes` — זרע 12 ציטוטים

### **Pages** (`src/app/`)
- `layout.tsx` — HTML base + PWA config
- `login/page.tsx` — עמוד התחברות
- `client/page.tsx` — דשבורד מתאמן (4 טאבים)
- `coach/page.tsx` — דשבורד מאמן
- `pwa-register.tsx` — הגדרות service worker

### **Components** (`src/components/`)
- `ui.tsx` — Header, NutritionBadge, MealCard וכו'

### **Static Files** (`public/`)
- `manifest.json` — PWA settings
- `icon-192.png` — PWA icon
- `uploads/` — תמונות (נוצרות בזמן ריצה)

---

## 📊 Database (Turso/SQLite)

### טבלאות עיקריות:
```
users ← משתמשים עם תפקידים (coach/client)
foods ← מערך מזונות בהם יש ערכים תזונתיים
meals ← כל ארוחה שנרשמה
meal_items ← פריטים בכל ארוחה
weight_logs ← כל שקילה
steps_logs ← כל העלאת צעדים
water_logs ← כל הוספת מים
goals ← יעדים של כל משתמש
quotes ← ציטוטים מוטיבציוניים
push_subscriptions ← התחברויות ל-push notifications
ai_meal_logs ← היסטוריה של ניתוח AI
```

---

## 🔐 Security

- ✅ JWT tokens (365 days)
- ✅ bcrypt passwords (10 salts)
- ✅ httpOnly cookies (no XSS)
- ✅ Role-based access (coach vs client)
- ✅ User isolation (client רואה רק עצמו)

---

## 🚀 Deploy Ready

האפליקציה מוכנה להתקנה על:
- **Vercel** (Next.js native)
- **Railway** (node server)
- **Netlify** (static + functions)

צריך רק להעביר את `.env.local` למערכת ההרצה.

---

## 📋 Checklist

### ✅ Done
- [x] Auth system (JWT + bcrypt)
- [x] Food photo analysis (Claude Vision)
- [x] Steps screenshot reading (Claude Vision)
- [x] Weight tracking + graph
- [x] Water logging (quick buttons)
- [x] Motivational quotes (rotating)
- [x] Daily + weekly leaderboards
- [x] Coach dashboard
- [x] Client app (4 tabs)
- [x] Database schema (Turso)
- [x] PWA setup (installable on iPhone)
- [x] Push notification infrastructure

### 🔮 Optional Future Features
- [ ] Automatic water reminders (scheduled push)
- [ ] Context-aware quotes (only show at milestones)
- [ ] Weekly summary reports
- [ ] Stats dashboard (charts)
- [ ] Coaching notes system
- [ ] Progress photos gallery
- [ ] Workout logging
- [ ] Meal plans (save favorites)

---

## ⚡ Quick Start

```bash
# Start dev server
npm run dev

# Open browser
http://localhost:3000

# Login with
coach@theway.com / 123456
```

---

## 🎓 How It Works (End-to-End)

### מתאמן מצלם ארוחה:
1. פותח את האפליקציה
2. לוחץ על "צלם ארוחה חדשה"
3. מעלה תמונה
4. Claude Vision מנתח:
   - "זה עוף + אורז + ברוקולי"
   - עוף: 200g = 330 קל' + 31g חלבון
   - אורז: 150g = 195 קל' + 4.5g חלבון
   - ברוקולי: 100g = 34 קל' + 3.7g חלבון
   - **סה"כ: 559 קלוריות**
5. מתאמן רואה 3 אפשרויות גודל (קטן/בינוני/גדול)
6. בוחר "בינוני" ו"שמור"
7. הנתונים נשמרים בDB

### מאמן רואה את זה:
1. מכנס לדאשבורד
2. בוחר תאריך ומתאמן
3. רואה את כל הארוחות עם תמונות
4. רואה סיכום קלוריות/חלבון יומי

### מתאמן העלה סקרינשוט צעדים:
1. מצלם סקרינשוט מאפליקציית הבריאות (8,530 צעדים)
2. מעלה אותו
3. Claude Vision קורא את המספר
4. שמור בDB
5. מתאמן רואה את עצמו בleaderboard

---

## 💬 Questions?

כל דבר לא בהיר? תשאל!
