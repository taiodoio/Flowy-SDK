"use client"

import { formatDistanceToNow } from "date-fns"
import {
    CheckCircle2,
    Clock,
    Smartphone,
    AlertCircle,
    AlertTriangle,
    Trash2,
    ChevronRight,
    Cloud,
    Cpu,
    MinusCircle,
} from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"

interface SessionListItemProps {
    session: any
    onToggleApproval: (id: string, isApproved: boolean) => void
    onDelete: (id: string) => void
}

export function SessionListItem({ session, onToggleApproval, onDelete }: SessionListItemProps) {
    const isAnalyzed = !!session.report
    const isLocal = session.analyzedBy === 'local'
    const eventErrorCount = session.events?.filter((e: any) => (e.action || e.type || "").toLowerCase() === 'error').length || 0
    const eventWarningCount = session.events?.filter((e: any) => (e.action || e.type || "").toLowerCase() === 'warning').length || 0
    const reportErrorCount = session.report?.error_analysis?.filter((e: any) => e.type !== 'PERSISTENT_WARNING').length || 0
    const reportWarningCount = session.report?.error_analysis?.filter((e: any) => e.type === 'PERSISTENT_WARNING').length || 0
    const errorCount = Math.max(eventErrorCount, reportErrorCount)
    const warningCount = Math.max(eventWarningCount, reportWarningCount)
    const eventCount = session.events?.length ?? 0

    const handleClick = () => {
        if (!session.id) return
        window.location.href = `/report/${session.id}`
    }

    return (
        <div
            onClick={handleClick}
            title={`Session ID: ${session.id}`}
            className="group relative grid grid-cols-12 gap-4 items-center px-5 py-4 cursor-pointer bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl transition-colors"
        >
            {/* Left rail status accent */}
            <span
                aria-hidden
                className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-r ${
                    isAnalyzed ? "bg-[var(--accent)]" : "bg-[var(--border-strong)]"
                }`}
            />

            {/* ID + device */}
            <div className="col-span-12 md:col-span-3 min-w-0 pl-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-primary)] mb-1">Session</p>
                <div className="flex items-center gap-2">
                    <code className="font-mono text-xs text-[var(--text-secondary)] bg-[var(--surface-2)] border border-[var(--border)] rounded px-1.5 py-0.5">
                        {session.id?.substring(0, 8) || "NO-ID"}
                    </code>
                    <span className="text-xs text-[var(--text-muted)]">
                        {session.uploadedAt && formatDistanceToNow(new Date(session.uploadedAt), { addSuffix: true })}
                    </span>
                </div>
                <div className="mt-1.5 flex items-center gap-2 text-sm text-[var(--text-secondary)] truncate">
                    <Smartphone className="w-3.5 h-3.5 text-[var(--text-tertiary)] shrink-0" />
                    <span className="truncate">{session.deviceInfo?.deviceModel || "Unknown device"}</span>
                </div>
            </div>

            {/* Status */}
            <div className="col-span-6 md:col-span-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-primary)] mb-1">Status</p>
                {isAnalyzed ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-[var(--success-soft)] text-[var(--success)] border border-[color:color-mix(in_oklab,var(--success)_30%,transparent)]">
                        <CheckCircle2 className="w-3 h-3" /> Analyzed
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-[var(--surface-2)] text-[var(--text-tertiary)] border border-[var(--border)]">
                        <Clock className="w-3 h-3" /> Pending
                    </span>
                )}
            </div>

            {/* Platform */}
            <div className="col-span-6 md:col-span-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-primary)] mb-1">Platform</p>
                {isAnalyzed ? (
                    isLocal ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-[var(--warning-soft)] text-[var(--warning)] border border-[color:color-mix(in_oklab,var(--warning)_30%,transparent)]">
                            <Cpu className="w-3 h-3" /> Local AI
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-[var(--info-soft)] text-[var(--info)] border border-[color:color-mix(in_oklab,var(--info)_30%,transparent)]">
                            <Cloud className="w-3 h-3" /> Cloud AI
                        </span>
                    )
                ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
                        <MinusCircle className="w-3 h-3" /> Not run
                    </span>
                )}
            </div>

            {/* Events */}
            <div className="col-span-12 md:col-span-2 hidden md:block">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-primary)] mb-1">Tags</p>
                {Array.isArray(session.tags) && session.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                        {session.tags.slice(0, 2).map((tag: string) => (
                            <span
                                key={tag}
                                className="inline-flex items-center rounded-full border border-[var(--border-strong)] bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-primary)]"
                            >
                                {tag}
                            </span>
                        ))}
                        {session.tags.length > 2 && (
                            <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">
                                +{session.tags.length - 2}
                            </span>
                        )}
                    </div>
                ) : (
                    <span className="text-xs text-[var(--text-tertiary)]">—</span>
                )}
            </div>

            <div className="col-span-12 md:col-span-2 hidden md:block">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-primary)] mb-1">Events</p>
                <div className="flex items-center gap-3 text-sm">
                    <span className="text-[var(--text-primary)] font-medium tabular-nums">{eventCount}</span>
                    {errorCount > 0 && (
                        <span
                            className="inline-flex items-center gap-1 text-xs text-[var(--danger)] font-medium"
                            title={reportErrorCount > 0 ? `Errors from analysis: ${reportErrorCount}` : `Errors from events: ${eventErrorCount}`}
                        >
                            <AlertCircle className="w-3 h-3" /> {errorCount}
                        </span>
                    )}
                    {warningCount > 0 && (
                        <span
                            className="inline-flex items-center gap-1 text-xs text-[var(--warning)] font-medium"
                            title={reportWarningCount > 0 ? `Warnings from analysis: ${reportWarningCount}` : `Warnings from events: ${eventWarningCount}`}
                        >
                            <AlertTriangle className="w-3 h-3" /> {warningCount}
                        </span>
                    )}
                </div>
            </div>

            {/* Actions */}
            <div className="col-span-12 md:col-span-1 flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-2 mr-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-primary)]">Approved</span>
                    <Switch
                        checked={!!session.isApproved}
                        onCheckedChange={(checked) => onToggleApproval(session.id, checked)}
                        className="data-[state=checked]:bg-[var(--success)]"
                    />
                </div>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-[var(--text-muted)] hover:text-[var(--danger)]"
                    onClick={() => {
                        if (confirm('Delete this session? This cannot be undone.')) {
                            onDelete(session.id)
                        }
                    }}
                >
                    <Trash2 className="w-4 h-4" />
                </Button>
                <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] group-hover:translate-x-0.5 transition-all" />
            </div>
        </div>
    )
}
