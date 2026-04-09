# FlowySDK — Guida all'integrazione (iOS)

---

## 1. Installazione

Apri il tuo progetto in Xcode e segui questi passaggi:

1. Dal menu in alto vai su **File → Add Package Dependencies…**
2. Nella barra di ricerca in alto a destra incolla l'URL del repository:
   ```
   https://github.com/your-org/FlowySDK
   ```
3. Imposta la regola di versione su **Up to Next Major Version** e clicca **Add Package**.
4. Nella schermata successiva assicurati che il tuo **app target** sia selezionato, poi clicca **Add Package**.

FlowySDK apparirà nella sezione **Package Dependencies** del tuo progetto Xcode.

> **Hai i sorgenti in locale?** Se hai già la cartella FlowySDK sul tuo Mac (es. clonata accanto al progetto), al punto 2 clicca invece **Add Local…** in basso a sinistra e seleziona la cartella `FlowySDK`.

---

## 2. Configurazione

Aggiungi **due sole righe** al file di avvio della tua app.

### SwiftUI

```swift
import SwiftUI
import FlowySDK          // ← aggiungi questo

@main
struct YourApp: App {
    init() {
        Flowy.configure(apiKey: "YOUR_API_KEY")   // ← aggiungi questo
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
```

### UIKit

```swift
import UIKit
import FlowySDK          // ← aggiungi questo

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        Flowy.configure(apiKey: "YOUR_API_KEY")   // ← aggiungi questo
        return true
    }
}
```

Da questo momento il tracciamento automatico è attivo. Non serve altro.

---

## 3. Esportare la sessione

Al termine di un flusso di test (es. al termine della sessione QA, oppure su un gesto di shake), esporta il bundle:

```swift
Flowy.shared.exportSession()
```

Questo unisce il log degli eventi + tutti i wireframe e screenshot in un unico file:

```
Documents/flowy_session_<timestamp>.json
```

Il log individuale e i file wireframe vengono eliminati dopo un'esportazione riuscita.

---

## 4. Come recuperare il bundle

### Via Xcode (consigliato — funziona su Simulatore e dispositivo reale)

1. Esporta la sessione dall'app.
2. In Xcode vai su **Window → Devices and Simulators**.
3. Seleziona il tuo dispositivo, trova la tua app nell'elenco.
4. Clicca sull'icona **⚙ (ingranaggio) → Download Container…**
5. Salva il file `.xcappdata` che Xcode esporta.
6. Fai clic destro sul file → **Show Package Contents**.
7. Naviga in `AppData / Documents /` — trovi `flowy_session_<timestamp>.json`.

### Via app Files su iPhone/iPad (richiede una configurazione aggiuntiva)

Aggiungi queste chiavi al file `Info.plist` della **tua app**:

| Chiave | Tipo | Valore |
|---|---|---|
| `UIFileSharingEnabled` | Boolean | YES |
| `LSSupportsOpeningDocumentsInPlace` | Boolean | YES |

Dopo aver riavviato l'app, il file sarà visibile in:
**Files app → Sul mio iPhone → [Nome App] → `flowy_session_*.json`**

---

## 5. Caricare sulla dashboard

Trascina il file `flowy_session_*.json` nella dashboard web di Flowy. La dashboard analizza automaticamente eventi, wireframe e screenshot incorporati, e non richiede nessun passaggio aggiuntivo.

---

## 6. Configurazione Info.plist

Nessuna chiave è obbligatoria per il tracciamento automatico o per l'acquisizione delle schermate.

Le seguenti chiavi sono **opzionali** e servono solo per sfogliare i file direttamente dal dispositivo:

| Chiave | Tipo | Valore | Quando serve |
|---|---|---|---|
| `UIFileSharingEnabled` | Boolean | YES | Per vedere i file nella **Files app** su iPhone |
| `LSSupportsOpeningDocumentsInPlace` | Boolean | YES | Per aprire il bundle JSON direttamente da Files |

