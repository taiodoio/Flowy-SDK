"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation" // No useParams
import { AnalysisReport } from "@/components/analysis-report"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, RefreshCcw, Tag as TagIcon, FileJson, UploadCloud } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

function WireframeUploadZone({
    sessionId,
    wireframeCount,
    onUploaded,
}: {
    sessionId: string;
    wireframeCount: number;
    onUploaded: () => void;
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
        } catch {
            toast.error('Failed to upload wireframes')
        } finally {
            setUploading(false)
        }
    }, [sessionId, onUploaded])

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-300 flex items-center gap-1.5">
                    <FileJson className="w-4 h-4 text-purple-400" /> Wireframes
                </span>
                <Badge variant="outline" className="text-xs border-white/10 font-mono">
                    {wireframeCount} screen{wireframeCount !== 1 ? 's' : ''}
                </Badge>
            </div>
            <div
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={e => { e.preventDefault(); setDragging(false) }}
                onDrop={e => { e.preventDefault(); setDragging(false); upload(Array.from(e.dataTransfer.files)) }}
                onClick={() => document.getElementById('wf-upload-report')?.click()}
                className={cn(
                    "border border-dashed rounded-lg p-3 text-xs text-center cursor-pointer transition-colors",
                    dragging ? "border-purple-500 bg-purple-500/10 text-purple-300"
                             : "border-white/10 text-slate-500 hover:border-purple-500/40 hover:text-slate-300"
                )}
            >
                <input id="wf-upload-report" type="file" accept=".json" multiple className="hidden"
                    onChange={e => upload(Array.from(e.target.files ?? []))} />
                <UploadCloud className="w-4 h-4 mx-auto mb-1 opacity-60" />
                {uploading ? 'Uploading…' : dragging ? 'Drop here!' : 'Drop flowy_*.json wireframes'}
            </div>
        </div>
    )
}

