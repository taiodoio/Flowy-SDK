"use client"

import { useState, useEffect } from "react"
import { SessionUploader } from "@/components/session-uploader"
import { SessionListItem } from "@/components/session-list-item"
import { Badge } from "@/components/ui/badge"
import { LayoutDashboard, UploadCloud, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

export default function Home() {
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    fetchSessions()
  }, [])

  const fetchSessions = async () => {
    try {
      const res = await fetch("/api/sessions", { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setSessions(data)
      }
    } catch (e) {
      console.error("Failed to fetch sessions", e)
      toast.error("Failed to load sessions")
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async (data: any) => {
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        body: JSON.stringify(data)
      })
      if (res.ok) {
        toast.success("Session saved")
        await fetchSessions()
      }
    } catch (e) {
      toast.error("Failed to save session")
    }
  }

  const handleToggleApproval = async (id: string, isApproved: boolean) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, isApproved } : s))
    try {
      await fetch(`/api/sessions/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isApproved })
      })
      toast.success(isApproved ? "Session approved" : "Approval status updated")
    } catch (e) {
      toast.error("Failed to update status")
      fetchSessions()
    }
  }

  const handleDelete = async (id: string) => {
    // Optimistic update
    setSessions(prev => prev.filter(s => s.id !== id))
    try {
      const res = await fetch(`/api/sessions/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete")
      toast.success("Session deleted")
    } catch (e) {
      toast.error("Failed to delete session")
      fetchSessions() // Revert on error
    }
  }

  const filteredSessions = sessions.filter(s =>
    s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.deviceInfo?.deviceModel?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.tags?.some((t: string) => t.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 relative overflow-hidden font-sans selection:bg-purple-500/30">

      {/* Background Mesh */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-900/10 blur-[100px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-900/10 blur-[100px] animate-pulse delay-1000" />
      </div>

      <header className="border-b border-white/10 bg-slate-950/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
              <span className="font-bold text-white">F</span>
            </div>
            <span className="font-semibold text-xl tracking-tight text-white">Flowy</span>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-6 py-8 relative z-10">
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col md:flex-row gap-8 items-start">
            {/* Left: Upload Section */}
            <div className="md:w-1/3 space-y-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-indigo-400" />
                Session Manual Upload
              </h2>
              <p className="text-muted-foreground text-sm">
                Upload a raw JSON session log to start a new analysis.
              </p>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <SessionUploader onUpload={handleUpload} />
              </div>
            </div>

            {/* Right: List Section */}
            <div className="md:w-2/3 space-y-4 w-full">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <LayoutDashboard className="w-5 h-5 text-purple-400" />
                Session List
              </h2>

              <div className="flex items-center gap-2 bg-slate-900/50 p-2 rounded-lg border border-white/5 mb-4">
                <Search className="w-4 h-4 text-slate-500 ml-2" />
                <Input
                  placeholder="Search sessions..."
                  className="border-none bg-transparent focus-visible:ring-0 text-sm h-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {loading ? (
                <div className="text-center py-12 text-slate-500">Loading sessions...</div>
              ) : filteredSessions.length === 0 ? (
                <div className="text-center py-12 text-slate-500 border border-dashed border-white/10 rounded-xl">
                  {sessions.length === 0 ? "No sessions found. Upload one to get started!" : "No matches found."}
                </div>
              ) : (
                <div className="grid gap-3">
                  {filteredSessions.map((s) => (
                    <SessionListItem
                      key={s.id}
                      session={s}
                      onToggleApproval={handleToggleApproval}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