**Come aggiungere una chiave:**

1. In Xcode clicca sul nome del progetto nel navigator a sinistra.
2. Sotto **TARGETS** seleziona la tua app.
3. Vai nel tab **Info**.
4. Passa il mouse su una riga esistente e clicca il **+** che appare a sinistra.
5. Digita il nome della chiave, imposta il tipo e il valore.

---

## 7. Funzioni disponibili

### Tracciamento automatico

Non richiede codice aggiuntivo. Una volta chiamato `Flowy.configure`, l'SDK registra automaticamente:

| Evento | Trigger | Modalità di cattura |
|---|---|---|
| `SCREEN` | Ogni `viewDidAppear` | Screenshot + dedup visivo (ritardo 0.3 s) |
| `TAP` | Ogni tocco rilasciato sulla key window | OCR + Screenshot + **DOM completo** (ritardo 0.8 s) |
| `SCROLL` | Scorrimento > 12 pt | Screenshot (ritardo 0.5 s, estrazione forzata) |
| `ERROR` / `SUCCESS` post-tap | 1.5 s dopo ogni tap — scansione OCR | Screenshot + **DOM completo** se testo rilevato |
| `ERROR` / `SUCCESS` passivo | Qualsiasi nuova view aggiunta alla key window | Screenshot + **DOM completo** immediato (debounce 0.9 s) |
| `SECURE_TAP` | Tap su campo password | Solo coordinate — nessun testo registrato |

**Modalità di cattura:**

- **DOM completo + Screenshot** (eventi chiave: TAP, ERROR, SUCCESS): esegue `ViewHierarchyExtractor` per costruire l'albero completo della vista. Usato quando il contesto preciso dell'elemento è fondamentale.
- **Solo Screenshot** (transizioni passive, SCREEN): scatta una JPEG compressa e salva un nodo placeholder leggero. Usato per tracciare il flusso visivo senza bloccare il main thread con un'estrazione completa.

### Tracciamento manuale

```swift
// Registra un errore personalizzato
Flowy.shared.trackError(description: "Timeout pagamento")

// Registra una schermata manualmente
// (utile per schermate che non usano un UIViewController standard)
Flowy.shared.trackScreen(name: "CheckoutWebView")
```

### Esportazione sessione

```swift
// Esporta il bundle completo in Documents/flowy_session_<timestamp>.json
Flowy.shared.exportSession()

// Mantieni i file wireframe individuali dopo il merge (default: false)
Flowy.shared.exportSession(deleteWireframeParts: false)
```

### Cattura wireframe manuale

```swift
// Cattura con estrazione DOM completa
Flowy.shared.captureWireframe(screenName: "OnboardingStep2")

// Allega uno screenshot esistente e salta l'estrazione DOM (leggero)
Flowy.shared.captureWireframe(screenName: "OnboardingStep2", screenshotBase64: base64String)

// Forza l'estrazione DOM completa anche quando è presente uno screenshot
Flowy.shared.captureWireframe(screenName: "OnboardingStep2", screenshotBase64: base64String, forceFullExtraction: true)
```

---

## 8. Formato del bundle di sessione

Il file esportato (`flowy_session_<timestamp>.json`) ha questa struttura:

```json
{
  "version": 1,
  "exported_at": 1711234567.89,
  "events": [ ... ],
  "wireframes": [ ... ]
}
```

### Formato degli eventi

```json
{
  "action": "TAP",
  "ocr_text": "Aggiungi al carrello [UIButton]",
  "coordinates": { "x": 195.0, "y": 720.0 },
  "screen_name": "Dettaglio Prodotto",
  "timestamp": 1711234567.89,
  "deviceInfo": { "model": "iPhone", "osVersion": "17.4" }
}
```

