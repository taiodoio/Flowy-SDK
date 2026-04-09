import { GoogleGenerativeAI, type Part } from "@google/generative-ai";
import { NextResponse } from "next/server";

// Allow up to 90 s for multimodal Gemini calls (free tier can be slow)
export const maxDuration = 90;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTimestamp(ts: number): string {
  const d = new Date(ts > 1e10 ? ts : ts * 1000);
  return d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/** Strip trailing sequence number and underscores for a readable label */
function humanizeWireframeName(raw: string): string {
  if (!raw) return "Schermata";
  return raw.replace(/_\d+$/, "").replace(/_/g, " ").trim() || "Schermata";
}

/** Find the 1-based index of the most relevant wireframe for an event. */
function findShotIndex(event: any, wireframes: any[], wfMap: Map<any, number>): number | null {
  const ts: number = event.timestamp || event.captured_at || 0;
  if (!ts) return null;

  const action = ((event.action || event.type || "") as string).toUpperCase();
  const prefersAfter = action === "TAP" || action === "SECURE_TAP" || action === "SCROLL";

  const cat = (w: any) => w.capturedAt || w.captured_at || 0;
  const withTime = wireframes.filter((w) => cat(w) > 0);

  const closest = (arr: any[], reducer: (a: any, b: any) => any) =>
    arr.length ? reducer : null;

  if (prefersAfter) {
    const tight = withTime.filter((w) => cat(w) > ts && cat(w) - ts <= 5);
    if (tight.length) return wfMap.get(tight.reduce((a, b) => (cat(a) < cat(b) ? a : b))) ?? null;

    const full = withTime.filter((w) => cat(w) > ts && cat(w) - ts <= 10);
    if (full.length) return wfMap.get(full.reduce((a, b) => (cat(a) < cat(b) ? a : b))) ?? null;
  }

  const before = withTime.filter((w) => cat(w) <= ts && ts - cat(w) <= 10);
  if (before.length) return wfMap.get(before.reduce((a, b) => (cat(a) > cat(b) ? a : b))) ?? null;

  const after = withTime.filter((w) => cat(w) > ts && cat(w) - ts <= 10);
  if (after.length) return wfMap.get(after.reduce((a, b) => (cat(a) < cat(b) ? a : b))) ?? null;

  if (withTime.length)
    return wfMap.get(withTime.reduce((a, b) => (Math.abs(cat(a) - ts) < Math.abs(cat(b) - ts) ? a : b))) ?? null;

  return null;
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const session = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "Gemini API Key missing" }, { status: 500 });
    }

    // ── 1. Pre-process session ────────────────────────────────────────────────

    const wireframes: any[] = [...(session.wireframes || [])].sort(
      (a, b) => (a.capturedAt || a.captured_at || 0) - (b.capturedAt || b.captured_at || 0)
    );

    // 1-based index map for prompt references (S1, S2, …)
    const wfMap = new Map<any, number>();
    wireframes.forEach((wf, i) => wfMap.set(wf, i + 1));

    const events: any[] = session.events || [];

    // Compact event timeline — strip large fields, add screenshot reference
    const timeline = events.map((e: any, idx: number) => {
      const shotIdx = findShotIndex(e, wireframes, wfMap);
      const ocr = (e.ocr_text || "").trim();
      return {
        "#": idx + 1,
        t: formatTimestamp(e.timestamp || 0),
        action: e.action || e.type,
        text: ocr.length > 2 ? ocr : undefined,
        screen_raw: e.screen_name || e.screenName || undefined,
        shot: shotIdx ? `S${shotIdx}` : undefined,
      };
    });

    // ── 2. Select screenshots (deduplicated, max 5) ─────────────────────────
    // Send at most MAX_SCREENSHOTS visually distinct frames to keep token count
    // well within the free-tier per-minute limit (~4000 input tokens).
    // Dedup by base64 prefix (first 40 chars ≈ same image if captured in same second).
    const MAX_SCREENSHOTS = 5;
    const allWithScreenshot = wireframes.filter((wf) => wf.screenshotBase64 || wf.screenshot_base64);
    const seen = new Set<string>();
    const screenshots: any[] = [];
    for (const wf of allWithScreenshot) {
      const b64 = wf.screenshotBase64 || wf.screenshot_base64 || "";
      const key = b64.substring(0, 40); // same first 40 chars → visually identical
      if (!seen.has(key)) {
        seen.add(key);
        screenshots.push(wf);
      }
      if (screenshots.length >= MAX_SCREENSHOTS) break;
    }
    const hasScreenshots = screenshots.length > 0;

    // Rebuild wfMap to reference only the deduplicated set
    const shotMap = new Map<any, number>();
    screenshots.forEach((wf, i) => shotMap.set(wf, i + 1));

    // Remap timeline shot references to the deduplicated set
    const timelineWithShots = timeline.map((row) => {
      if (!row.shot) return row;
      // Find original wireframe that had this index in the full wfMap
      const origIdx = parseInt((row.shot as string).replace("S", ""), 10) - 1;
      const origWf = wireframes[origIdx];
      const newIdx = origWf ? shotMap.get(origWf) : undefined;
      return { ...row, shot: newIdx ? `S${newIdx}` : undefined };
    });

    // ── 3. Resolve models ────────────────────────────────────────────────────
    // Prefer gemini-2.5-flash (available on free tier, supports multimodal + JSON mode).
    // gemini-1.5-* has been removed from v1beta; gemini-2.0-flash can hit RPM limits.
    const HARDCODED_FIRST = ["gemini-2.5-flash", "gemini-2.0-flash"];

    let availableModels: string[] = [];
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`
      );
      const data = await res.json();
      if (data.models) availableModels = data.models.map((m: any) => m.name as string);
    } catch {}

    const modelsToTry: string[] = [...HARDCODED_FIRST];
    // Append any API-listed models that support generateContent and aren't already listed
    const extraPatterns = ["gemini-2.5-", "gemini-2.0-flash"];
    for (const p of extraPatterns) {
      for (const m of availableModels) {
        const cleaned = m.replace("models/", "");
        if (!modelsToTry.includes(cleaned) && cleaned.startsWith(p)) modelsToTry.push(cleaned);
      }
    }

    console.log("[ANALYZE] Models to try:", modelsToTry);

    // ── 4. Build multimodal prompt ────────────────────────────────────────────

    const screenshotSummary = screenshots
      .map((wf, i) => `  S${i + 1}: "${humanizeWireframeName(wf.screenName || wf.screen_name)}" @ ${formatTimestamp(wf.capturedAt || wf.captured_at || 0)}`)
      .join("\n");

    const systemText = `Sei un Senior QA Engineer e CX Analyst specializzato in app mobile iOS.
