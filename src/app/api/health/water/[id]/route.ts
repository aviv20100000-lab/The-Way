import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    // Verify the water log belongs to the user
    const logResult = await db.execute({
      sql: `SELECT amount_ml FROM water_logs WHERE id = ? AND user_id = ?`,
      args: [id, user.id],
    });

    if (!logResult.rows.length) {
      return NextResponse.json(
        { error: 'Water log not found' },
        { status: 404 }
      );
    }

    const amount_ml = logResult.rows[0].amount_ml;

    // Delete the log
    await db.execute({
      sql: `DELETE FROM water_logs WHERE id = ? AND user_id = ?`,
      args: [id, user.id],
    });

    return NextResponse.json({
      success: true,
      amount_ml,
    });
  } catch (error) {
    console.error('Error deleting water log:', error);
    return NextResponse.json(
      { error: 'Failed to delete water log' },
      { status: 500 }
    );
  }
}
