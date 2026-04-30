"use client"

import ReactMarkdown from "react-markdown"
import {
    AlertCircle,
    CheckCircle,
    Clock,
    Smartphone,
    Code,
    Lightbulb,
    Activity,
    AlertTriangle,
    FileText,
    ChevronDown,
    XCircle,
    MessageSquare,
} from "lucide-react"
import dynamic from "next/dynamic"
import { useState, type ReactNode } from "react"

const SessionReplay = dynamic(() => import("./session-replay").then(m => m.SessionReplay), { ssr: false })
const WireframeHeatmap = dynamic(() => import("./wireframe-heatmap").then(m => m.WireframeHeatmap), { ssr: false })

export type ReportSectionKey =
    | "overview"
    | "flow"
    | "replay"
    | "heatmap"
    | "errors"
    | "successes"
    | "ux"
    | "feedback"
    | "tech"
    | "test"

export interface SectionDescriptor {
    key: ReportSectionKey
    title: string
    available: boolean
    count?: number
}

interface ReportProps {
    report: any
    session: any
    section: ReportSectionKey
}

function adaptReport(report: any) {
    if (!report) return null
    return report.header ? report : {
        header: {
            title: report.overview || "Session Analysis",
            duration: report.stats?.duration || "-",
            status_text: report.status || "UNKNOWN",
            main_screens: report.stats?.screens_visited?.join(" → ") || ""
        },
        executive_summary: report.overview,
        reconstructed_flow: report.journey?.map((j: any) => ({
            phase: `Step ${j.step}`,
            narrative: j.description,
            key_actions: []
        })) || [],
        error_analysis: report.insights?.error_analysis ? [{ type: 'GENERAL', analysis: report.insights.error_analysis }] : [],
        success_analysis: report.success_analysis || [],
        ux_analysis: report.ux_analysis || [],
        technical_notes: report.insights?.technical_notes,
        maestro_yaml: report.test_case_yaml
    }
}

export function getReportSections(report: any, session: any): SectionDescriptor[] {
    const data = adaptReport(report)
    const hasWireframes = (session?.wireframes?.length ?? 0) > 0
    const feedbackCount = session?.events?.filter((e: any) => e.action === 'USER_FEEDBACK').length ?? 0
    const errorCount = data?.error_analysis?.filter((e: any) => e.type !== 'PERSISTENT_WARNING').length ?? 0
    const successCount = data?.success_analysis?.length ?? 0
    const uxCount = data?.ux_analysis?.length ?? 0
    const flowCount = data?.reconstructed_flow?.length ?? 0

    return [
        { key: "overview",  title: "Overview",     available: true },
        { key: "flow",      title: "Flow",         available: flowCount > 0, count: flowCount },
        { key: "replay",    title: "Replay",       available: hasWireframes },
        { key: "heatmap",   title: "Heatmap",      available: hasWireframes },
        { key: "errors",    title: "Errors",       available: true, count: errorCount },
        { key: "successes", title: "Successes",    available: true, count: successCount },
        { key: "ux",        title: "UX Insights",  available: true, count: uxCount },
        { key: "feedback",  title: "Feedback",     available: true, count: feedbackCount },
        { key: "tech",      title: "Technical",    available: !!data?.technical_notes },
        { key: "test",      title: "Test Script",  available: !!data?.maestro_yaml },
    ]
}

export function AnalysisReport({ report, session, section }: ReportProps) {
    const data = adaptReport(report)

    if (!report) return null

    if (report.error) {
        return (
            <div className="p-6 rounded-xl border border-[color:color-mix(in_oklab,var(--danger)_30%,transparent)] bg-[var(--danger-soft)] text-[var(--danger)]">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" /> Analysis Failed
                </h3>
                <p className="mt-2">{report.error}</p>
                <p className="text-sm opacity-80 mt-1">Check the server logs or API key.</p>
            </div>
        )
    }

    let content: ReactNode = null
    if (section === "overview") content = <OverviewSection data={data} report={report} session={session} />
    if (section === "flow") content = <FlowSection data={data} />
    if (section === "replay") content = <SessionReplay session={session} />
    if (section === "heatmap") content = (
        <WireframeHeatmap
            wireframes={session.wireframes ?? []}
            tapEvents={(session.events ?? []).filter((e: any) => {
                const action = (e.action ?? e.type ?? '').toUpperCase()
                return action === 'TAP' && e.coordinates
            })}
        />
    )
    if (section === "errors") content = <ErrorsSection data={data} />
    if (section === "successes") content = <SuccessesSection data={data} />
    if (section === "ux") content = <UXSection data={data} />
    if (section === "feedback") content = <FeedbackSection session={session} />
    if (section === "tech") content = <TechSection data={data} />
    if (section === "test") content = <TestSection data={data} />

    if (content) return <>{content}</>

    return null
}