Hai ricevuto una sessione di test registrata dall'SDK Flowy, che include il log degli eventi E screenshot reali delle schermate.

${hasScreenshots ? `## Screenshot disponibili\nDurante la sessione sono stati catturati ${screenshots.length} screenshot:\n${screenshotSummary}\n\nUSA GLI SCREENSHOT PER:\n- Identificare il nome reale di ogni schermata da ciò che vedi visivamente (NON usare i nomi tecnici delle classi Swift)\n- Correggere il testo OCR che potrebbe essere distorto o incompleto\n- Descrivere le azioni dell'utente in modo contextuale e naturale (es. "ha toccato il pulsante 'Aggiungi al carrello'" invece di "TAP a coordinate 195,720")\n- Rilevare schermate non coperte dagli eventi (es. schermata di destinazione dopo una navigazione)\n- Ogni evento ha un campo "shot" (es. S3) che indica quale screenshot corrisponde a quel momento` : `## Nessuno screenshot disponibile\nAnalizza solo il log degli eventi e il testo OCR.`}

## Regole per i nomi delle schermate
- MAI usare nomi tecnici come "ModifiedContent<...>", "_UIViewController", "UIHostingController"
- SEMPRE usare il nome visibile/contestuale: guarda lo screenshot e descrivi la schermata in italiano
- Classi comuni: UINavigationController → "Stack di navigazione", UITabBarController → "Tab principale", PresentationHostingController → "Foglio modale", _UICursorAccessoryViewController → [SISTEMA - IGNORA]

