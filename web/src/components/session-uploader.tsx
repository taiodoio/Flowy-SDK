"use client"

import { useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Upload, FileJson, CheckCircle, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface SessionUploaderProps {
  onUpload: (data: any) => void
}

export function SessionUploader({ onUpload }: SessionUploaderProps) {
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
    if (file && file.type === "application/json") {
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

        // Check if it's already a session object or just an array/event
        if (json.events && Array.isArray(json.events)) {
          onUpload(json)
        } else if (Array.isArray(json)) {
          // It's an array of events, wrap it
          onUpload(createSyntheticSession(json))
        } else {
          // Maybe a single event? Wrap it.
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

  const createSyntheticSession = (events: any[]) => {
    return {
      id: `local-${new Date().getTime()}`,
      deviceInfo: {
        deviceModel: "Unknown (Log Import)",
        osVersion: "iOS",
        appVersion: "1.0"
      },
      events: events
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto my-8">
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
    </div>
  )
}
