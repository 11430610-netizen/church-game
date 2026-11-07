import { NextRequest, NextResponse } from "next/server";
import { getSessionRecord, initDb, saveSessionRecord } from "@/lib/db";

initDb();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const sessionId = body?.sessionId;
    const payload = body?.payload;

    if (!sessionId || typeof payload !== "string") {
      return NextResponse.json({ error: "Missing sessionId or payload" }, { status: 400 });
    }

    await saveSessionRecord(sessionId, payload);
    return NextResponse.json({ ok: true, sessionId });
  } catch (error) {
    console.error("Save session error:", error);
    return NextResponse.json({ error: "Failed to save session" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const record = await getSessionRecord(sessionId);
    if (!record) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, session: record.payload });
  } catch (error) {
    console.error("Load session error:", error);
    return NextResponse.json({ error: "Failed to load session" }, { status: 500 });
  }
}