## Affidabilità del testo OCR
- L'OCR può contenere caratteri errati, parole storpiate o testo di sistema irrilevante
- SE hai lo screenshot: usa ciò che vedi per determinare il testo reale
- SE l'OCR contiene solo "Tap", "li", "O" o caratteri casuali → considera rumore, non descriverlo come azione significativa
- Per testo davvero illeggibile usa "[elemento non identificato]"

## Lingua di output
Tutto il testo di analisi, descrizioni e step DEVE essere in ITALIANO naturale e comprensibile.
Solo i campi tecnici (action type, YAML, status enum) restano in inglese.`;

    const taskText = `## Log degli eventi
${JSON.stringify(timelineWithShots, null, 2)}

## Compito
Produci un'analisi forense completa della sessione. Restituisci SOLO un oggetto JSON valido (nessun fence markdown, nessun testo extra) con questa struttura esatta:

{
  "header": {
    "title": "Titolo conciso che descrive il flusso principale e l'esito",
    "duration": "es. ~45 secondi",
    "main_screens": "Flusso di schermate in italiano: es. Dashboard → Lista Prodotti → Dettaglio → Conferma",
    "deduced_section": "Sezione/funzionalità dell'app testata, dedotta dal contenuto visivo",
    "status_text": "SUCCESS | FAILED"
  },
  "executive_summary": {
    "worked": ["Cose che hanno funzionato, in italiano, massimo 4 punti"],
    "issues": ["Problemi riscontrati, in italiano, massimo 4 punti"]
  },
  "reconstructed_flow": [
    {
      "section": "Nome naturale della fase in italiano (es. 'Navigazione Lista Alimenti')",
      "status": "SUCCESS | ERROR | NORMAL",
      "summary": "Paragrafo narrativo di ciò che l'utente ha fatto, in italiano. Fai riferimento a ciò che era visibile sullo schermo.",
      "steps": [
        {
          "timestamp": "HH:MM:SS",
          "description": "Descrizione naturale in italiano. Esempio: 'L'utente ha scorso la lista e selezionato Penne Rigate Protein+'",
          "type": "NORMAL | SUCCESS | ERROR | FEEDBACK"
        }
      ]
    }
  ],
  "error_analysis": [
    {
      "timestamp": "HH:MM:SS",
      "type": "WARNING | PERSISTENT_WARNING | FUNCTIONAL_ERROR",
      "ocr_text": "Testo rilevato sullo schermo",
      "analysis": "Analisi in italiano"
    }
  ],
  "feedback_analysis": [],
  "success_analysis": [
    {
      "timestamp": "HH:MM:SS",
      "action": "Cosa è andato a buon fine, in italiano",
      "ocr_text": "Testo di conferma visibile",
      "details": "Descrizione in italiano"
    }
  ],
  "ux_analysis": [
    {
      "heuristic": "Nome dell'euristica Nielsen",
      "observation": "Osservazione in italiano",
      "status": "OK | IMPROVE | CRITICAL",
      "recommendation": "Raccomandazione in italiano"
    }
  ],
  "technical_notes": "Punti markdown in italiano con osservazioni tecniche",
  "maestro_yaml": "Script YAML Maestro completo per riprodurre questo flusso"
}

## Regole critiche

1. **STATUS**: Se c'è almeno un FUNCTIONAL_ERROR → status_text = "FAILED". Solo avvisi → "SUCCESS (con avvertenze)". Nessun problema → "SUCCESS".

2. **NOMI SCHERMATE**: Guarda gli screenshot! Usa nomi visivi in italiano (es. "Schermata Timer", "Lista Alimenti", "Modale Elimina Account"). MAI rawclass names.

3. **AGGREGAZIONE FLOW**: Massimo 5 sezioni. Unisci azioni consecutive correlate. Crea una nuova sezione SOLO per: cambio di intent principale, USER_FEEDBACK, errori critici, completamenti (SUCCESS).

4. **DESCRIZIONI STEP** — questa è la regola più importante:
   - SBAGLIATO: "Tap a 41,485 su ModifiedContent<NavigationColumn...>"
   - SBAGLIATO: "TAP: Rusiikni Iriid U Mlll 41££V"
   - CORRETTO: "L'utente ha selezionato 'Penne Rigate Protein+' nella lista alimenti"
   - CORRETTO: "L'utente ha premuto il pulsante Indietro per tornare alla lista"
   - CORRETTO: "L'utente ha scorso verso il basso nella sezione 'Impostazioni'"
   Usa OCR + screenshot per ricostruire l'azione reale. Se non puoi determinare l'elemento, descrivi la direzione dell'azione (es. "ha toccato un elemento nella parte bassa dello schermo").

