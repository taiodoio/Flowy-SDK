import { NextResponse } from "next/server";

export const maxDuration = 120;

const OLLAMA_URL = "http://localhost:11434/api/chat";
const OLLAMA_MODEL = "gemma4:e4b";

function formatTimestamp(ts: number): string {
  const d = new Date(ts > 1e10 ? ts : ts * 1000);
  return d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function humanizeWireframeName(raw: string): string {
  if (!raw) return "Schermata";
  return raw.replace(/_\d+$/, "").replace(/_/g, " ").trim() || "Schermata";
}

function normalizeBase64Image(raw?: string): string {
  if (!raw) return "";
  return raw.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "").trim();
}

function findShotIndex(event: any, wireframes: any[], wfMap: Map<any, number>): number | null {
  const ts: number = event.timestamp || event.captured_at || 0;
  if (!ts) return null;

  const action = ((event.action || event.type || "") as string).toUpperCase();
  const prefersAfter = action === "TAP" || action === "SECURE_TAP" || action === "SCROLL";

  const cat = (w: any) => w.capturedAt || w.captured_at || 0;
  const withTime = wireframes.filter((w) => cat(w) > 0);

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

  if (withTime.length) {
    return wfMap.get(withTime.reduce((a, b) => (Math.abs(cat(a) - ts) < Math.abs(cat(b) - ts) ? a : b))) ?? null;
  }

  return null;
}

export async function POST(req: Request) {
  try {
    const session = await req.json();

    const wireframes: any[] = [...(session.wireframes || [])].sort(
      (a, b) => (a.capturedAt || a.captured_at || 0) - (b.capturedAt || b.captured_at || 0)
    );

    const wfMap = new Map<any, number>();
    wireframes.forEach((wf, i) => wfMap.set(wf, i + 1));

    const events: any[] = session.events || [];

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

    const MAX_SCREENSHOTS = 5;
    const allWithScreenshot = wireframes.filter((wf) => wf.screenshotBase64 || wf.screenshot_base64);
    const seen = new Set<string>();
    const screenshots: any[] = [];

    for (const wf of allWithScreenshot) {
      const b64 = normalizeBase64Image(wf.screenshotBase64 || wf.screenshot_base64 || "");
      if (!b64) continue;
      const key = b64.substring(0, 40);
      if (!seen.has(key)) {
        seen.add(key);
        screenshots.push(wf);
      }
      if (screenshots.length >= MAX_SCREENSHOTS) break;
    }

    const hasScreenshots = screenshots.length > 0;

    const shotMap = new Map<any, number>();
    screenshots.forEach((wf, i) => shotMap.set(wf, i + 1));

    const timelineWithShots = timeline.map((row) => {
      if (!row.shot) return row;
      const origIdx = parseInt((row.shot as string).replace("S", ""), 10) - 1;
      const origWf = wireframes[origIdx];
      const newIdx = origWf ? shotMap.get(origWf) : undefined;
      return { ...row, shot: newIdx ? `S${newIdx}` : undefined };
    });

    const screenshotSummary = screenshots
      .map(
        (wf, i) =>
          `  S${i + 1}: "${humanizeWireframeName(wf.screenName || wf.screen_name)}" @ ${formatTimestamp(wf.capturedAt || wf.captured_at || 0)}`
      )
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

    const images = screenshots
      .map((wf) => normalizeBase64Image(wf.screenshotBase64 || wf.screenshot_base64))
      .filter((img) => img.length > 0);

    const userText = hasScreenshots
      ? `Riferimenti screenshot disponibili: ${screenshots
          .map((wf, i) => `S${i + 1}="${humanizeWireframeName(wf.screenName || wf.screen_name || "")}"`)
          .join(", ")}\n\n${taskText}`
      : taskText;

    let ollamaResponse: Response;
    try {
      ollamaResponse = await fetch(OLLAMA_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          stream: false,
          format: "json",
          messages: [
            { role: "system", content: systemText },
            {
              role: "user",
              content: userText,
              images,
            },
          ],
        }),
      });
    } catch (error: any) {
      const message = String(error?.message || "").toLowerCase();
      if (message.includes("econnrefused") || message.includes("fetch failed") || message.includes("network")) {
        return NextResponse.json(
          {
            error: "Ollama non raggiungibile. Assicurati che sia in esecuzione su localhost:11434 e che il modello gemma4:e4b sia disponibile.",
          },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: `Errore chiamando Ollama: ${error?.message || "Unknown"}` }, { status: 500 });
    }

    const ollamaData = await ollamaResponse.json();

    if (!ollamaResponse.ok) {
      return NextResponse.json(
        { error: ollamaData?.error || `Ollama returned status ${ollamaResponse.status}` },
        { status: ollamaResponse.status }
      );
    }

    let text = (ollamaData?.message?.content || "").trim();
    text = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first !== -1 && last !== -1) text = text.substring(first, last + 1);

    try {
      const json = JSON.parse(text);
      return NextResponse.json(json);
    } catch {
      return NextResponse.json(
        {
          error: "Risposta locale non valida (JSON malformato).",
          raw: text.substring(0, 1500),
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: `Analisi locale fallita: ${error?.message || "Unknown Error"}` },
      { status: 500 }
    );
  }
}
