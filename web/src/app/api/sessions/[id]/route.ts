import { NextResponse } from "next/server";
import { getSession, getSessionPath, updateSessionMetadata, deleteSession } from "@/lib/storage";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    console.log(`[API_GET] Fetching ID: ${id}`);
    try {
        const session = await getSession(id);
        if (!session) {
            console.warn(`[API_GET] Session not found for ID: ${id}`);
            return NextResponse.json({
                error: "Session not found",
                debug: {
                    attemptedId: id,
                    attemptedPath: getSessionPath(id),
                    cwd: process.cwd(),
                }
            }, { status: 404 });
        }
        return NextResponse.json(session);
    } catch (error: any) {
        console.error(`[API_GET] Error`, error);
        return NextResponse.json({
            error: error.message || "Failed to fetch session",
            debug: {
                attemptedId: id,
                attemptedPath: getSessionPath(id),
                rawError: error.toString()
            }
        }, { status: 500 });
    }
}

export const dynamic = 'force-dynamic';

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        const body = await req.json();
        console.log(`[PATCH] Updating session ${id}. Keys: ${Object.keys(body).join(', ')}`);

        const updated = await updateSessionMetadata(id, body);

        if (!updated) {
            console.error(`[PATCH] Session ${id} not found for update.`);
            return NextResponse.json({ error: "Session not found" }, { status: 404 });
        }

        console.log(`[PATCH] Session ${id} updated successfully.`);
        return NextResponse.json(updated);
    } catch (error) {
        return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        const deleted = await deleteSession(id);
        if (!deleted) {
            return NextResponse.json({ error: "Session not found" }, { status: 404 });
        }
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Delete error:", error);
        return NextResponse.json({ error: "Failed to delete session" }, { status: 500 });
    }
}
