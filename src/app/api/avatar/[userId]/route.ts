import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db, { initDb } from "@/lib/db";
import { resolveCoachId } from "@/lib/chat-group";

/**
 * Avatars are uploaded to a public Vercel Blob URL (see src/lib/blob-storage.ts) —
 * that part is unchanged. What changes here: the client never sees that blob URL.
 * It only ever sees /api/avatar/:userId, which checks the viewer is in the same
 * coach's roster before fetching and streaming the real image server-side. A QA
 * pass found the raw blob URL exposed directly in a trainee's <img> tag with no
 * auth check at all — this route is what every avatar_url the client receives
 * now points to instead.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const viewer = await getSessionUser();
  if (!viewer) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const { userId } = await params;
  await initDb();

  const targetRes = await db.execute({
    sql: "SELECT id, role, coach_id, avatar_url FROM users WHERE id = ?",
    args: [userId],
  });
  const target = targetRes.rows[0] as unknown as
    | { id: string; role: string; coach_id: string | null; avatar_url: string | null }
    | undefined;
  if (!target || !target.avatar_url) return NextResponse.json({ error: "אין תמונה" }, { status: 404 });

  const viewerCoachId = resolveCoachId(viewer as Parameters<typeof resolveCoachId>[0]);
  const targetCoachId = resolveCoachId(target);
  const allowed = viewer.id === target.id || (viewerCoachId !== null && viewerCoachId === targetCoachId);
  if (!allowed) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const blobRes = await fetch(target.avatar_url);
  if (!blobRes.ok || !blobRes.body) return NextResponse.json({ error: "התמונה לא נמצאה" }, { status: 404 });

  return new NextResponse(blobRes.body, {
    headers: {
      "Content-Type": blobRes.headers.get("content-type") ?? "image/jpeg",
      "Cache-Control": "private, max-age=300",
    },
  });
}