export default function SessionReportPage() {
    const router = useRouter()

    // Manual ID extraction state
    const [id, setId] = useState<string | null>(null)
    const [session, setSession] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [analyzing, setAnalyzing] = useState(false)
    const [analyzeError, setAnalyzeError] = useState<{ message: string; retryIn?: number | null } | null>(null)
    const [error, setError] = useState<string | null>(null)

    // Robust ID extraction from URL
    useEffect(() => {
        if (typeof window === 'undefined') return;

        // Parse ID from URL manually
        const parts = window.location.pathname.split('/');
        const extractedId = parts.pop() || parts.pop(); // Handle trailing slash

        console.log(`[MANUAL_Navigation] Full Path: ${window.location.pathname}`);
        console.log(`[MANUAL_Navigation] Extracted ID: ${extractedId}`);

        if (extractedId && extractedId !== 'report' && extractedId !== 'undefined') {
            setId(extractedId);
        } else {
            console.error(`[MANUAL_Navigation] Invalid ID extracted: ${extractedId}`);
            // Do NOT set error here immediately, give it a moment or user manual navigation
            if (extractedId === 'undefined') {
                setError("Navigation Error: URL contains 'undefined' ID.");
            }
        }
    }, []); // Run ONCE on mount

    useEffect(() => {
        if (id) {
            fetchSession(id)
        }
    }, [id])

    const fetchSession = async (sessionId: string) => {
        // Double safety check
        if (!sessionId || sessionId === 'undefined') {
            console.error("Aborting fetch for undefined session ID");
            return;
        }

        try {
            console.log("Fetching session:", sessionId)
            const res = await fetch(`/api/sessions/${sessionId}`, { cache: 'no-store' })
            if (!res.ok) {
                const errText = await res.text()
                let errMsg = `API Error ${res.status}: ${errText}`

                try {
                    const jsonErr = JSON.parse(errText)
                    if (jsonErr.code === 'ENOENT') {
                        setError("Session file not found on server.");
                        return;
                    }
                    errMsg = JSON.stringify(jsonErr, null, 2)
                } catch {
                    // ignore
                }
                throw new Error(errMsg)
            }
            const data = await res.json()
            setSession(data)
        } catch (e: any) {
            console.error(e)
            setError(e.message)
            toast.error("Failed to load session")
        } finally {
            setLoading(false)
        }
    }

    const handleAnalyze = async () => {
        if (!id) return;
        setAnalyzing(true)
        setAnalyzeError(null)
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
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ report: data })
            })
            const savedSession = await saveRes.json()
            if (!saveRes.ok) {
                throw new Error(savedSession?.error || "Failed to persist generated report")
            }

            setSession(savedSession)
            toast.success("Report generated & saved")
        } catch (e: any) {
            console.error("Full Analysis Error:", e)
            setAnalyzeError({ message: e.message || "Unknown error" })
        } finally {
            setAnalyzing(false)
        }
    }

    const handleToggleApproval = async (checked: boolean) => {
        if (!id) return;
        setSession((prev: any) => ({ ...prev, isApproved: checked }))
        try {
            await fetch(`/api/sessions/${id}`, {
                method: "PATCH",
                body: JSON.stringify({ isApproved: checked })
            })
            toast.success("Status updated")
        } catch (e) {
            if (id) fetchSession(id)
        }
    }

    const handleUpdateTags = async (tags: string[]) => {
        if (!id) return;
        setSession((prev: any) => ({ ...prev, tags }))
        try {
            await fetch(`/api/sessions/${id}`, {
                method: "PATCH",
                body: JSON.stringify({ tags })
            })
            toast.success("Tags updated")
        } catch (e) {
            if (id) fetchSession(id)
        }
    }

    if (error) return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
            <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-xl max-w-md w-full">
                <h3 className="text-red-500 font-bold text-lg mb-2">Failed to load session</h3>
                <div className="text-yellow-500 text-xs mb-4 font-mono">
                    Target ID: {id || 'Null'} <br />
                    Current URL: {typeof window !== 'undefined' ? window.location.href : 'N/A'}
                </div>
                <pre className="text-red-400 font-mono text-xs overflow-auto whitespace-pre-wrap">{error}</pre>
                <Button onClick={() => router.push("/")} className="mt-6 w-full" variant="outline">
                    Back to Home
                </Button>
            </div>
        </div>
    )

    if (loading) return (
        <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center">
            <div className="text-center py-20 text-slate-500 animate-pulse">Loading session...</div>
        </div>
    )

    if (!session) return null

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-purple-500/30 pb-20">
            {/* Header */}
            <header className="border-b border-white/10 bg-slate-950/50 backdrop-blur-xl sticky top-0 z-50">
                <div className="container mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")} className="text-slate-400 hover:text-white">
                            <ArrowLeft className="w-4 h-4 mr-2" /> Back
                        </Button>
                        <div className="h-6 w-px bg-white/10" />
                        <span className="font-semibold text-white truncate max-w-[200px] md:max-w-md">
                            {session.id}
                        </span>
                        <Badge variant="outline" className="font-mono text-xs border-white/10">
                            {session.deviceInfo?.deviceModel}
                        </Badge>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-6 py-8">
                {/* Logic: If no report, show Generate CTA */}
                {!session.report ? (
                    <div className="max-w-2xl mx-auto py-20 text-center animate-in fade-in slide-in-from-bottom-4">
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-10 space-y-6">
                            <h1 className="text-3xl font-bold text-white">Ready for Analysis</h1>
                            <p className="text-slate-400 text-lg">
                                This session has {session.events?.length} events but no AI report yet.
                            </p>
                            <Button
                                size="lg"
                                onClick={handleAnalyze}
                                disabled={analyzing}
                                className="w-full max-w-sm bg-gradient-to-r from-purple-600 to-indigo-600 shadow-xl shadow-purple-500/20 py-6 text-lg"
                            >
                                {analyzing ? (
                                    <>
                                        <RefreshCcw className="mr-2 h-5 w-5 animate-spin" /> Analisi in corso…
                                    </>
                                ) : (
                                    <>
                                        <RefreshCcw className="mr-2 h-5 w-5" /> Generate AI Report
                                    </>
                                )}
                            </Button>
                            {analyzeError && (
                                <div className="max-w-sm mx-auto mt-4 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-left space-y-1">
                                    <p className="text-red-300 text-sm font-medium">{analyzeError.message}</p>
                                    {analyzeError.retryIn ? (
                                        <p className="text-red-400/70 text-xs">Riprova manualmente dopo {analyzeError.retryIn}s.</p>
                                    ) : (
                                        <p className="text-red-400/70 text-xs">Controlla la console del browser per i dettagli tecnici.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-in fade-in">
                        <div className="lg:col-span-3 space-y-6">
                            <AnalysisReport report={session.report} session={session} />
                        </div>

                        <div className="lg:col-span-1 space-y-6">
                            <div className="bg-white/5 backdrop-blur-md rounded-xl p-6 border border-white/10 sticky top-24 space-y-6">
                                <div>
                                    <h3 className="font-semibold mb-4 text-white">Quick Stats</h3>
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-slate-400">Duration</span>
                                            <span className="font-medium text-white">{session.report.header?.duration || "-"}</span>
                                        </div>
                                        <Separator className="bg-white/10" />
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-slate-400">Screens</span>
                                            <span className="font-medium text-white">{session.report.stats?.screens_visited?.length || "-"}</span>
                                        </div>
                                    </div>
                                </div>
                                <Separator className="bg-white/10" />

                                {/* Controls */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-slate-300">Approved</span>
                                        <Switch
                                            checked={session.isApproved}
                                            onCheckedChange={handleToggleApproval}
                                            className="data-[state=checked]:bg-green-500"
                                        />
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
                                            <TagIcon className="w-4 h-4 text-indigo-400" /> Tags
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {session.tags?.map((tag: string) => (
                                                <Badge key={tag} variant="secondary" className="bg-indigo-500/10 text-indigo-300 border-indigo-500/20 text-xs">
                                                    {tag}
                                                </Badge>
                                            ))}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                placeholder="Add tag..."
                                                className="h-8 text-xs bg-slate-950/50 border-white/10"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        const val = e.currentTarget.value.trim()
                                                        if (val && !session.tags?.includes(val)) {
                                                            handleUpdateTags([...(session.tags || []), val])
                                                            e.currentTarget.value = ""
                                                        }
                                                    }
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <Separator className="bg-white/10" />

                                {/* Wireframes section */}
                                <WireframeUploadZone
                                    sessionId={id!}
                                    wireframeCount={session.wireframes?.length ?? 0}
                                    onUploaded={() => id && fetchSession(id)}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}
