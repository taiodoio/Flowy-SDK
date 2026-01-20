import { NextResponse } from "next/server";
import { saveSession, getAllSessions } from "@/lib/storage";

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const sessions = await getAllSessions();
        return NextResponse.json(sessions);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();

        // Ensure minimal fields
        if (!body.id || !body.events) {
            return NextResponse.json({ error: "Invalid session data" }, { status: 400 });
        }

        const session = {
            ...body,
            uploadedAt: body.uploadedAt || new Date().toISOString(),
            isApproved: body.isApproved || false,
            tags: body.tags || [],
        };

        await saveSession(session);
        return NextResponse.json({ success: true, session });
    } catch (error) {
        console.error("Save Session Error:", error);
        return NextResponse.json({ error: "Failed to save session" }, { status: 500 });
    }
}
