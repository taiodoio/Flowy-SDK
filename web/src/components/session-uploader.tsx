"use client"

import { useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Upload, FileJson, CheckCircle, XCircle } from "lucide-react"
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

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file && (file.name.toLowerCase().endsWith('.json') || file.type === "application/json" || file.type === "text/json")) {
      processFile(file)
    } else {
      toast.error("Please upload a valid JSON file")
    }
  }, [onUpload])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      processFile(file)
    }
  }, [onUpload])

  const processFile = (file: File) => {
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      try {
        // 1. Try standard JSON parse
        const json = JSON.parse(content)

        // Flowy export bundle: { version, exported_at, events, wireframes }
        if (json.events && Array.isArray(json.events)) {
          const session = createSyntheticSession(json.events)
          // Map wireframes from bundle format to WireframeFile format
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
      } catch (err) {
        // 2. Fallback: NDJSON (Newline Delimited JSON)
        try {
          const lines = content.split('\n').filter(line => line.trim() !== '')
          const events = lines.map(line => JSON.parse(line))
          onUpload(createSyntheticSession(events))
          toast.success("Session loaded successfully (NDJSON)")
        } catch (ndjsonErr) {
          console.error("NDJSON Parse Error:", ndjsonErr)
          toast.error("Invalid JSON or NDJSON file")
          setFileName(null)
        }
      }
    }
    reader.readAsText(file)
  }

  const createSyntheticSession = (events: any[]): any => {
    return {
      id: `local-${new Date().getTime()}`,
      deviceInfo: {
        deviceModel: "Unknown (Log Import)",
        osVersion: "iOS",
        appVersion: "1.0"
      },
      events,
      wireframes: [],
    }
  }

  const [wireframeDragging, setWireframeDragging] = useState(false)
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
    <div className="w-full max-w-2xl mx-auto my-8 space-y-4">
      <motion.div
        layout
        className={cn(
          "relative border-2 border-dashed rounded-xl p-12 transition-colors duration-300 ease-in-out cursor-pointer group",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/50",
          fileName ? "border-green-500/50 bg-green-500/5" : ""
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-upload')?.click()}
      >
        <input
          id="file-upload"
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleFileInput}
        />

        <div className="flex flex-col items-center justify-center text-center gap-4">
          <AnimatePresence mode="wait">
            {fileName ? (
              <motion.div
                key="success"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="flex flex-col items-center"
              >
                <div className="h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                  <CheckCircle className="h-8 w-8 text-green-500" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">{fileName}</h3>
                <p className="text-sm text-muted-foreground mt-1">Ready for analysis</p>
              </motion.div>
            ) : (
              <motion.div
                key="upload"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="flex flex-col items-center"
              >
                <div className={cn(
                  "h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 transition-transform duration-300",
                  isDragging ? "scale-110" : "group-hover:scale-110"
                )}>
                  <Upload className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">
                  {isDragging ? "Drop it here!" : "Upload Session Log"}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Drag and drop your JSON file here, or click to browse
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Wireframe upload zone — only shown once a session is saved */}
      {sessionId && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "relative border border-dashed rounded-xl p-5 transition-colors duration-200 cursor-pointer",
            wireframeDragging
              ? "border-purple-500 bg-purple-500/10"
              : wireframeStatus === 'done'
              ? "border-purple-500/40 bg-purple-500/5"
              : "border-border hover:border-purple-500/40 hover:bg-muted/30"
          )}
          onDragOver={e => { e.preventDefault(); setWireframeDragging(true) }}
          onDragLeave={e => { e.preventDefault(); setWireframeDragging(false) }}
          onDrop={e => {
            e.preventDefault()
            setWireframeDragging(false)
            const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.json'))
            if (files.length) uploadWireframes(files)
            else toast.error('Please drop .json wireframe files')
          }}
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
            <div className={cn(
              "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0",
              wireframeStatus === 'done' ? "bg-purple-500/20" : "bg-muted"
            )}>
              <FileJson className={cn("h-4 w-4", wireframeStatus === 'done' ? "text-purple-400" : "text-muted-foreground")} />
            </div>
            <div>
              {wireframeStatus === 'uploading' && <span className="text-slate-400">Uploading wireframes…</span>}
              {wireframeStatus === 'done' && <span className="text-purple-300">{wireframeCount} wireframe{wireframeCount !== 1 ? 's' : ''} attached</span>}
              {wireframeStatus === 'error' && <span className="text-red-400">Upload failed — try again</span>}
              {wireframeStatus === 'idle' && (
                <span className="text-muted-foreground">
                  {wireframeDragging ? 'Drop wireframe files!' : 'Attach wireframes (optional) — drop flowy_*.json files here'}
                </span>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}