| `action` | Significato |
|---|---|
| `SCREEN` | L'utente è arrivato su una schermata |
| `TAP` | Tap con testo riconosciuto dall'OCR |
| `SECURE_TAP` | Tap su un campo password (testo non registrato) |
| `SCROLL` | Scorrimento rilevato (spostamento > 12 pt); genera screenshot post-scroll |
| `ERROR` | Testo di errore rilevato sullo schermo |
| `SUCCESS` | Testo di conferma/successo rilevato |

> Gli eventi `ERROR` e `SUCCESS` vengono registrati in due modi:
> - **Post-tap**: scansione OCR automatica 1.5 s dopo ogni tocco dell'utente.
> - **Passivo**: ogni volta che una nuova vista viene aggiunta alla key window, l'SDK esegue una scansione OCR senza che l'utente debba fare nulla.

### Formato dei wireframe

```json
{
  "screen_name": "dashboard_3",
  "captured_at": 1711234568.12,
  "tree": {
    "class_name": "Button",
    "frame": { "x": 16.0, "y": 740.0, "width": 358.0, "height": 50.0 },
    "text": "Continua",
    "children": null
  },
  "screenshot_base64": "<JPEG codificata in base64>"
}
```

| Campo | Descrizione |
|---|---|
| `screen_name` | Etichetta sequenziale (es. `dashboard_3`) — usata per l'ordine, non come identità |
| `captured_at` | Timestamp Unix (secondi) al momento della cattura |
| `tree` | Albero della vista completo (per eventi chiave) oppure nodo placeholder (cattura passiva) |
| `screenshot_base64` | JPEG a scala 40%, qualità 40%, ~18–30 KB. Presente in tutte le catture automatiche |

Quando `screenshot_base64` è presente, la dashboard lo mostra come sfondo visivo e sovrappone la heatmap. Quando è assente, vengono disegnati i rettangoli wireframe dal campo `tree`.

---

## 9. Come funziona internamente

### Pipeline di cattura ibrida

```
Touch rilasciato su UIWindow
  │
  ├─ Snapshot schermo (UIGraphicsImageRenderer, main thread)   ← per OCR
  │
  ├─ Vision OCR (background thread)
  │    ├─ VNRecognizeTextRequest → testo + bounding box
  │    └─ FlowyHeuristics: isErrorText / isSuccessText
  │
  ├─ Estrazione DOM (ViewHierarchyExtractor, main thread)      ← solo su TAP / ERROR / SUCCESS
  │    ├─ Walk subview UIKit → class_name + frame
  │    └─ Walk accessibility tree SwiftUI → nomi semantici dei componenti
  │
  ├─ Screenshot compresso (FlowyScreenshotCapture)              ← sempre
  │    └─ JPEG scala 40%, qualità 40% → stringa base64
  │
  └─ Dedup visivo (solo catture passive)
       └─ |nuova_dimensione - ultima_dimensione| / ultima < 8% → salta
```

### Costanti di temporizzazione (SDK iOS)

Tutte le costanti sono nella classe `FlowyLogger` e nel file `UIView+SubviewObserver.swift`. Puoi modificarle senza impatto sul resto del sistema — vedi [`TUNING.md`](./TUNING.md) per la guida completa.

| Costante | Valore attuale | File |
|---|---|---|
| Ritardo cattura post-tap | 0.8 s | `FlowyLogger.swift` |
| Ritardo cattura post-scroll | 0.5 s | `FlowyLogger.swift` |
| Ritardo cattura passiva (viewDidAppear) | 0.3 s | `FlowyLogger.swift` |
| Finestra di soppressione passiva dopo tap | 1.0 s | `FlowyLogger.swift` |
| Throttle cattura (rate-limit globale) | 1.0 s | `FlowyLogger.swift` |
| Debounce scansione passiva (didAddSubview) | 0.9 s | `UIView+SubviewObserver.swift` |
| Intervallo minimo tra scansioni passive | 1.8 s | `UIView+SubviewObserver.swift` |

### Qualità degli screenshot

