# The Way — אפליקציית מעקב תזונה וכושר

אפליקציית PWA למאמנים ומתאמנים: מתאמנים מצלמים ארוחות ומעלים סקרינשוטים של צעדים,
AI (Claude) מנתח ומחזיר ערכים תזונתיים, והמאמן רואה הכל בדשבורד אחד — כולל צ'אט,
ניהול קבוצות, מעקב משקל/מים/צעדים, ועוזר AI.

## התקנה והרצה

```bash
npm install
npm run dev
```

פתח [http://localhost:3000](http://localhost:3000).

צריך `.env.local` עם משתני הסביבה — ראה [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) לרשימה המלאה.

## טכנולוגיות

- Next.js 15 (App Router, Turbopack) + React 19 + TypeScript (strict)
- Turso (LibSQL) — מסד נתונים בענן, לא SQLite מקומי
- JWT (jose) + bcrypt לאימות, הגנת CSRF (double-submit cookie)
- Claude API (Anthropic) — ניתוח תמונות אוכל וסקרינשוטים של צעדים, ועוזר AI בצ'אט
- מאגר תזונה רשמי (Tzameret, משרד הבריאות) — לא נתונים מומצאים
- Tailwind CSS, Framer Motion, ממשק בעברית מלא (RTL)
- Web Push (VAPID) להתראות, Vercel Cron למשימות מתוזמנות

## איך זה עובד

1. **מתאמן** — מתחבר, עוקב אחרי מים/צעדים/משקל, מצלם ארוחות (ה-AI מזהה ומחשב קלוריות/חלבון/פחמימות/שומן), משתתף בצ'אט עם המאמן וקבוצת המתאמנים.
2. **מאמן** — רואה את כל המתאמנים שלו, בונה תפריטים, מנהל קבוצות צ'אט, עוקב אחרי פעילות ומקבל תובנות (coach insights).
3. בסביבת פיתוח מקומית (`npm run dev`, לא production) נזרעים אוטומטית משתמשי דמו — קוד המאמן ב-`src/lib/seed.ts` מדלג על כך לגמרי כש-`NODE_ENV=production`, כך שהם אף פעם לא נוצרים בפרודקשן.

## תיעוד נוסף

- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) — משתני סביבה ופריסה
- [docs/API.md](./docs/API.md) — תיעוד endpoints
- [docs/MONITORING.md](./docs/MONITORING.md) — בוט ניטור בריאות המערכת
- [docs/PROJECT_STRUCTURE.md](./docs/PROJECT_STRUCTURE.md) — מבנה הפרויקט
- [CONTRIBUTING.md](./CONTRIBUTING.md) — איך להוסיף פיצ'ר, קונבנציות קוד