5. **DEDUPLICAZIONE**: Stesso testo di warning su più eventi → un solo PERSISTENT_WARNING.

6. **SCROLL**: Un evento SCROLL non è un tap. Descrivilo come "L'utente ha scorso [direzione] nella schermata [nome]".

7. **MAESTRO**: YAML reale ed eseguibile. Copri tutto il flusso dall'avvio dell'app allo stato finale.`;

    // Assemble multimodal parts
    const parts: Part[] = [{ text: systemText }];

    if (hasScreenshots) {
      for (let i = 0; i < screenshots.length; i++) {
        const wf = screenshots[i];
        const name = humanizeWireframeName(wf.screenName || wf.screen_name || "");
        const time = formatTimestamp(wf.capturedAt || wf.captured_at || 0);
        parts.push({ text: `\nS${i + 1} — "${name}" @ ${time}:` });
        parts.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: wf.screenshotBase64 || wf.screenshot_base64,
          },
        });
      }
    }

    parts.push({ text: taskText });

    // ── 5. Call model with fallback ───────────────────────────────────────────

    /** Extract seconds from a Gemini 429 message ("retry in 58s" / "retryDelay:58s") */
    function parseRetrySeconds(msg: string): number | null {
      const m = msg.match(/(\d+)(?:\.\d+)?s[\s"}\]]/) || msg.match(/retry[^\d]*(\d+)/);
      return m ? parseInt(m[1], 10) : null;
    }

    const errors: string[] = [];

    for (const modelName of modelsToTry) {
      try {
        console.log(`[ANALYZE] Trying ${modelName} (${hasScreenshots ? "multimodal" : "text-only"})`);
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: { responseMimeType: "application/json" },
        });

        const result = await model.generateContent({
          contents: [{ role: "user", parts }],
        });

        let text = result.response.text();
        text = text.replace(/```json/gi, "").replace(/```/g, "").trim();
        const first = text.indexOf("{");
        const last = text.lastIndexOf("}");
        if (first !== -1 && last !== -1) text = text.substring(first, last + 1);

        const json = JSON.parse(text);
        console.log(`[ANALYZE] Success with ${modelName}`);
        return NextResponse.json(json);
      } catch (error: any) {
        const msg: string = error.message || "";
        console.warn(`[ANALYZE] Failed with ${modelName}: ${msg.substring(0, 120)}`);
        errors.push(`${modelName}: ${msg.substring(0, 200)}`);

        // 429 quota exhausted — all models share the same project quota so
        // there's no point trying the rest. Return a clear actionable message.
        const msgLow = msg.toLowerCase();
        if (msgLow.includes("429") || msgLow.includes("too many requests") || msgLow.includes("quota")) {
          const retryIn = parseRetrySeconds(msg);
          const retryHint = retryIn
            ? ` Riprova tra ${retryIn} secondi.`
            : " Riprova tra qualche minuto.";
          return NextResponse.json(
            {
              error: `Quota API Gemini esaurita.${retryHint} Se il problema persiste, verifica il piano su https://ai.dev/rate-limit.`,
              quota_exhausted: true,
              retry_in_seconds: retryIn,
            },
            { status: 429 }
          );
        }

        // Vision error — strip images and continue with remaining models text-only
        if (msg.includes("image") || msg.includes("vision")) {
          console.warn("[ANALYZE] Vision error — retrying remaining models text-only");
          const systemPart = parts[0];
          const taskPart = parts[parts.length - 1];
          parts.length = 0;
          parts.push(systemPart, taskPart);
        }
      }
    }

    return NextResponse.json(
      { error: `All models failed. Details: ${JSON.stringify(errors)}` },
      { status: 500 }
    );
  } catch (error: any) {
    console.error("[ANALYZE] Fatal error:", error);
    return NextResponse.json({ error: `Analysis Failed: ${error.message || "Unknown Error"}` }, { status: 500 });
  }
}


