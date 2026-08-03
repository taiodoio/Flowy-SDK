"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { AnalysisReport, getReportSections, type ReportSectionKey } from "@/components/analysis-report"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { ThemeToggle } from "@/components/theme-toggle"
import {
    ArrowLeft, RefreshCcw, Tag as TagIcon, UploadCloud, Sparkles,
    LayoutDashboard, GitBranch, PlayCircle, Flame, AlertCircle, CheckCircle2,
    Lightbulb, MessageSquare, Code, FileText, Settings2,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const SECTION_ICONS: Record<ReportSectionKey | "settings", React.ReactNode> = {
    overview:  <LayoutDashboard className="w-4 h-4" />,
    flow:      <GitBranch className="w-4 h-4" />,
    replay:    <PlayCircle className="w-4 h-4" />,
    heatmap:   <Flame className="w-4 h-4" />,
    errors:    <AlertCircle className="w-4 h-4" />,
    successes: <CheckCircle2 className="w-4 h-4" />,
    ux:        <Lightbulb className="w-4 h-4" />,
    feedback:  <MessageSquare className="w-4 h-4" />,
    tech:      <Code className="w-4 h-4" />,
    test:      <FileText className="w-4 h-4" />,
    settings:  <Settings2 className="w-4 h-4" />,
}

function WireframeUploadZone({ sessionId, wireframeCount, onUploaded }: {
    sessionId: string; wireframeCount: number; onUploaded: () => void;
}) {
    const [dragging, setDragging] = useState(false)
    const [uploading, setUploading] = useState(false)

    const upload = useCallback(async (files: File[]) => {
        const jsons = files.filter(f => f.name.endsWith('.json'))
        if (!jsons.length) { toast.error('Drop .json wireframe files'); return }
        setUploading(true)
        const fd = new FormData()
        jsons.forEach(f => fd.append('wireframes', f))
        try {
            const res = await fetch(`/api/sessions/${sessionId}/wireframes`, { method: 'POST', body: fd })
            if (!res.ok) throw new Error()
            const data = await res.json()
            toast.success(`${data.added} wireframe${data.added !== 1 ? 's' : ''} attached`)
            onUploaded()
        } catch { toast.error('Failed to upload wireframes') }
        finally { setUploading(false) }
    }, [sessionId, onUploaded])

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <p className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider">Wireframes</p>
                <span className="text-[10px] font-mono text-[var(--text-tertiary)] border border-[var(--border)] rounded px-1.5 py-0.5">
                    {wireframeCount}
                </span>
            </div>
            <div
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={e => { e.preventDefault(); setDragging(false) }}
                onDrop={e => { e.preventDefault(); setDragging(false); upload(Array.from(e.dataTransfer.files)) }}
                onClick={() => document.getElementById('wf-upload-report')?.click()}
                className={cn(
                    "border border-dashed rounded-lg p-3 text-xs text-center cursor-pointer transition-colors",
                    dragging
                        ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                        : "border-[var(--border)] text-[var(--text-tertiary)] hover:border-[var(--border-strong)] hover:text-[var(--text-secondary)]"
                )}
            >
                <input id="wf-upload-report" type="file" accept=".json" multiple className="hidden"
                    onChange={e => upload(Array.from(e.target.files ?? []))} />
                <UploadCloud className="w-3.5 h-3.5 mx-auto mb-1" />
                {uploading ? 'Uploading…' : dragging ? 'Drop here' : 'Drop flowy_*.json'}
            </div>
        </div>
    )
}

