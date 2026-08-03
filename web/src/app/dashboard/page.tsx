"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { SessionUploader } from "@/components/session-uploader"
import { SessionListItem } from "@/components/session-list-item"
import { ThemeToggle } from "@/components/theme-toggle"
import { Search, Sparkles, Filter, ListChecks, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

type StatusFilter = "all" | "analyzed" | "pending"
type PlatformFilter = "all" | "cloud" | "local"

export default function Dashboard() {
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all")
  const [showUploader, setShowUploader] = useState(false)
  const [lastUploadedSessionId, setLastUploadedSessionId] = useState<string | undefined>()

  useEffect(() => { fetchSessions() }, [])

  const fetchSessions = async () => {
    try {
      const res = await fetch("/api/sessions", { cache: 'no-store' })
      if (res.ok) setSessions(await res.json())
    } catch {
      toast.error("Failed to load sessions")
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async (data: any) => {
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const saved = await res.json()
      if (!res.ok) throw new Error(saved?.error || "Failed to save session")
      setLastUploadedSessionId(saved?.session?.id ?? data?.id)
      toast.success("Session saved")
      await fetchSessions()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save session")
    }
  }

  const handleToggleApproval = async (id: string, isApproved: boolean) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, isApproved } : s))
    try {
      await fetch(`/api/sessions/${id}`, { method: "PATCH", body: JSON.stringify({ isApproved }) })
      toast.success(isApproved ? "Session approved" : "Approval removed")
    } catch {
      toast.error("Failed to update status")
      fetchSessions()
    }
  }

  const handleDelete = async (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id))
    try {
      const res = await fetch(`/api/sessions/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed")
      toast.success("Session deleted")
    } catch {
      toast.error("Failed to delete")
      fetchSessions()
    }
  }

  const filtered = sessions.filter(s => {
    const matchesSearch =
      s.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.deviceInfo?.deviceModel?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.tags?.some((t: string) => t.toLowerCase().includes(searchQuery.toLowerCase()))

    const isAnalyzed = !!s.report
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "analyzed" && isAnalyzed) ||
      (statusFilter === "pending" && !isAnalyzed)

    const matchesPlatform =
      platformFilter === "all" ||
      (platformFilter === "cloud" && isAnalyzed && s.analyzedBy !== 'local') ||
      (platformFilter === "local" && isAnalyzed && s.analyzedBy === 'local')

    return matchesSearch && matchesStatus && matchesPlatform
  })

  const counts = {
    total: sessions.length,
    analyzed: sessions.filter(s => !!s.report).length,
    pending: sessions.filter(s => !s.report).length,
    approved: sessions.filter(s => !!s.isApproved).length,
    events: sessions.reduce((sum, s) => sum + (s.events?.length ?? 0), 0),
    errors: sessions.reduce((sum, s) =>
      sum + (s.events?.filter((e: any) => (e.action || e.type || "").toLowerCase() === "error").length ?? 0), 0),
  }

  const analyzedPct = counts.total > 0 ? Math.round((counts.analyzed / counts.total) * 100) : 0
  const pendingPct = counts.total > 0 ? Math.round((counts.pending / counts.total) * 100) : 0
  const approvedPct = counts.total > 0 ? Math.round((counts.approved / counts.total) * 100) : 0
  const errorPct = counts.events > 0 ? Math.round((counts.errors / counts.events) * 100) : 0

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <header className="border-b border-[var(--border)] bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70 sticky top-0 z-50">
        <div className="container mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-md bg-[var(--accent)] grid place-items-center text-[var(--accent-foreground)]">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <span className="font-semibold tracking-tight">Flowy</span>
            </Link>
            <span className="text-[var(--text-muted)] text-sm">/</span>
            <span className="text-[var(--text-secondary)] text-sm">Sessions</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button size="sm" onClick={() => setShowUploader(true)}>
              Upload session
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Stats overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <SessionBreakdownCard
            total={counts.total}
            analyzed={counts.analyzed}
            pending={counts.pending}
            analyzedPct={analyzedPct}
            pendingPct={pendingPct}
          />
          <EventsErrorsCard
            events={counts.events}
            errors={counts.errors}
            errorPct={errorPct}
          />
          <ApprovedCard approved={counts.approved} approvedPct={approvedPct} total={counts.total} />
        </div>

        {/* Filter bar */}
        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
          <div className="flex-1 flex items-center gap-2 px-0 h-10">
            <Search className="w-4 h-4 text-[var(--text-tertiary)] shrink-0" />
            <Input
              placeholder="Search by ID, device, or tag…"
              className="text-sm h-10 px-3 border border-[var(--border)] rounded-lg bg-[var(--surface)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] placeholder:text-[var(--text-muted)]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <FilterPills
            label="Status"
            icon={<ListChecks className="w-3.5 h-3.5" />}
            options={[
              { value: "all", label: "All" },
              { value: "analyzed", label: "Analyzed" },
              { value: "pending", label: "Pending" },
            ]}
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as StatusFilter)}
          />

          <FilterPills
            label="Platform"
            icon={<Filter className="w-3.5 h-3.5" />}
            options={[
              { value: "all", label: "All" },
              { value: "cloud", label: "Cloud" },
              { value: "local", label: "Local" },
            ]}
            value={platformFilter}
            onChange={(v) => setPlatformFilter(v as PlatformFilter)}
          />
        </div>

        {/* Column headers (md+) */}
        <div className="hidden md:grid grid-cols-12 gap-4 px-5 pb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
          <div className="col-span-3 pl-2">Session</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Platform</div>
          <div className="col-span-2">Tags</div>
          <div className="col-span-2">Events</div>
          <div className="col-span-1 text-right">Actions</div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-[var(--text-muted)] text-sm">Loading sessions…</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center border border-dashed border-[var(--border)] rounded-xl">
            <p className="text-[var(--text-secondary)] text-sm">
              {sessions.length === 0
                ? "No sessions yet. Upload a JSON log to get started."
                : "No sessions match the current filters."}
            </p>
            {sessions.length === 0 && (
              <Button size="sm" className="mt-4" onClick={() => setShowUploader(true)}>
                Upload session
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((s) => (
              <SessionListItem
                key={s.id}
                session={s}
                onToggleApproval={handleToggleApproval}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </main>

      {/* Upload Drawer/Modal */}
      {showUploader && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowUploader(false)}>
          <div
            className="w-full md:max-w-2xl bg-[var(--surface)] border border-[var(--border)] md:rounded-2xl rounded-t-2xl shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 h-12 border-b border-[var(--border)]">
              <h3 className="text-sm font-semibold">Upload session</h3>
              <button
                onClick={() => setShowUploader(false)}
                className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2">
              <SessionUploader
                onUpload={async (data) => { await handleUpload(data) }}
                sessionId={lastUploadedSessionId}
                onWireframesUploaded={fetchSessions}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SessionBreakdownCard({
  total, analyzed, pending, analyzedPct, pendingPct,
}: {
  total: number
  analyzed: number
  pending: number
  analyzedPct: number
  pendingPct: number
}) {
  return (
    <div className="border border-[var(--border)] bg-[var(--surface)] rounded-xl px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Sessions</p>
      <p className="text-2xl font-semibold tabular-nums text-[var(--text-primary)] mt-1">{total}</p>
      <div className="mt-3 h-2 w-full rounded-full bg-[var(--surface-2)] overflow-hidden">
        <div className="h-full bg-[var(--success)]" style={{ width: `${analyzedPct}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-[var(--success)] font-medium">Analyzed {analyzed} ({analyzedPct}%)</span>
        <span className="text-[var(--warning)] font-medium">Pending {pending} ({pendingPct}%)</span>
      </div>
    </div>
  )
}

