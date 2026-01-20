
// CACHE BUSTER: Force Rebuild 12345
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  try {
    const session = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "Gemini API Key missing" }, { status: 500 });
    }

    // Verified available models for this specific API key (High-Tier Access)
    const modelsToTry = ["gemini-2.0-flash", "gemini-2.0-flash-exp", "gemini-2.5-flash"];

    let lastError = null;

    const prompt = `
    You are a Senior Mobile QA Engineer and Product Expert.
    Analyze the following user session log from the "Flowy" iOS SDK.
    
    Session Data: ${JSON.stringify(session).substring(0, 50000)}
    
    Task: Create a detailed forensic analysis of the user session, exactly matching the structure below.
    Use the OCR text and timestamps to reconstruct the story.
    
    Output a JSON object ONLY with this exact schema:
    {
      "header": {
        "title": "e.g. Analisi Sessione: [Main Action] & [Outcome] (ID: [SessionID])",
        "duration": "e.g. ~34 secondi",
        "main_screens": "e.g. Split View -> RootView (Modal)",
        "deduced_section": "e.g. Timer Page (Detected via content analysis)",
        "status_text": "e.g. FAILED (if Functional Error) or SUCCESS"
      },
      "executive_summary": {
         "worked": ["User successfully logged in", "Navigation to Profile worked"],
         "issues": ["User could not save changes (Functional Error)", "Slow loading on home"]
      },
      "reconstructed_flow": [
        {
          "section": "e.g. Login Flow",
          "status": "SUCCESS", 
          "summary": "User entered credentials and proceeded.",
          "steps": [
             { "timestamp": "...", "description": "Tapped 'Email'", "type": "NORMAL" },
             { "timestamp": "...", "description": "Entered password", "type": "NORMAL" },
             { "timestamp": "...", "description": "Tapped 'Login'", "type": "SUCCESS" }
          ]
        },
        {
          "section": "e.g. Timer Setup",
          "status": "ERROR", 
          "summary": "User attempted to set timer but failed.",
          "steps": [
             { "timestamp": "...", "description": "Tapped 'New Timer'", "type": "NORMAL" },
             { "timestamp": "...", "description": "Nothing happened", "type": "ERROR" }
          ]
        }
      ],
      "error_analysis": [
         { 
           "timestamp": "e.g. ...416", 
           "type": "WARNING", 
           "ocr_text": "Attenzione if admin exits...", 
           "analysis": "Informativo. Opens at screen launch..." 
         },
         {
           "timestamp": "...",
           "type": "PERSISTENT_WARNING",
           "ocr_text": "e.g. Attenzione (Always visible)",
           "analysis": "Static warning text detected on screen."
         },
         {
           "timestamp": "...",
           "type": "FUNCTIONAL_ERROR",
           "ocr_text": "e.g. User tapped but nothing happened",
           "analysis": "App did not respond to tap on 'Checkout'. Critical flow blocker."
         }
      ],
      "success_analysis": [
         {
           "timestamp": "e.g. ...500",
           "action": "e.g. Item Saved",
           "ocr_text": "Successo",
           "details": "User successfully completed the flow."
         }
      ],
      "ux_analysis": [
        {
           "heuristic": "e.g. Visibility of System Status",
           "observation": "Loader displayed clearly during data fetch.",
           "status": "OK",
           "recommendation": "Keep it up."
        },
        {
           "heuristic": "e.g. Error Prevention",
           "observation": "User was able to submit empty form without validation.",
           "status": "IMPROVE",
           "recommendation": "Disable submit button until fields are valid."
        }
      ],
      "technical_notes": "Markdown bullet points of technical observations (e.g. Keyboard detected via UIViewController, consistent back button coordinates).",
      "maestro_yaml": "A COMPLETE Maestro (yaml) test script to reproduce this SPECIFIC flow from App Launch to the End State. MUST include every step."
    }
    
    IMPORTANT RULES: 
    1. STATUS HIERARCHY: 
       - If there is at least ONE 'FUNCTIONAL_ERROR', 'status_text' MUST be 'FAILED'.
       - If there are only 'WARNING' or 'PERSISTENT_WARNING', 'status_text' is 'SUCCESS' (with warnings).
       - If completely clean, 'status_text' is 'SUCCESS'.
    2. OVERVIEW: Split the summary into 'worked' (positive highlights) and 'issues' (negative findings).
    3. FLOW AGGREGATION: Group steps into logical SECTIONS (e.g. Login, Home, Profile). Do not just list linear steps. Provide a summary for each section.
    4. RECONSTRUCTED FLOW: 
       - 'status' of a section should be 'ERROR' if it contains a functional error, 'SUCCESS' ONLY if it contains an explicit success outcome, otherwise 'NORMAL'.
       - **STEP TYPES**:
         - NORMAL: ALL user actions (Taps, Validations, Navigation, typing). E.g., "Tapped Login", "Navigated to Profile". Even if it worked, it is NORMAL.
         - SUCCESS: ONLY system confirmation/feedback. E.g., "Success Toast appeared", "Status changed to Active", "User reached 'Thank You' page".
         - ERROR: Functional failures.
    5. MAESTRO SCRIPT: Must be a full reproduction path. Do not skip setup steps. Assume app starts fresh.
    6. Analyze OCR density to deduce the actual section name in 'header.deduced_section'.
    `;

    for (const modelName of modelsToTry) {
      try {
        console.log(`Attempting analysis with model: ${modelName}`);

        // Enable JSON mode for newer models which ensures valid output
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: { responseMimeType: "application/json" }
        });

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text();

        console.log(`Success with ${modelName}`);
        console.log("Gemini Raw Response:", text);

        // Clean up markdown block format if present, more aggressively (case insensitive)
        text = text.replace(/```json/gi, "").replace(/```/g, "").trim();

        // Find the start and end of the JSON object if there's extra text
        const firstOpen = text.indexOf('{');
        const lastClose = text.lastIndexOf('}');
        if (firstOpen !== -1 && lastClose !== -1) {
          text = text.substring(firstOpen, lastClose + 1);
        }

        let json;
        try {
          json = JSON.parse(text);
        } catch (e) {
          console.error(`JSON Parse failed for ${modelName}:`, text);
          throw new Error("Invalid JSON response");
        }

        return NextResponse.json(json); // Return the distinct new structure

      } catch (error: any) {
        console.warn(`Failed with ${modelName}: ${error.message}`);
        lastError = error;
        // If it's a 404 (Model Not Found), continue.
        // If it's a 401/403 (Auth), probably breaks for all.
        // But we continue to be safe.
      }
    }

    // If loop finishes without success
    console.error("All models failed.");
    return NextResponse.json({
      error: `All models failed. Last error: ${lastError?.message || "Unknown"}`
    }, { status: 500 });

  } catch (error: any) {
    console.error("AI Analysis Failed:", error);
    return NextResponse.json({
      error: `Analysis Failed: ${error.message || "Unknown Error"}`
    }, { status: 500 });
  }
}
