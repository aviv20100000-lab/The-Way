import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await db.execute({
      sql: `SELECT current_streak, last_completed_date, best_streak
            FROM water_streak
            WHERE user_id = ?`,
      args: [session.userId],
    });

    const streak = result.rows[0] || {
      current_streak: 0,
      last_completed_date: null,
      best_streak: 0,
    };

    // Check if user reached goal today
    const today = new Date().toISOString().split('T')[0];
    const waterResult = await db.execute({
      sql: `SELECT SUM(amount_ml) as total FROM water_logs
            WHERE user_id = ? AND date(logged_at) = ?`,
      args: [session.userId, today],
    });

    const waterTotal = (waterResult.rows[0]?.total as number) || 0;

    const goalResult = await db.execute({
      sql: `SELECT daily_water_ml FROM goals WHERE user_id = ?`,
      args: [session.userId],
    });

    const dailyGoal = (goalResult.rows[0]?.daily_water_ml as number) || 2000;
    const goal_reached_today = waterTotal >= dailyGoal;

    return NextResponse.json({
      current_streak: streak.current_streak,
      last_completed_date: streak.last_completed_date,
      best_streak: streak.best_streak,
      goal_reached_today,
    });
  } catch (error) {
    console.error('Error fetching streak:', error);
    return NextResponse.json(
      { error: 'Failed to fetch streak' },
      { status: 500 }
    );
  }
}