| Parametro | Profilo normal | Profilo safe | File |
|---|---|---|---|
| `scaleFactor` | 0.40 | 0.30 | `FlowyScreenshotCapture.swift` |
| `jpegQuality` | 0.40 | 0.35 | `FlowyScreenshotCapture.swift` |

`normal` è il profilo predefinito (~18–30 KB per screenshot). `safe` viene attivato automaticamente in caso di attività intensa. Per forzarlo: `FlowyScreenshotCapture.setQualityProfile(.safe)`.

### Monitoraggio passivo dell'interfaccia

```
Nuova view aggiunta alla UIWindow (toast, banner, alert, …)
  │
  └─ UIView.didAddSubview (swizzled)
       │
       ├─ Filtra: salta _UI* / UITransitionView / internals di sistema
       │
       └─ Debounce 0.9 s
            │
            └─ performImmediateScan()
                 ├─ Vision OCR → isErrorText / isSuccessText
                 └─ se rilevato → logga ERROR/SUCCESS + DOM completo + screenshot
```

Un banner di timeout che appare 90 secondi dopo l'ultimo tap viene catturato **senza nessuna interazione dell'utente**.

### Corrispondenza evento–wireframe (dashboard)

La dashboard abbina ogni evento al wireframe corretto tramite **prossimità temporale**:

1. **TAP / SCROLL** → preferisce il wireframe catturato entro 5 s **dopo** l'evento (schermata di destinazione). Se non trovato, allarga a 10 s.
2. **SCREEN / ERROR / SUCCESS** → preferisce il wireframe catturato entro 10 s **prima** dell'evento.
3. Fallback: wireframe globalmente più vicino per timestamp.
4. Ultima risorsa: corrispondenza fuzzy per nome schermata.

### Analisi AI (dashboard web)

Per ogni sessione, la dashboard invia a Gemini:

- Il log completo degli eventi in formato compatto, con timestamp e riferimento allo screenshot associato (`shot: "S3"`)
- Un massimo di **5 screenshot** selezionati dalla sessione (vedi strategia di selezione in `TUNING.md`)
- Il modello di default è **`gemini-2.5-flash`** (supporta modalità multimodale e output JSON)

L'output è un report in italiano con: flusso ricostruito, analisi errori/successi, osservazioni UX, script Maestro YAML.

---

## 10. Privacy

| Aspetto | Come Flowy lo gestisce |
|---|---|
| Password | I campi sicuri (`isSecureTextEntry`, `SecureField`) vengono registrati come `[SECURE_FIELD]` — nessun testo viene catturato |
| Elaborazione locale | Tutto il riconoscimento OCR avviene sul dispositivo tramite Apple Vision. Nessuna immagine viene trasmessa durante la cattura |
| Screenshot | JPEG a bassa risoluzione incorporati nel bundle locale. Vengono trasmessi solo quando carichi esplicitamente il bundle sulla dashboard |
| JSON wireframe | Contiene solo la struttura delle view e il testo visibile |

---

## 11. Risoluzione dei problemi

**Le schermate appaiono identiche / si vede solo la splash screen**

La cattura è avvenuta prima che la transizione di navigazione si completasse. Verifica che `Flowy.configure` venga chiamato prima del primo `viewDidAppear`.

**Gli eventi mostrano lo screenshot sbagliato nella dashboard**

Assicurati di caricare il bundle completo `flowy_session_*.json`. La dashboard richiede il campo `captured_at` in ogni entry wireframe per eseguire la corrispondenza temporale.

**"No key window found" in console**

`captureWireframe()` è stato chiamato prima che la gerarchia delle finestre fosse pronta. Chiamalo in `viewDidAppear` o `.onAppear`, non in `init()` o `viewDidLoad()`.

**I file non sono visibili nell'app Files**

Controlla che sia `UIFileSharingEnabled` sia `LSSupportsOpeningDocumentsInPlace` siano impostati a `YES` nel file `Info.plist` dell'**app host** (non dell'SDK — l'SDK non ha un `Info.plist`).