/* ---------- OVERVIEW ---------- */
function OverviewSection({ data, report, session }: any) {
    const rawErrors = data?.error_analysis || []
    const visibleErrors = rawErrors.filter((e: any) => e.type !== 'PERSISTENT_WARNING')
    const warnings = rawErrors.filter((e: any) => e.type === 'PERSISTENT_WARNING')
    const derivedStatus = visibleErrors.length > 0 ? "FAILED" : warnings.length > 0 ? "WARNING" : "SUCCESS"
    const isFailure = derivedStatus === "FAILED"
    const isWarning = derivedStatus === "WARNING"
    const isLocal = session?.analyzedBy === 'local'

    const summaryWorked = data?.executive_summary?.worked || []
    const summaryIssues = data?.executive_summary?.issues || []
    const summaryLegacy = typeof data?.executive_summary === 'string' ? data.executive_summary : null
    const summaryDescription =
        typeof data?.executive_summary === 'string' ? data.executive_summary
        : data?.executive_summary?.description || report?.overview || data?.header?.title || "No description available."

    return (
        <div className="space-y-5">
            {/* Title card */}
            <section className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
                <div
                    className={`pointer-events-none absolute -right-8 top-1/2 -translate-y-1/2 hidden md:block z-0 ${
                        isFailure ? "text-[var(--danger)]" : isWarning ? "text-[var(--warning)]" : "text-[var(--success)]"
                    }`}
                    style={{ opacity: 0.15 }}
                    aria-hidden
                >
                    {isFailure
                        ? <XCircle className="w-48 h-48" />
                        : isWarning
                            ? <AlertTriangle className="w-48 h-48" />
                            : <CheckCircle className="w-48 h-48" />
                    }
                </div>
                <div className="relative z-10 flex flex-col gap-4">
                    <div className="min-w-0">
                        <h2 className="text-xl font-semibold text-[var(--text-primary)] tracking-tight">
                            {data?.header?.title}
                        </h2>
                        <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-[var(--text-tertiary)]">
                            {data?.header?.duration && (
                                <span className="inline-flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5" /> {data.header.duration}
                                </span>
                            )}
                            {data?.header?.main_screens && (
                                <span className="inline-flex items-center gap-1.5 truncate max-w-[420px]">
                                    <Smartphone className="w-3.5 h-3.5" /> {data.header.main_screens}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-wrap items-end gap-5">
                        <div className="space-y-1">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-primary)]">Status</p>
                            <StatusPill
                                tone={isFailure ? "danger" : isWarning ? "warning" : "success"}
                                label={derivedStatus}
                            />
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-primary)]">Platform</p>
                            <StatusPill tone={isLocal ? "warning" : "info"} label={isLocal ? "Local AI" : "Cloud AI"} />
                        </div>
                    </div>
                </div>
            </section>

            {/* Summary */}
            <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
                <p className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">Summary</p>
                <p className="text-[var(--text-primary)] text-sm leading-relaxed">
                    {summaryDescription}
                </p>
                <div className="flex flex-wrap gap-2 mt-4">
                    <CountChip tone="success" label="Successes" value={data?.success_analysis?.length || 0} />
                    <CountChip tone="danger"  label="Errors"    value={visibleErrors.length} />
                    <CountChip tone="warning" label="Warnings"  value={warnings.length} />
                </div>
            </section>

            {/* Worked / Attention Points */}
            {(summaryWorked.length > 0 || summaryIssues.length > 0 || summaryLegacy) && (
                <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
                        <h3 className="text-xs font-medium text-[var(--success)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                            <CheckCircle className="w-3.5 h-3.5" /> What Worked
                        </h3>
                        {summaryWorked.length > 0 ? (
                            <ul className="space-y-2">
                                {summaryWorked.map((item: string, i: number) => (
                                    <li key={i} className="text-sm text-[var(--text-primary)] flex items-start gap-2">
                                        <span className="text-[var(--success)] mt-1.5">•</span> {item}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-[var(--text-muted)] italic">No clear successes listed.</p>
                        )}
                    </div>

                    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
                        <h3 className="text-xs font-medium text-[var(--danger)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                            <XCircle className="w-3.5 h-3.5" /> Attention Points
                        </h3>
                        {summaryIssues.length > 0 ? (
                            <ul className="space-y-2">
                                {summaryIssues.map((item: string, i: number) => (
                                    <li key={i} className="text-sm text-[var(--text-primary)] flex items-start gap-2">
                                        <span className="text-[var(--danger)] mt-1.5">•</span> {item}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-[var(--text-muted)] italic">
                                {isFailure ? "See detailed errors." : "No critical issues detected."}
                            </p>
                        )}
                    </div>
                </section>
            )}

            {summaryLegacy && (
                <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-[var(--text-secondary)] text-sm">
                    {summaryLegacy}
                </section>
            )}
        </div>
    )
}

/* ---------- FLOW ---------- */
function FlowSection({ data }: { data: any }) {
    const [expanded, setExpanded] = useState<number[]>([])
    const toggle = (i: number) =>
        setExpanded(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])

    if (!data?.reconstructed_flow?.length) {
        return <EmptyState message="No flow reconstructed for this session." />
    }

    return (
        <div className="relative pl-6 space-y-3 border-l border-[var(--border)] ml-2 py-1">
            {data.reconstructed_flow.map((sec: any, idx: number) => {
                const isAggregated = !!sec.steps
                const title = isAggregated ? sec.section : sec.phase
                const summary = isAggregated ? sec.summary : sec.narrative
                let status = sec.status || (isAggregated ? "NORMAL" : (sec.type || "NORMAL"))

                if (isAggregated && Array.isArray(sec.steps) && sec.steps.length > 0) {
                    if (sec.steps.some((s: any) => s.type === 'ERROR')) status = 'ERROR'
                    else if (sec.steps.some((s: any) => s.type === 'SUCCESS')) status = 'SUCCESS'
                    else status = 'NORMAL'
                }

                const tone = statusTone(status)
                const isExpanded = expanded.includes(idx)
                const isFeedback = title?.toLowerCase().includes('feedback') || sec.steps?.some((s: any) => s.type === 'FEEDBACK')

                return (
                    <div key={idx} className="relative">
                        <span className={`absolute -left-[27px] top-4 w-3 h-3 rounded-full ring-4 ring-[var(--background)] z-10 ${tone.dot}`} />
                        <div className="border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--surface)]">
                            <button
                                onClick={() => toggle(idx)}
                                className="w-full p-4 text-left flex items-start justify-between hover:bg-[var(--surface-hover)] transition-colors"
                            >
                                <div className="space-y-1 flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className={`font-medium text-sm ${tone.text}`}>{title}</h3>
                                        {status !== 'NORMAL' && (
                                            <span className={`text-[10px] font-mono shrink-0 border rounded-full px-1.5 py-0.5 ${tone.chip}`}>
                                                {status}
                                            </span>
                                        )}
                                        {isFeedback && (
                                            <MessageSquare className="w-3 h-3 text-[var(--accent)] shrink-0" />
                                        )}
                                    </div>
                                    <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">{summary}</p>
                                </div>
                                <ChevronDown className={`w-4 h-4 text-[var(--text-muted)] shrink-0 mt-0.5 ml-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>

                            {isExpanded && (
                                <div className="border-t border-[var(--border)] bg-[var(--surface-2)]/50 p-4">
                                    {isAggregated ? (
                                        <div className="relative ml-2 space-y-4 border-l border-[var(--border)] pl-5 py-1">
                                            {sec.steps?.map((step: any, sIdx: number) => {
                                                const stepTone = statusTone(step.type === 'PERSISTENT_WARNING' ? 'PERSISTENT_WARNING' : step.type)
                                                return (
                                                    <div key={sIdx} className="relative">
                                                        <div className={`absolute -left-[21px] top-1.5 w-2 h-2 rounded-full ring-4 ring-[var(--surface-2)] ${stepTone.dot}`} />
                                                        <div className="flex flex-col sm:flex-row gap-1 sm:gap-3 items-start">
                                                            <span className="font-mono text-[10px] text-[var(--text-muted)] shrink-0 mt-0.5">
                                                                {step.timestamp || "—"}
                                                            </span>
                                                            <p className={`text-xs leading-relaxed ${stepTone.text}`}>{step.description}</p>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {sec.key_actions?.map((act: string, k: number) => (
                                                <div key={k} className="text-xs text-[var(--text-secondary)] flex items-start gap-2">
                                                    <span className="w-1 h-1 rounded-full bg-[var(--text-muted)] mt-1.5 shrink-0" />
                                                    {act}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

/* ---------- ERRORS ---------- */
function ErrorsSection({ data }: { data: any }) {
    if (!data?.error_analysis?.length) {
        return (
            <EmptyState
                icon={<CheckCircle className="w-10 h-10 text-[var(--success)]" />}
                message="No explicit errors detected in this session."
            />
        )
    }
    return (
        <div className="grid gap-3">
            {data.error_analysis.map((error: any, index: number) => {
                const isPersistent = error.type === 'PERSISTENT_WARNING'
                const isCritical = error.type?.includes('CRITICAL') || error.type?.includes('FUNCTIONAL')
                const tone = isPersistent ? "info" : isCritical ? "danger" : "warning"

                return (
                    <div key={index} className={`rounded-xl border ${toneBorder(tone)} bg-[var(--surface)] p-5`}>
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2">
                                {tone === 'danger' && <AlertCircle className="w-4 h-4 text-[var(--danger)]" />}
                                {tone === 'warning' && <AlertTriangle className="w-4 h-4 text-[var(--warning)]" />}
                                {tone === 'info' && <AlertTriangle className="w-4 h-4 text-[var(--info)]" />}
                                <h4 className="text-sm font-semibold text-[var(--text-primary)]">{error.type}</h4>
                                {isPersistent && <span className="text-[10px] text-[var(--text-muted)]">(Ignored as Error)</span>}
                            </div>
                            {error.timestamp && (
                                <span className="font-mono text-xs text-[var(--text-tertiary)] bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-0.5">
                                    {error.timestamp}
                                </span>
                            )}
                        </div>
                        {error.ocr_text && (
                            <pre className="mt-3 font-mono text-xs text-[var(--text-secondary)] bg-[var(--surface-2)] border border-[var(--border)] rounded-md p-2.5 whitespace-pre-wrap">
                                OCR: &ldquo;{error.ocr_text}&rdquo;
                            </pre>
                        )}
                        {error.analysis && (
                            <p className="mt-3 text-sm text-[var(--text-primary)] leading-relaxed">{error.analysis}</p>
                        )}
                    </div>
                )
            })}
        </div>
    )
}

/* ---------- SUCCESSES ---------- */
function SuccessesSection({ data }: { data: any }) {
    if (!data?.success_analysis?.length) return <EmptyState message="No specific success actions detected." />
    return (
        <div className="grid gap-3">
            {data.success_analysis.map((s: any, i: number) => (
                <div key={i} className={`rounded-xl border ${toneBorder("success")} bg-[var(--surface)] p-5`}>
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-[var(--success)]" />
                            <h4 className="text-sm font-semibold text-[var(--text-primary)]">{s.action}</h4>
                        </div>
                        {s.timestamp && (
                            <span className="font-mono text-xs text-[var(--text-tertiary)] bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-0.5">
                                {s.timestamp}
                            </span>
                        )}
                    </div>
                    {s.ocr_text && (
                        <pre className="mt-3 font-mono text-xs text-[var(--text-secondary)] bg-[var(--surface-2)] border border-[var(--border)] rounded-md p-2.5 whitespace-pre-wrap">
                            OCR: &ldquo;{s.ocr_text}&rdquo;
                        </pre>
                    )}
                    {s.details && <p className="mt-3 text-sm text-[var(--text-primary)] leading-relaxed">{s.details}</p>}
                </div>
            ))}
        </div>
    )
}

/* ---------- UX ---------- */
function UXSection({ data }: { data: any }) {
    if (!data?.ux_analysis?.length) return <EmptyState message="No specific UX insights for this session." />
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.ux_analysis.map((insight: any, i: number) => {
                const isOk = insight.status === "OK"
                const tone = isOk ? "success" : "warning"
                return (
                    <div key={i} className={`rounded-xl border ${toneBorder(tone)} bg-[var(--surface)] p-5`}>
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2">
                                {isOk
                                    ? <CheckCircle className="w-4 h-4 text-[var(--success)]" />
                                    : <Lightbulb className="w-4 h-4 text-[var(--warning)]" />
                                }
                                <h4 className="text-sm font-semibold text-[var(--text-primary)]">{insight.heuristic}</h4>
                            </div>
                            <StatusPill tone={tone} label={insight.status} />
                        </div>
                        {insight.observation && (
                            <p className="mt-3 text-sm text-[var(--text-primary)] leading-relaxed">{insight.observation}</p>
                        )}
                        {!isOk && insight.recommendation && (
                            <div className="mt-3 p-3 rounded-lg bg-[var(--warning-soft)] border border-[color:color-mix(in_oklab,var(--warning)_30%,transparent)] text-[var(--warning)] flex gap-2">
                                <Activity className="h-4 w-4 shrink-0 mt-0.5" />
                                <span className="text-sm">{insight.recommendation}</span>
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}

/* ---------- FEEDBACK ---------- */
function FeedbackSection({ session }: { session: any }) {
    const events = session.events?.filter((e: any) => e.action === 'USER_FEEDBACK') ?? []
    if (events.length === 0) {
        return (
            <EmptyState
                icon={<MessageSquare className="w-10 h-10 text-[var(--accent)]/60" />}
                message="No user feedback collected in this session."
            />
        )
    }

    return (
        <div className="space-y-3">
            {events.map((event: any, i: number) => {
                let tag = "Feedback"
                let comment = event.comment || event.ocr_text || ""
                if (comment.includes(": ")) {
                    const parts = comment.split(": ")
                    tag = parts[0]
                    comment = parts.slice(1).join(": ")
                } else if (["feature not working", "information not clear", "that's cool!"].includes(comment.toLowerCase())) {
                    tag = comment
                    comment = ""
                }

                return (
                    <div key={i} className="rounded-xl border border-[color:color-mix(in_oklab,var(--accent)_30%,transparent)] bg-[var(--surface)] p-5">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2 text-[var(--accent)]">
                                <MessageSquare className="w-4 h-4" />
                                <h4 className="text-sm font-semibold">{tag}</h4>
                            </div>
                            <span className="font-mono text-xs text-[var(--text-tertiary)] bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-0.5">
                                {new Date(event.timestamp * 1000).toLocaleTimeString()}
                            </span>
                        </div>
                        {comment && <p className="mt-3 text-sm italic text-[var(--text-primary)]">&ldquo;{comment}&rdquo;</p>}
                        <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)] mt-3">
                            <Smartphone className="w-3 h-3" />
                            <span>{event.screen_name || "Unknown screen"}</span>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

/* ---------- TECH ---------- */
function TechSection({ data }: { data: any }) {
    return (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)] mb-4">
                <Code className="w-4 h-4 text-[var(--info)]" /> Technical Observations
            </h3>
            <div className="prose prose-sm max-w-none text-[var(--text-primary)] prose-headings:text-[var(--text-primary)] prose-p:text-[var(--text-secondary)] prose-strong:text-[var(--text-primary)] prose-code:text-[var(--accent)]">
                <ReactMarkdown>{data?.technical_notes || "No technical notes available."}</ReactMarkdown>
            </div>
        </div>
    )
}

/* ---------- TEST ---------- */
function TestSection({ data }: { data: any }) {
    return (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)] px-5 h-12 border-b border-[var(--border)]">
                <FileText className="w-4 h-4 text-[var(--text-tertiary)]" /> Maestro Test Script (YAML)
            </div>
            <pre className="font-mono text-xs text-[var(--success)] overflow-x-auto p-5 bg-[var(--surface-2)]/40">
                {data?.maestro_yaml || "# No test generated"}
            </pre>
        </div>
    )
}

/* ---------- helpers ---------- */
function StatusPill({ tone, label }: { tone: "success" | "danger" | "warning" | "info"; label: string }) {
    const map = {
        success: "text-[var(--success)] bg-[var(--success-soft)] border-[color:color-mix(in_oklab,var(--success)_30%,transparent)]",
        danger:  "text-[var(--danger)] bg-[var(--danger-soft)] border-[color:color-mix(in_oklab,var(--danger)_30%,transparent)]",
        warning: "text-[var(--warning)] bg-[var(--warning-soft)] border-[color:color-mix(in_oklab,var(--warning)_30%,transparent)]",
        info:    "text-[var(--info)] bg-[var(--info-soft)] border-[color:color-mix(in_oklab,var(--info)_30%,transparent)]",
    }
    return (
        <span className={`text-[11px] font-medium border rounded-full px-2 py-0.5 ${map[tone]}`}>
            {label}
        </span>
    )
}

function CountChip({ tone, label, value }: { tone: "success" | "danger" | "warning" | "info"; label: string; value: number }) {
    const map = {
        success: "text-[var(--success)] border-[color:color-mix(in_oklab,var(--success)_30%,transparent)]",
        danger:  "text-[var(--danger)] border-[color:color-mix(in_oklab,var(--danger)_30%,transparent)]",
        warning: "text-[var(--warning)] border-[color:color-mix(in_oklab,var(--warning)_30%,transparent)]",
        info:    "text-[var(--info)] border-[color:color-mix(in_oklab,var(--info)_30%,transparent)]",
    }
    return (
        <span className={`inline-flex items-center gap-1.5 text-xs border rounded-full px-2 py-0.5 ${map[tone]}`}>
            <span className="font-semibold tabular-nums">{value}</span>
            <span className="text-[var(--text-tertiary)]">{label}</span>
        </span>
    )
}

function statusTone(status: string) {
    switch (status) {
        case "ERROR":
        case "FAIL":
        case "FAILED":
            return { dot: "bg-[var(--danger)]", text: "text-[var(--danger)]", chip: "text-[var(--danger)] border-[color:color-mix(in_oklab,var(--danger)_30%,transparent)]" }
        case "SUCCESS":
            return { dot: "bg-[var(--success)]", text: "text-[var(--success)]", chip: "text-[var(--success)] border-[color:color-mix(in_oklab,var(--success)_30%,transparent)]" }
        case "PERSISTENT_WARNING":
            return { dot: "bg-[var(--warning)]", text: "text-[var(--warning)]", chip: "text-[var(--warning)] border-[color:color-mix(in_oklab,var(--warning)_30%,transparent)]" }
        case "FEEDBACK":
            return { dot: "bg-[var(--accent)]", text: "text-[var(--accent)]", chip: "text-[var(--accent)] border-[color:color-mix(in_oklab,var(--accent)_30%,transparent)]" }
        default:
            return { dot: "bg-[var(--text-tertiary)]", text: "text-[var(--text-primary)]", chip: "text-[var(--text-tertiary)] border-[var(--border)]" }
    }
}

function toneBorder(tone: "success" | "danger" | "warning" | "info") {
    const map = {
        success: "border-[color:color-mix(in_oklab,var(--success)_30%,transparent)]",
        danger:  "border-[color:color-mix(in_oklab,var(--danger)_30%,transparent)]",
        warning: "border-[color:color-mix(in_oklab,var(--warning)_30%,transparent)]",
        info:    "border-[color:color-mix(in_oklab,var(--info)_30%,transparent)]",
    }
    return map[tone]
}

function EmptyState({ icon, message }: { icon?: React.ReactNode; message: string }) {
    return (
        <div className="rounded-xl border border-dashed border-[var(--border)] py-16 px-6 text-center">
            {icon && <div className="mx-auto mb-4 flex justify-center">{icon}</div>}
            <p className="text-sm text-[var(--text-tertiary)]">{message}</p>
        </div>
    )
}