export default function SessionReportPage() {
    const router = useRouter()
    const [id, setId] = useState<string | null>(null)
    const [session, setSession] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [analyzing, setAnalyzing] = useState(false)
    const [analyzingLocal, setAnalyzingLocal] = useState(false)
    const [analyzeError, setAnalyzeError] = useState<{ message: string; retryIn?: number | null } | null>(null)
    const [analyzeErrorLocal, setAnalyzeErrorLocal] = useState<{ message: string } | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [activeSection, setActiveSection] = useState<ReportSectionKey | "settings">("overview")

    useEffect(() => {
        if (typeof window === 'undefined') return
        const parts = window.location.pathname.split('/')
        const extractedId = parts.pop() || parts.pop()
        if (extractedId && extractedId !== 'report' && extractedId !== 'undefined') setId(extractedId)
        else if (extractedId === 'undefined') setError("Navigation Error: URL contains 'undefined' ID.")
    }, [])

    useEffect(() => { if (id) fetchSession(id) }, [id])

    const fetchSession = async (sessionId: string) => {
        if (!sessionId || sessionId === 'undefined') return
        try {
            const res = await fetch(`/api/sessions/${sessionId}`, { cache: 'no-store' })
            if (!res.ok) {
                const errText = await res.text()
                try {
                    const jsonErr = JSON.parse(errText)
                    if (jsonErr.code === 'ENOENT') { setError("Session file not found on server."); return }
                    throw new Error(JSON.stringify(jsonErr, null, 2))
                } catch { throw new Error(`API Error ${res.status}: ${errText}`) }
            }
            setSession(await res.json())
        } catch (e: any) {
            setError(e.message)
            toast.error("Failed to load session")
        } finally { setLoading(false) }
    }

    const handleAnalyze = async () => {
        if (!id) return
        setAnalyzing(true); setAnalyzeError(null); setAnalyzeErrorLocal(null)
        try {
            const res = await fetch("/api/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(session)
            })
            const data = await res.json()
            if (res.status === 429 || data.quota_exhausted) {
                const retryIn: number | null = data.retry_in_seconds ?? null
                setAnalyzeError({
                    message: retryIn
                        ? `Quota API Gemini esaurita. Riprova tra ${retryIn} secondi.`
                        : "Quota API Gemini esaurita. Riprova tra qualche minuto.",
                    retryIn,
                })
                return
            }
            if (!res.ok || data.error) {
                setAnalyzeError({ message: data.error || "Analysis request failed" })
                return
            }
            const saveRes = await fetch(`/api/sessions/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ report: data, analyzedBy: 'remote' })
            })
            const savedSession = await saveRes.json()
            if (!saveRes.ok) throw new Error(savedSession?.error || "Failed to persist generated report")
            setSession(savedSession)
            toast.success("Report generated & saved")
        } catch (e: any) {
            setAnalyzeError({ message: e.message || "Unknown error" })
        } finally { setAnalyzing(false) }
    }

    const handleAnalyzeLocal = async () => {
        if (!id) return
        setAnalyzingLocal(true); setAnalyzeErrorLocal(null); setAnalyzeError(null)
        try {
            const healthRes = await fetch("http://localhost:11434/api/tags", { signal: AbortSignal.timeout(3000) })
            if (!healthRes.ok) throw new Error("Ollama health check failed")
        } catch {
            setAnalyzingLocal(false)
            setAnalyzeErrorLocal({ message: "Ollama non è raggiungibile. Verifica che sia in esecuzione su localhost:11434." })
            return
        }
        try {
            const res = await fetch("/api/analyze-local", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(session)
            })
            const data = await res.json()
            if (!res.ok || data.error) {
                setAnalyzeErrorLocal({ message: data.error || "Local analysis request failed" })
                return
            }
            const saveRes = await fetch(`/api/sessions/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ report: data, analyzedBy: 'local' })
            })
            const savedSession = await saveRes.json()
            if (!saveRes.ok) throw new Error(savedSession?.error || "Failed to persist generated local report")
            setSession(savedSession)
            toast.success("Local report generated & saved")
        } catch (e: any) {
            setAnalyzeErrorLocal({ message: e.message || "Unknown local error" })
        } finally { setAnalyzingLocal(false) }
    }

    const handleToggleApproval = async (checked: boolean) => {
        if (!id) return
        setSession((prev: any) => ({ ...prev, isApproved: checked }))
        try {
            await fetch(`/api/sessions/${id}`, { method: "PATCH", body: JSON.stringify({ isApproved: checked }) })
            toast.success("Status updated")
        } catch { if (id) fetchSession(id) }
    }

    const handleUpdateTags = async (tags: string[]) => {
        if (!id) return
        setSession((prev: any) => ({ ...prev, tags }))
        try {
            await fetch(`/api/sessions/${id}`, { method: "PATCH", body: JSON.stringify({ tags }) })
            toast.success("Tags updated")
        } catch { if (id) fetchSession(id) }
    }

    const sections = useMemo(() => session?.report ? getReportSections(session.report, session) : [], [session])
    const activeSectionMeta = useMemo(
        () => sections.find(s => s.key === activeSection),
        [sections, activeSection]
    )

    if (error) return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
            <div className="border border-[color:color-mix(in_oklab,var(--danger)_30%,transparent)] bg-[var(--danger-soft)] rounded-xl p-6 max-w-md w-full space-y-4">
                <h3 className="text-[var(--danger)] font-semibold">Failed to load session</h3>
                <p className="text-[var(--text-secondary)] text-sm font-mono">ID: {id ?? "unknown"}</p>
                <pre className="text-[var(--danger)]/80 font-mono text-xs overflow-auto whitespace-pre-wrap border border-[var(--border)] rounded p-3 bg-[var(--surface)]">{error}</pre>
                <Button onClick={() => router.push("/dashboard")} variant="outline" className="w-full">Back to Sessions</Button>
            </div>
        </div>
    )

    if (loading) return (
        <div className="min-h-screen bg-background flex items-center justify-center">
            <div className="text-[var(--text-tertiary)] text-sm">Loading session…</div>
        </div>
    )

    if (!session) return null

    return (
        <div className="min-h-screen bg-background text-foreground font-sans">
            {/* Header */}
            <header className="border-b border-[var(--border)] bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70 sticky top-0 z-40">
                <div className="container mx-auto px-6 h-14 flex items-center gap-3">
                    <Link href="/" className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-md bg-[var(--accent)] grid place-items-center text-[var(--accent-foreground)]">
                            <Sparkles className="h-3.5 w-3.5" />
                        </div>
                        <span className="font-semibold tracking-tight hidden md:inline">Flowy</span>
                    </Link>
                    <span className="text-[var(--text-muted)] text-sm">/</span>
                    <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")} className="text-[var(--text-secondary)] gap-1.5 -ml-1">
                        <ArrowLeft className="w-3.5 h-3.5" /> Sessions
                    </Button>
                    <span className="text-[var(--text-muted)] text-sm">/</span>
                    <span className="font-mono text-sm text-[var(--text-secondary)] truncate max-w-[140px] md:max-w-xs">{session.id}</span>
                    <div className="ml-auto flex items-center gap-2">
                        <ThemeToggle />
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-6 py-6">
                {!session.report ? (
                    <NoReportView
                        eventCount={session.events?.length ?? 0}
                        onAnalyze={handleAnalyze}
                        onAnalyzeLocal={handleAnalyzeLocal}
                        analyzing={analyzing}
                        analyzingLocal={analyzingLocal}
                        analyzeError={analyzeError}
                        analyzeErrorLocal={analyzeErrorLocal}
                    />
                ) : (
                    /* Sidebar layout */
                    <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
                        {/* Sidebar */}
                        <aside className="lg:sticky lg:top-20 lg:self-start space-y-2">
                            {/* Session info card */}
                            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
                                <div>
                                    <p className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1">Session</p>
                                    <p className="font-mono text-xs text-[var(--text-primary)] truncate" title={session.id}>{session.id}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                    <SidebarStat label="Duration" value={session.report.header?.duration || "—"} />
                                    <SidebarStat label="Events" value={String(session.events?.length ?? "—")} />
                                    <SidebarStat label="Screens" value={String(session.report.stats?.screens_visited?.length || "—")} />
                                    <SidebarStat label="AI" value={session.analyzedBy === 'local' ? 'Local' : 'Cloud'} />
                                </div>
                                <div className="pt-1 border-t border-[var(--border)] space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Approved</span>
                                        <Switch
                                            checked={!!session.isApproved}
                                            onCheckedChange={handleToggleApproval}
                                            aria-label="Toggle approval"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <p className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider">Tags</p>
                                        {session.tags?.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                                {session.tags.map((tag: string) => (
                                                    <button
                                                        key={tag}
                                                        className="inline-flex items-center gap-1 text-[10px] border border-[var(--border)] text-[var(--text-secondary)] rounded-full px-2 py-0.5 hover:border-[var(--danger)] hover:text-[var(--danger)] transition-colors"
                                                        onClick={() => handleUpdateTags(session.tags.filter((t: string) => t !== tag))}
                                                    >
                                                        {tag} <TagIcon className="w-2.5 h-2.5" />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        <Input
                                            placeholder="Add tag + Enter"
                                            className="h-7 text-xs"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    const val = (e.currentTarget as HTMLInputElement).value.trim()
                                                    if (val && !session.tags?.includes(val)) {
                                                        handleUpdateTags([...(session.tags || []), val])
                                                        ;(e.currentTarget as HTMLInputElement).value = ""
                                                    }
                                                }
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Section nav */}
                            <nav className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1.5">
                                {sections.filter(s => s.available).map(s => (
                                    <SidebarNavItem
                                        key={s.key}
                                        active={activeSection === s.key}
                                        onClick={() => setActiveSection(s.key)}
                                        icon={SECTION_ICONS[s.key]}
                                        label={s.title}
                                        count={s.count}
                                    />
                                ))}
                                <div className="my-1.5 h-px bg-[var(--border)]" />
                                <SidebarNavItem
                                    active={activeSection === "settings"}
                                    onClick={() => setActiveSection("settings")}
                                    icon={SECTION_ICONS.settings}
                                    label="Settings"
                                />
                            </nav>
                        </aside>

                        {/* Content */}
                        <section className="min-w-0">
                            {activeSection === "settings" ? (
                                <SettingsPanel
                                    session={session}
                                    sessionId={id!}
                                    onToggleApproval={handleToggleApproval}
                                    onUpdateTags={handleUpdateTags}
                                    onWireframesUploaded={() => id && fetchSession(id)}
                                />
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2.5 px-1">
                                        <span className="text-[var(--accent)]">
                                            {SECTION_ICONS[(activeSectionMeta?.key || "overview") as ReportSectionKey]}
                                        </span>
                                        <h1 className="text-lg font-semibold text-[var(--text-primary)]">
                                            {activeSectionMeta?.title || "Session Analysis"}
                                        </h1>
                                    </div>
                                    <AnalysisReport
                                        report={session.report}
                                        session={session}
                                        section={activeSection as ReportSectionKey}
                                    />
                                </div>
                            )}
                        </section>
                    </div>
                )}
            </main>
        </div>
    )
}

/* ---------- Sub-components ---------- */

function SidebarStat({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{label}</p>
            <p className="text-[var(--text-primary)] font-mono mt-0.5 text-xs">{value}</p>
        </div>
    )
}

function SidebarNavItem({ active, onClick, icon, label, count }: {
    active: boolean
    onClick: () => void
    icon: React.ReactNode
    label: string
    count?: number
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "w-full flex items-center gap-2.5 px-3 h-11 rounded-xl text-sm transition-colors border",
                active
                    ? "bg-[var(--accent)] text-[var(--accent-foreground)] font-semibold border-[color:color-mix(in_oklab,var(--accent)_58%,black_10%)] shadow-sm"
                    : "bg-transparent text-[var(--text-primary)] border-transparent hover:bg-[var(--surface-hover)]"
            )}
        >
            <span className={cn("shrink-0", active ? "text-[var(--accent-foreground)]" : "text-[var(--text-secondary)]")}>{icon}</span>
            <span className="flex-1 text-left truncate">{label}</span>
            {typeof count === "number" && count > 0 && (
                <span className={cn(
                    "tabular-nums text-[10px] font-mono px-1.5 py-0.5 rounded-full border",
                    active
                        ? "bg-white/90 text-[var(--accent)] border-white/95"
                        : "bg-[var(--surface)] text-[var(--text-primary)] border-[var(--border-strong)]"
                )}>{count}</span>
            )}
        </button>
    )
}

