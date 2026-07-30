import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db, { initDb } from "@/lib/db";
import { getTraineeImpact, deleteTraineeCascade } from "@/lib/trainee-deletion";
import { logAuditEvent } from "@/lib/audit-log";

/**
 * A single trainee, from their own coach's side: what deleting them would cost,
 * switching their account off, and deleting them for good.
 *
 * Every method here resolves the trainee through the same guard: they must exist,
 * be role 'client', and belong to THIS coach. A coach can never touch another
 * coach's trainee, and can never touch a coach — including themselves.
 */
interface ResolvedTrainee {
  coachId: string;
  id: string;
  name: string;
  active: boolean;
}

type Resolution =
  | { ok: false; response: NextResponse }
  | { ok: true; trainee: ResolvedTrainee };

function deny(message: string, status: number): Resolution {
  return { ok: false, response: NextResponse.json({ error: message }, { status }) };
}

async function resolveTrainee(id: string): Promise<Resolution> {
  const coach = await getSessionUser();
  if (!coach || coach.role !== "coach") return deny("גישה נדחתה", 403);

  await initDb();
  const res = await db.execute({
    sql: "SELECT id, name, role, coach_id, active FROM users WHERE id = ?",
    args: [id],
  });
  const row = res.rows[0];
  if (!row) return deny("המתאמן לא נמצא", 404);

  // A coach is never deletable through this route. Without this, the only account
  // that can reach the coach dashboard could delete itself.
  if (String(row.role) !== "client") return deny("אפשר למחוק רק מתאמנים", 400);

  // Someone else's trainee is reported as missing, not as forbidden: a 403 would
  // confirm that the id exists.
  if (String(row.coach_id ?? "") !== coach.id) return deny("המתאמן לא נמצא", 404);

  return {
    ok: true,
    trainee: {
      coachId: coach.id,
      id: String(row.id),
      name: String(row.name),
      active: Number(row.active ?? 1) === 1,
    },
  };
}

/** What is actually stored for this trainee — the numbers shown before deleting. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resolved = await resolveTrainee(id);
  if (!resolved.ok) return resolved.response;

  const impact = await getTraineeImpact(resolved.trainee.id);
  return NextResponse.json({
    id: resolved.trainee.id,
    name: resolved.trainee.name,
    active: resolved.trainee.active,
    impact,
  });
}

/**
 * Switches the account on or off. This is the reversible answer to "he stopped
 * training": login is refused and any open session dies on the next request,
 * but not one row of history is touched.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resolved = await resolveTrainee(id);
  if (!resolved.ok) return resolved.response;

  const body = await req.json().catch(() => null);
  if (!body || typeof body.active !== "boolean") {
    return NextResponse.json({ error: "צריך לציין אם החשבון פעיל" }, { status: 400 });
  }

  await db.execute({
    sql: "UPDATE users SET active = ? WHERE id = ?",
    args: [body.active ? 1 : 0, resolved.trainee.id],
  });

  await logAuditEvent(body.active ? "trainee_enabled" : "trainee_disabled", {
    userId: resolved.trainee.coachId,
    metadata: `${resolved.trainee.id} ${resolved.trainee.name}`,
  });

  return NextResponse.json({ ok: true, active: body.active });
}

/**
 * Deletes the trainee and all of their data. Irreversible.
 *
 * The typed name is checked here and not only in the UI: the confirmation is the
 * actual guard, and a guard that lives only in the browser is not a guard.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resolved = await resolveTrainee(id);
  if (!resolved.ok) return resolved.response;

  const body = await req.json().catch(() => null);
  const confirmName = String(body?.confirmName ?? "").trim();

  if (confirmName !== resolved.trainee.name.trim()) {
    return NextResponse.json(
      { error: "השם שהוקלד לא תואם. הקלד את שם המתאמן במדויק." },
      { status: 400 }
    );
  }

  // Recorded before the delete, because afterwards the rows it describes are gone.
  const impact = await getTraineeImpact(resolved.trainee.id);

  try {
    await deleteTraineeCascade(resolved.trainee.id);
  } catch (error) {
    console.error("[clients/:id] delete failed", error);
    return NextResponse.json(
      { error: "המחיקה נכשלה ולא בוצעה. שום דבר לא נמחק — נסה שוב." },
      { status: 500 }
    );
  }

  await logAuditEvent("trainee_deleted", {
    userId: resolved.trainee.coachId,
    metadata: `${resolved.trainee.id} ${resolved.trainee.name} ${JSON.stringify(impact)}`,
  });

  return NextResponse.json({ ok: true });
}
