import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "הצהרת נגישות | THE WAY",
  description: "הצהרת נגישות עבור אפליקציית THE WAY",
};

const AUDIT_DATE = "07/07/2026";
const STATEMENT_UPDATED = "07/07/2026";

export default function AccessibilityStatementPage() {
  return (
    <div className="min-h-screen bg-[#0c0f0f] text-[#e2e2e2]" dir="rtl">
      <main id="main-content" className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="mb-8 text-3xl font-black text-white">הצהרת נגישות</h1>

        <section className="space-y-4 leading-relaxed text-[#c4c9ac]">
          <p>
            אנו ב-THE WAY מחויבים להנגיש את האפליקציה לאנשים עם מוגבלויות, בהתאם
            לתקן הישראלי <strong className="text-white">IS 5568</strong>, המעוגן בהנחיות
            הנגישות הבינלאומיות <strong className="text-white">WCAG 2.0</strong> ברמה AA,
            ובהתאם לחוק שוויון זכויות לאנשים עם מוגבלות, התשנ&quot;ח-1998 ותקנותיו.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="mb-3 text-xl font-bold text-white">אמצעי נגישות באפליקציה</h2>
          <ul className="list-inside list-disc space-y-2 leading-relaxed text-[#c4c9ac]">
            <li>תמיכה מלאה בכיווניות מימין לשמאל (RTL) ובשפה העברית</li>
            <li>ניגודיות צבעים העומדת ביחס של 4.5:1 לפחות בטקסטים</li>
            <li>תוויות טופס מלוות בתיאור ברור, כולל הודעות שגיאה בעברית</li>
            <li>מבנה כותרות היררכי וברור לצורך ניווט בעזרת קוראי מסך</li>
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="mb-3 text-xl font-bold text-white">מגבלות נגישות ידועות</h2>
          <p className="leading-relaxed text-[#c4c9ac]">
            אנו ממשיכים לעבוד על שיפור הנגישות באופן שוטף. בשלב זה ידוע לנו כי חלק
            מהתוכן הנטען באופן דינמי (כגון גרפים ואנימציות) לא נבדק באופן מלא מול
            קוראי מסך. אנו פועלים לתיקון הליקויים הידועים בהקדם.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="mb-3 text-xl font-bold text-white">פנייה בנושא נגישות</h2>
          <p className="leading-relaxed text-[#c4c9ac]">
            נתקלתם בקושי בנגישות האפליקציה? נשמח שתפנו אלינו ונטפל בפנייה בהקדם.
          </p>
          <p className="mt-2 leading-relaxed text-[#c4c9ac]">
            דוא&quot;ל: <a href="mailto:accessibility@theway.app" className="text-[#c3f400] hover:underline">accessibility@theway.app</a>
          </p>
        </section>

        <section className="mt-10 space-y-1 text-sm text-[#8e9379]">
          <p>תאריך ביקורת הנגישות האחרונה: {AUDIT_DATE}</p>
          <p>תאריך עדכון הצהרה זו: {STATEMENT_UPDATED}</p>
        </section>
      </main>
    </div>
  );
}
