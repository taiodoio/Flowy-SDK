import { NextResponse } from 'next/server';
import { getSession, updateSessionMetadata } from '@/lib/storage';
import { normalizeScreenName } from '@/lib/wireframe-matcher';
import type { WireframeFile, ViewNode } from '@/lib/types';

export const dynamic = 'force-dynamic';

function isViewNode(value: unknown): value is ViewNode {
  return !!value && typeof value === 'object' && 'class_name' in value && 'frame' in value;
}

function mergeWireframes(
  existing: WireframeFile[],
  incoming: WireframeFile[]
): WireframeFile[] {
  const map = new Map<string, WireframeFile>();
  for (const w of existing) map.set(w.screenName, w);
  for (const w of incoming) {
    const prev = map.get(w.screenName);
    if (!prev || w.capturedAt >= prev.capturedAt) {
      map.set(w.screenName, w);
    }
  }
  return Array.from(map.values());
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await getSession(id);
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const files = formData.getAll('wireframes') as File[];
  const parsed: WireframeFile[] = [];

  for (const file of files) {
    // Expected filename: flowy_<ScreenName>_<timestamp>.json
    const match = file.name.match(/^flowy_(.+)_(\d+(?:\.\d+)?)\.json$/i);
    const rawScreenName = match ? match[1] : file.name.replace(/\.json$/i, '');
    const capturedAt = match ? parseFloat(match[2]) : Date.now() / 1000;

    let text: string;
    try {
      text = await file.text();
    } catch {
      continue;
    }

    let rootNode: ViewNode;
    let screenshotBase64: string | undefined;
    try {
      const parsedJson = JSON.parse(text);
      if (isViewNode(parsedJson)) {
        rootNode = parsedJson;
      } else if (parsedJson && isViewNode(parsedJson.tree)) {
        rootNode = parsedJson.tree;
        screenshotBase64 = parsedJson.screenshot_base64 ?? parsedJson.screenshotBase64 ?? undefined;
      } else {
        continue;
      }
    } catch {
      continue;
    }

    parsed.push({
      screenName: normalizeScreenName(rawScreenName),
      rawFileName: file.name,
      capturedAt,
      rootNode,
      screenshotBase64,
    });
  }

  const merged = mergeWireframes(session.wireframes ?? [], parsed);
  await updateSessionMetadata(id, { wireframes: merged });

  return NextResponse.json({ added: parsed.length, total: merged.length });
}