function NoReportView({
    eventCount, onAnalyze, onAnalyzeLocal,
    analyzing, analyzingLocal, analyzeError, analyzeErrorLocal,
}: {
    eventCount: number
    onAnalyze: () => void
    onAnalyzeLocal: () => void
    analyzing: boolean
    analyzingLocal: boolean
    analyzeError: { message: string; retryIn?: number | null } | null
    analyzeErrorLocal: { message: string } | null
}) {
    return (
        <div className="max-w-lg mx-auto py-12 space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Generate Report</h1>
                <p className="text-[var(--text-tertiary)] text-sm mt-1">
                    {eventCount} events captured. No AI analysis yet — choose a backend below.
                </p>
            </div>

            <div className="space-y-3">
                <div className="border border-[var(--border)] rounded-xl bg-[var(--surface)] p-5 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="font-medium text-[var(--text-primary)] text-sm">Cloud AI</p>
                            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">Gemini 2.5 Flash — requires API key</p>
                        </div>
                        <Button onClick={onAnalyze} disabled={analyzing || analyzingLocal} className="min-w-[110px]" size="sm">
                            {analyzing ? <><RefreshCcw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Analyzing…</> : "Analyze"}
                        </Button>
                    </div>
                    {analyzeError && (
                        <div className="border border-[color:color-mix(in_oklab,var(--danger)_30%,transparent)] bg-[var(--danger-soft)] rounded-lg p-3 text-sm text-[var(--danger)]">
                            {analyzeError.message}
                            {analyzeError.retryIn && (
                                <p className="text-[var(--danger)]/70 text-xs mt-1">Retry in {analyzeError.retryIn}s</p>
                            )}
                        </div>
                    )}
                </div>

                <div className="border border-[var(--border)] rounded-xl bg-[var(--surface)] p-5 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="font-medium text-[var(--text-primary)] text-sm">Local AI</p>
                            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">Ollama on localhost:11434 — text only</p>
                        </div>
                        <Button onClick={onAnalyzeLocal} disabled={analyzing || analyzingLocal} variant="outline" className="min-w-[110px]" size="sm">
                            {analyzingLocal ? <><RefreshCcw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Analyzing…</> : "Analyze"}
                        </Button>
                    </div>
                    {analyzeErrorLocal && (
                        <div className="border border-[color:color-mix(in_oklab,var(--warning)_30%,transparent)] bg-[var(--warning-soft)] rounded-lg p-3 text-sm text-[var(--warning)]">
                            {analyzeErrorLocal.message}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

function SettingsPanel({
    session, sessionId, onToggleApproval, onUpdateTags, onWireframesUploaded,
}: {
    session: any
    sessionId: string
    onToggleApproval: (v: boolean) => void
    onUpdateTags: (tags: string[]) => void
    onWireframesUploaded: () => void
}) {
    return (
        <div className="space-y-4">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">Approval status</p>
                        <p className="text-xs text-[var(--text-tertiary)] mt-0.5">Mark as reviewed for team handoff.</p>
                    </div>
                    <Switch
                        checked={!!session.isApproved}
                        onCheckedChange={onToggleApproval}
                        aria-label="Toggle approval"
                    />
                </div>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3">
                <p className="text-sm font-medium text-[var(--text-primary)]">Tags</p>
                {session.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {session.tags.map((tag: string) => (
                            <button
                                key={tag}
                                className="inline-flex items-center gap-1 text-xs border border-[var(--border)] text-[var(--text-secondary)] rounded-full px-2.5 py-0.5 hover:border-[var(--danger)] hover:text-[var(--danger)] transition-colors"
                                onClick={() => onUpdateTags(session.tags.filter((t: string) => t !== tag))}
                            >
                                {tag} <TagIcon className="w-2.5 h-2.5" />
                            </button>
                        ))}
                    </div>
                )}
                <Input
                    placeholder="Add tag and press Enter…"
                    className="h-8 text-xs"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            const val = (e.currentTarget as HTMLInputElement).value.trim()
                            if (val && !session.tags?.includes(val)) {
                                onUpdateTags([...(session.tags || []), val])
                                ;(e.currentTarget as HTMLInputElement).value = ""
                            }
                        }
                    }}
                />
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
                <WireframeUploadZone
                    sessionId={sessionId}
                    wireframeCount={session.wireframes?.length ?? 0}
                    onUploaded={onWireframesUploaded}
                />
            </div>
        </div>
    )
}
