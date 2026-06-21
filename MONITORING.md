# בוט ניטור בריאות-המערכת 🩺

בוט שמתריע מיד כשמשהו נשבר בפרודקשן — לפני שמתאמן מגלה. בודק את כל השרשרת
הקריטית (env, מסד נתונים, CSRF/middleware, נתיב ההרשמה) ושולח התראת טלגרם
**רק כשהמצב משתנה** (תקלה חדשה, או חזרה לתקינות) — בלי ספאם.

## מה הוא בודק
| בדיקה | מה זה מאמת |
|---|---|
| `env` | כל משתני הסביבה הקריטיים מוגדרים (Turso, JWT, VAPID, Anthropic) |
| `db` | מסד הנתונים (Turso) מגיב, ומחזיר ספירת משתמשים + מנויי push |
| `csrf-token` | `GET /api/auth/csrf-token` מחזיר טוקן תקין |
| `csrf-middleware` | POST עם טוקן מחזיר 401 ולא 500 — בדיוק התקלה ששברה את ההתראות |

הנקודה (endpoint): `GET /api/cron/health-check` — מחזיר `200` כשהכל תקין,
`503` כשיש תקלה (כך שגם מוניטור חיצוני יסמן אותו כ"down").

## הפעלה — שני שלבים קצרים

### 1. ליצור בוט טלגרם ולקבל את הפרטים (פעם אחת, ~3 דקות)
1. בטלגרם, פתח צ'אט עם **@BotFather** → שלח `/newbot` → תן שם → קבל **TOKEN**.
2. שלח הודעה כלשהי לבוט החדש שיצרת (כדי "לפתוח" איתו צ'אט).
3. קבל את ה-**chat id** שלך: פתח בדפדפן
   `https://api.telegram.org/bot<TOKEN>/getUpdates` וחפש `"chat":{"id":...}`.
   (לחלופין שלח `/start` ל-**@userinfobot** והוא יחזיר לך את ה-id.)

### 2. להוסיף שני משתני סביבה ב-Vercel
```
TELEGRAM_BOT_TOKEN = <ה-TOKEN מ-BotFather>
TELEGRAM_CHAT_ID   = <ה-chat id שלך>
```
> בלי שני אלה הבוט פשוט שותק (no-op) — הוא לא שובר כלום. אפשר להוסיף אותם מתי שרוצים.

זהו. ה-cron של Vercel כבר מריץ בדיקה יומית (07:00). אם תרצה בדיקות תכופות יותר — ראה למטה.

## בדיקות כל 5 דקות — GitHub Actions ✅ (מוגדר ופעיל)
תוכנית Hobby של Vercel מריצה cron רק פעם ביום, אז יש workflow ב-GitHub Actions
שבודק **כל 5 דקות**: [`.github/workflows/health-check.yml`](.github/workflows/health-check.yml).
הוא קורא לנקודה עם `Authorization: Bearer <CRON_SECRET>`, ואם האתר לא מגיב כלל
(שזה ה-cron של Vercel לא יכול לתפוס) — הוא שולח התראת טלגרם בעצמו וגם נכשל
(מה ש-GitHub שולח עליו מייל לבעל הריפו).

הסודות מוגדרים ב-GitHub → Settings → Secrets → Actions:
`CRON_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.

הרצה ידנית: Actions → health-check → **Run workflow**. או דרך ה-API:
`POST /repos/<owner>/<repo>/actions/workflows/health-check.yml/dispatches`.

> הערה: תזמון של GitHub Actions הוא "מאמץ מיטבי" — לפעמים יש עיכוב של כמה דקות
> בשעות עומס. לניטור uptime קפדני יותר אפשר להוסיף גם
> [UptimeRobot](https://uptimerobot.com) מול אותה כתובת.

## בדיקה ידנית
```
curl "https://the-way-app-two.vercel.app/api/cron/health-check?secret=<CRON_SECRET>"
```
מחזיר JSON עם הסטטוס של כל בדיקה.