function EventsErrorsCard({
  events, errors, errorPct,
}: {
  events: number
  errors: number
  errorPct: number
}) {
  const goodPct = Math.max(0, 100 - errorPct)
  return (
    <div className="border border-[var(--border)] bg-[var(--surface)] rounded-xl px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Events Quality</p>
      <p className="text-2xl font-semibold tabular-nums text-[var(--text-primary)] mt-1">{events}</p>
      <div className="mt-3 h-2 w-full rounded-full bg-[var(--surface-2)] overflow-hidden flex">
        <div className="h-full bg-[var(--success)]" style={{ width: `${goodPct}%` }} />
        <div className="h-full bg-[var(--danger)]" style={{ width: `${errorPct}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-[var(--text-secondary)] font-medium">Errors {errors}</span>
        <span className="text-[var(--danger)] font-medium">{errorPct}%</span>
      </div>
    </div>
  )
}

function ApprovedCard({
  approved, approvedPct, total,
}: {
  approved: number
  approvedPct: number
  total: number
}) {
  return (
    <div className="border border-[var(--border)] bg-[var(--surface)] rounded-xl px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Approved</p>
      <p className="text-2xl font-semibold tabular-nums text-[var(--text-primary)] mt-1">{approved}</p>
      <div className="mt-3 h-2 w-full rounded-full bg-[var(--surface-2)] overflow-hidden">
        <div className="h-full bg-[var(--info)]" style={{ width: `${approvedPct}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-[var(--text-secondary)] font-medium">of {total} sessions</span>
        <span className="text-[var(--info)] font-medium">{approvedPct}%</span>
      </div>
    </div>
  )
}

function FilterPills<T extends string>({
  label, icon, options, value, onChange,
}: {
  label: string
  icon: React.ReactNode
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)] hidden md:flex items-center gap-1">
        {icon}
        {label}
      </span>
      <div className="inline-flex items-center bg-[var(--surface-2)] border border-[var(--border)] rounded-lg p-0.5">
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`px-3 h-8 text-xs font-medium rounded-md transition-colors ${
              value === o.value
                ? "bg-[var(--surface)] text-[var(--text-primary)] shadow-sm border border-[var(--border)]"
                : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
