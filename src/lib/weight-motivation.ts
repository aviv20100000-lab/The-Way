export function getWeightMotivationMessage(params: {
  startingWeight: number | null;
  currentWeight: number | null;
  targetWeight: number | null;
}): string {
  const { startingWeight, currentWeight, targetWeight } = params;

  if (currentWeight === null || startingWeight === null) {
    return "בוא נתחיל לעקוב אחרי המסע שלך! כל שקילה סופרת 💪";
  }

  if (targetWeight === null) {
    const diff = startingWeight - currentWeight;

    if (diff > 0.5) {
      return `ירדת כבר ${Math.abs(diff).toFixed(1)} ק"ג מההתחלה! ממשיכים ככה 🔥`;
    }

    if (diff < -0.5) {
      return `עלית ${Math.abs(diff).toFixed(1)} ק"ג מההתחלה — בונה כוח ומסה, ממשיך קדימה! 💪`;
    }

    return "אתה יציב — התמדה היא המפתח להצלחה 💪";
  }

  const totalNeeded = startingWeight - targetWeight;
  const achieved = startingWeight - currentWeight;
  const progressPct = totalNeeded === 0 ? 100 : (achieved / totalNeeded) * 100;

  if (progressPct >= 100) {
    return "🎉 הגעת ליעד! זה בול, כל הכבוד!";
  }
  if (progressPct >= 75) {
    return "כמעט שם! עוד קצת ואתה בפנים 🔥";
  }
  if (progressPct >= 50) {
    return "חצי דרך ומעלה — אתה ממש בקצב טוב 💪";
  }
  if (progressPct >= 25) {
    return "ההתקדמות מתחילה להיראות — תמשיך בדיוק ככה!";
  }
  if (progressPct > 0) {
    return "כל ק\"ג שזז הוא ניצחון — ההתחלה הכי קשה, ואתה כבר בדרך";
  }
  return "כל מסע מתחיל בצעד אחד — היום זמן טוב להתחיל לזוז לכיוון הנכון 💪";
}
