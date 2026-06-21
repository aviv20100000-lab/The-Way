import { NextResponse } from "next/server";
import { sendTelegramAlert } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function GET() {
  await sendTelegramAlert(
    `🚨 <b>THE WAY</b> — זוהתה תקלה בפרודקשן!\n\n❌ <b>csrf-middleware</b>: POST status 500 (expect 401)\n\n— middleware crashed (Edge Runtime bug)`
  );
  return NextResponse.json(
    {
      status: "fail",
      checks: [
        { name: "env", ok: true, detail: "all set" },
        { name: "db", ok: true, detail: "users=2 subs=7" },
        { name: "csrf-token", ok: true, detail: "200 + token" },
        { name: "csrf-middleware", ok: false, detail: "POST status 500 (expect 401)" },
      ],
      checkedAt: new Date().toISOString(),
    },
    { status: 503 }
  );
}

export async function POST() {
  return GET();
}
