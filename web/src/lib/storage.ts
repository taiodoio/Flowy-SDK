import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'sessions');

console.log(`[STORAGE] DATA_DIR initialized at: ${DATA_DIR} (CWD: ${process.cwd()})`);

export interface SessionData {
    id: string;
    uploadedAt: string;
    isApproved: boolean;
    tags: string[];
    events: any[];
    deviceInfo: any;
    report?: any;
}

// Ensure data directory exists
async function ensureDir() {
    try {
        await fs.access(DATA_DIR);
    } catch {
        await fs.mkdir(DATA_DIR, { recursive: true });
    }
}

export async function saveSession(session: SessionData): Promise<void> {
    await ensureDir();
    const filePath = path.join(DATA_DIR, `${session.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(session, null, 2));
}

export async function getSession(id: string): Promise<SessionData | null> {
    await ensureDir();
    const filePath = path.join(DATA_DIR, `${id}.json`);
    console.log(`[STORAGE] Attempting getSession: ${id}, Path: ${filePath}`);
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data);
    } catch (error: any) {
        console.error(`[STORAGE] Failed to read session file: ${filePath}`, error);

        // Debug: List files in the directory to see what IS there
        let files: string[] = [];
        try {
            files = await fs.readdir(DATA_DIR);
        } catch (dirErr) {
            files = ["<Failed to list dir>"];
        }

        throw new Error(`FileReadError: ${error.code} at ${filePath}. \nAvailable files in ${DATA_DIR}: [${files.join(', ')}]`);
    }
}

export function getSessionPath(id: string) {
    return path.join(DATA_DIR, `${id}.json`);
}

export async function getAllSessions(): Promise<SessionData[]> {
    await ensureDir();
    try {
        const files = await fs.readdir(DATA_DIR);
        const sessions: SessionData[] = [];

        for (const file of files) {
            if (file.endsWith('.json')) {
                const data = await fs.readFile(path.join(DATA_DIR, file), 'utf-8');
                try {
                    const session = JSON.parse(data);
                    // Return minimal data for list view to save bandwidth could be an optimization later
                    sessions.push(session);
                } catch (e) {
                    console.error(`Error parsing session file ${file}`, e);
                }
            }
        }

        // Sort by upload date desc
        return sessions.sort((a, b) =>
            new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
        );
    } catch (error) {
        return [];
    }
}

export async function updateSessionMetadata(id: string, updates: Partial<SessionData>): Promise<SessionData | null> {
    const session = await getSession(id);
    if (!session) return null;

    const updatedSession = { ...session, ...updates };
    await saveSession(updatedSession);
    return updatedSession;
}

export async function deleteSession(id: string): Promise<boolean> {
    await ensureDir();
    const filePath = path.join(DATA_DIR, `${id}.json`);
    try {
        await fs.unlink(filePath);
        return true;
    } catch (error: any) {
        if (error.code === 'ENOENT') return false;
        console.error(`[STORAGE] Failed to delete session file: ${filePath}`, error);
        throw error;
    }
}
