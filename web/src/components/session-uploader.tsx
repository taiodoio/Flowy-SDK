"use client"

import { useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Upload, FileJson, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface SessionUploaderProps {
  onUpload: (data: any) => void
  sessionId?: string
  onWireframesUploaded?: () => void
}

export function SessionUploader({ onUpload, sessionId, onWireframesUploaded }: SessionUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }, [])
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false) }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && (file.name.toLowerCase().endsWith('.json') || file.type === "application/json" || file.type === "text/json")) {
      processFile(file)
    } else {
      toast.error("Please upload a valid JSON file")
    }
  }, [])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }, [])

  const processFile = (file: File) => {
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      try {
        const json = JSON.parse(content)

        if (json.events && Array.isArray(json.events)) {
          const session = createSyntheticSession(json.events)
          if (Array.isArray(json.wireframes) && json.wireframes.length > 0) {
            session.wireframes = json.wireframes.map((w: any, i: number) => ({
              screenName: w.screen_name ?? w.screenName ?? `screen_${i}`,
              rawFileName: `flowy_${w.screen_name ?? 'screen'}_${Math.round(w.captured_at ?? 0)}.json`,
              capturedAt: w.captured_at ?? w.capturedAt ?? 0,
              rootNode: w.tree,
              screenshotBase64: w.screenshot_base64 ?? undefined,
            }))
          }
          onUpload(session)
        } else if (Array.isArray(json)) {
          onUpload(createSyntheticSession(json))
        } else {
          onUpload(createSyntheticSession([json]))
        }
        toast.success("Session loaded successfully")
      } catch {
        try {
          const lines = content.split('\n').filter(line => line.trim() !== '')
          const events = lines.map(line => JSON.parse(line))
          onUpload(createSyntheticSession(events))
          toast.success("Session loaded (NDJSON)")
        } catch {
          toast.error("Invalid JSON or NDJSON file")
          setFileName(null)
        }
      }
    }
    reader.readAsText(file)
  }

  const createSyntheticSession = (events: any[]): any => ({
    id: `local-${new Date().getTime()}`,
    deviceInfo: { deviceModel: "Unknown (Log Import)", osVersion: "iOS", appVersion: "1.0" },
    events,
    wireframes: [],
  })

  const [wireframeStatus, setWireframeStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [wireframeCount, setWireframeCount] = useState(0)

  const uploadWireframes = useCallback(async (files: File[]) => {
    if (!sessionId) return
    setWireframeStatus('uploading')
    const fd = new FormData()
    for (const f of files) fd.append('wireframes', f)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/wireframes`, { method: 'POST', body: fd })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setWireframeCount(data.total ?? data.added ?? files.length)
      setWireframeStatus('done')
      toast.success(`${data.added} wireframe${data.added !== 1 ? 's' : ''} uploaded`)
      onWireframesUploaded?.()
    } catch {
      setWireframeStatus('error')
      toast.error('Failed to upload wireframes')
    }
  }, [sessionId, onWireframesUploaded])

  return (
    <div className="w-full p-4 space-y-3">
      <motion.div
        layout
        className={cn(
          "relative border-2 border-dashed rounded-xl p-10 transition-colors duration-200 cursor-pointer group",
          isDragging
            ? "border-[var(--accent)] bg-[var(--accent-soft)]"
            : "border-[var(--border)] hover:border-[var(--border-strong)] bg-[var(--surface-2)]/50",
          fileName && "border-[var(--success)] bg-[color:color-mix(in_oklab,var(--success)_8%,transparent)]"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-upload')?.click()}
      >
        <input id="file-upload" type="file" accept=".json" className="hidden" onChange={handleFileInput} />
        <div className="flex flex-col items-center justify-center text-center gap-3">
          <AnimatePresence mode="wait">
            {fileName ? (
              <motion.div key="success" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="flex flex-col items-center">
                <div className="h-12 w-12 rounded-full bg-[var(--success-soft)] flex items-center justify-center mb-3">
                  <CheckCircle2 className="h-6 w-6 text-[var(--success)]" />
                </div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">{fileName}</h3>
                <p className="text-xs text-[var(--text-tertiary)] mt-1">Ready for analysis</p>
              </motion.div>
            ) : (
              <motion.div key="upload" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="flex flex-col items-center">
                <div className={cn(
                  "h-12 w-12 rounded-xl border border-[var(--border)] bg-[var(--surface)] flex items-center justify-center mb-3 transition-transform",
                  isDragging ? "scale-110" : "group-hover:scale-105"
                )}>
                  <Upload className="h-5 w-5 text-[var(--text-tertiary)]" />
                </div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  {isDragging ? "Drop your file" : "Upload session log"}
                </h3>
                <p className="text-xs text-[var(--text-tertiary)] mt-1">
                  Drag and drop a JSON file, or click to browse
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {sessionId && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="border border-dashed border-[var(--border)] rounded-xl p-3 cursor-pointer hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]/50 transition-colors"
          onClick={() => document.getElementById('wireframe-upload')?.click()}
        >
          <input
            id="wireframe-upload"
            type="file"
            accept=".json"
            multiple
            className="hidden"
            onChange={e => {
              const files = Array.from(e.target.files ?? [])
              if (files.length) uploadWireframes(files)
            }}
          />
          <div className="flex items-center gap-3 text-sm">
            <div className="h-8 w-8 rounded-lg bg-[var(--surface-2)] flex items-center justify-center flex-shrink-0">
              <FileJson className="h-4 w-4 text-[var(--text-tertiary)]" />
            </div>
            <div className="text-xs">
              {wireframeStatus === 'uploading' && <span className="text-[var(--text-secondary)]">Uploading wireframes…</span>}
              {wireframeStatus === 'done' && <span className="text-[var(--text-primary)]">{wireframeCount} wireframe{wireframeCount !== 1 ? 's' : ''} attached</span>}
              {wireframeStatus === 'error' && <span className="text-[var(--danger)]">Upload failed — try again</span>}
              {wireframeStatus === 'idle' && (
                <span className="text-[var(--text-tertiary)]">Optional: drop flowy_*.json wireframe files</span>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}
