"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import ReactMarkdown from "react-markdown"
import { AlertCircle, CheckCircle, Clock, Smartphone, Code, Lightbulb, Activity, AlertTriangle, FileText, ChevronDown, ChevronUp, XCircle } from "lucide-react"

import { FlowGraph } from "@/components/flow-graph"
import { LayoutGrid, Tag as TagIcon, Plus } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useState } from "react"

interface ReportProps {
    report: any
    session: any
    onToggleApproval?: (id: string, isApproved: boolean) => void
    onUpdateTags?: (id: string, tags: string[]) => void
}

export function AnalysisReport({ report, session, onToggleApproval, onUpdateTags }: ReportProps) {
    const [newTag, setNewTag] = useState("")
    const [expandedSections, setExpandedSections] = useState<number[]>([])

    if (!report) return null

    if (report.error) {
        return (
            <div className="p-6 rounded-xl border border-red-500/20 bg-red-500/10 text-red-500 animate-in fade-in">
                <h3 className="text-lg font-bold flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" /> Analysis Failed
                </h3>
                <p className="mt-2">{report.error}</p>
                <p className="text-sm opacity-70 mt-1">Check the server logs or API key.</p>
            </div>
        )
    }

    // Adapt to potential legacy format if API returns old structure during transition
    const data = report.header ? report : {
        header: {
            title: report.overview || "Session Analysis",
            duration: report.stats?.duration || "-",
            status_text: report.status || "UNKNOWN",
            main_screens: report.stats?.screens_visited?.join(" -> ") || ""
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
    };

    const headerStatus = data.header?.status_text || "UNKNOWN"

    // Logic: Status Hierarchy
    // FAILED only if FUNCTIONAL_ERROR exists or explicitly FAILED.
    // WARNINGS are acceptable.
    const isFunctionalFailure = headerStatus.toLowerCase().includes("failed") ||
        headerStatus.toLowerCase().includes("error"); // Simplified check, relying on prompt

    const statusColor = isFunctionalFailure
        ? "bg-red-500/10 text-red-500 border-red-500/20"
        : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"; // Green by default now for Success/Warnings

    // Overview Splitting (Handle legacy string vs new Object)
    const summaryWorked = data.executive_summary?.worked || []
    const summaryIssues = data.executive_summary?.issues || []
    const summaryLegacy = typeof data.executive_summary === 'string' ? data.executive_summary : null

    // Handler for adding a tag
    const handleAddTag = () => {
        if (!newTag.trim() || !onUpdateTags) return
        const currentTags = session.tags || []
        if (!currentTags.includes(newTag.trim())) {
            onUpdateTags(session.id, [...currentTags, newTag.trim()])
        }
        setNewTag("")
    }

    // Helper for Accordion
    const toggleSection = (idx: number) => {
        setExpandedSections(prev =>
            prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
        )
    }

    return (
        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-700">
            {/* Header Section */}
            <div className="space-y-4">
                <div className={`p-6 rounded-xl border ${statusColor} backdrop-blur-sm`}>
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div>
                            <h2 className="text-2xl font-bold flex items-center gap-3">
                                {data.header?.title}
                            </h2>
                            <div className="flex flex-wrap items-center gap-4 mt-2 text-muted-foreground">
                                <span className="flex items-center gap-1.5 bg-secondary/50 px-2 py-1 rounded-md text-sm">
                                    <Clock className="w-4 h-4" /> {data.header?.duration}
                                </span>
                                <span className="flex items-center gap-1.5 bg-secondary/50 px-2 py-1 rounded-md text-sm">
                                    <Smartphone className="w-4 h-4" /> {data.header?.main_screens}
                                </span>
                                {data.header?.deduced_section && (
                                    <span className="flex items-center gap-1.5 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2 py-1 rounded-md text-sm">
                                        <TagIcon className="w-3 h-3" /> {data.header.deduced_section}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* RIGHT SIDE ACTIONS */}
                        <div className="flex flex-col items-end gap-3">
                            <Badge variant="outline" className={`text-sm px-3 py-1 ${statusColor}`}>
                                {headerStatus}
                            </Badge>
                        </div>
                    </div>
                </div>

                {/* Session Overview (Split) */}
                {(summaryWorked.length > 0 || summaryIssues.length > 0 || summaryLegacy) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* What Worked (Green) */}
                        <div className="bg-emerald-500/5 p-5 rounded-xl border border-emerald-500/10">
                            <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <CheckCircle className="w-4 h-4" /> What Worked
                            </h3>
                            {summaryWorked.length > 0 ? (
                                <ul className="space-y-2">
                                    {summaryWorked.map((item: string, i: number) => (
                                        <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                                            <span className="text-emerald-500/50 mt-1.5">•</span> {item}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-muted-foreground italic">
                                    {summaryLegacy ? "See summary below." : "No clear successes listed."}
                                </p>
                            )}
                        </div>

                        {/* Issues (Red) */}
                        <div className="bg-red-500/5 p-5 rounded-xl border border-red-500/10">
                            <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <XCircle className="w-4 h-4" /> Critical Issues
                            </h3>
                            {summaryIssues.length > 0 ? (
                                <ul className="space-y-2">
                                    {summaryIssues.map((item: string, i: number) => (
                                        <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                                            <span className="text-red-500/50 mt-1.5">•</span> {item}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-muted-foreground italic">
                                    {isFunctionalFailure ? "See detailed errors." : "No critical issues detected."}
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* Legacy Summary Fallback */}
                {summaryLegacy && (
                    <div className="bg-white/5 p-4 rounded-xl border border-white/10 text-slate-300 text-sm">
                        {summaryLegacy}
                    </div>
                )}
            </div>

            <Tabs defaultValue="visual" className="w-full">
                <TabsList className="grid w-full grid-cols-7 bg-slate-950/50 backdrop-blur-md p-1 border border-white/10 rounded-xl h-auto">
                    <TabsTrigger value="visual" className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-300 py-2.5">Visual Flow</TabsTrigger>
                    <TabsTrigger value="flow" className="data-[state=active]:bg-indigo-500/20 data-[state=active]:text-indigo-300 py-2.5">User Flow</TabsTrigger>
                    <TabsTrigger value="success" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-300 py-2.5">Success</TabsTrigger>
                    <TabsTrigger value="ux" className="data-[state=active]:bg-green-500/20 data-[state=active]:text-green-300 py-2.5">UX Insights</TabsTrigger>
                    <TabsTrigger value="errors" className="data-[state=active]:bg-red-500/20 data-[state=active]:text-red-300 py-2.5">Errors</TabsTrigger>
                    <TabsTrigger value="tech" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-300 py-2.5">Tech</TabsTrigger>
                    <TabsTrigger value="test" className="data-[state=active]:bg-slate-500/20 data-[state=active]:text-slate-300 py-2.5">Testing</TabsTrigger>
                </TabsList>

                {/* Visual Flow Tab - MOVED HERE */}
                <TabsContent value="visual" className="mt-6 animate-in fade-in zoom-in-95 duration-300">
                    <FlowGraph session={session} />
                </TabsContent>

                {/* User Flow Tab */}
                {/* User Flow Tab */}
                <TabsContent value="flow" className="mt-6">
                    <div className="relative pl-8 space-y-6 border-l-2 border-slate-800/50 ml-4 py-2">
                        {data.reconstructed_flow?.map((section: any, idx: number) => {
                            const isAggregated = !!section.steps;
                            const title = isAggregated ? section.section : section.phase;
                            const summary = isAggregated ? section.summary : section.narrative;

                            // Default Fallback
                            let status = section.status || (isAggregated ? "NORMAL" : (section.type || "NORMAL"));

                            // STRICT DERIVATION FROM STEPS (If available)
                            // This ensures the visual header matches the actual content content (dots).
                            if (isAggregated && section.steps && Array.isArray(section.steps) && section.steps.length > 0) {
                                const hasError = section.steps.some((s: any) => s.type === 'ERROR');
                                const hasSuccess = section.steps.some((s: any) => s.type === 'SUCCESS');

                                if (hasError) {
                                    status = 'ERROR';
                                } else if (hasSuccess) {
                                    status = 'SUCCESS';
                                } else {
                                    // If no explicit success or error steps, force NORMAL even if backend said SUCCESS
                                    status = 'NORMAL';
                                }
                            }

                            // Status Colors for Header
                            let headerBorder = 'border-slate-800';
                            let headerText = 'text-slate-200';
                            let headerBg = 'bg-slate-900/50';
                            let dotColor = 'bg-slate-700 border-slate-950'; // Default Normal Dot

                            if (status === 'ERROR' || status.includes('FAIL')) {
                                headerBorder = 'border-red-500/30';
                                headerText = 'text-red-300';
                                headerBg = 'bg-red-500/10';
                                dotColor = 'bg-red-500 border-red-900 animate-pulse';
                            } else if (status === 'SUCCESS') {
                                headerBorder = 'border-emerald-500/30';
                                headerText = 'text-emerald-300';
                                headerBg = 'bg-emerald-500/10';
                                dotColor = 'bg-emerald-500 border-emerald-900';
                            } else {
                                // Explicit visual for Normal
                                dotColor = 'bg-slate-600 border-slate-900';
                            }

                            const isExpanded = expandedSections.includes(idx);

                            return (
                                <div key={idx} className="relative">
                                    {/* Main Timeline Dot */}
                                    <div className={`absolute -left-[43px] top-6 w-5 h-5 rounded-full border-4 ${dotColor} shadow-lg z-10 transition-colors duration-300`} />

                                    <div className={`rounded-xl border ${headerBorder} overflow-hidden transition-all duration-300 bg-black/20`}>
                                        {/* Accordion Header */}
                                        <div
                                            onClick={() => toggleSection(idx)}
                                            className={`p-4 ${headerBg} cursor-pointer flex items-start justify-between hover:bg-white/5 transition-colors`}
                                        >
                                            <div className="space-y-1">
                                                <h3 className={`font-bold text-base ${headerText} flex items-center gap-2`}>
                                                    {title}
                                                    {status !== 'NORMAL' && (
                                                        <Badge variant="outline" className={`text-[10px] h-5 px-1.5 ${headerText} ${headerBorder}`}>
                                                            {status}
                                                        </Badge>
                                                    )}
                                                </h3>
                                                <p className="text-sm text-muted-foreground">{summary}</p>
                                            </div>
                                            <div className={`mt-1 text-slate-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                                                <ChevronDown className="w-5 h-5" />
                                            </div>
                                        </div>

                                        {/* Accordion Body (Steps) */}
                                        {isExpanded && (
                                            <div className="bg-black/20 p-4 border-t border-white/5 animate-in slide-in-from-top-2">
                                                {isAggregated ? (
                                                    <div className="relative ml-2 space-y-5 border-l border-white/10 pl-6 py-2">
                                                        {section.steps?.map((step: any, sIdx: number) => {
                                                            const isError = step.type === 'ERROR';
                                                            const isSuccess = step.type === 'SUCCESS';

                                                            let innerDotColor = 'bg-slate-600 border-slate-900';
                                                            let innerTextColor = 'text-slate-300';

                                                            if (isError) {
                                                                innerDotColor = 'bg-red-500 border-red-900';
                                                                innerTextColor = 'text-red-300';
                                                            } else if (isSuccess) {
                                                                innerDotColor = 'bg-emerald-500 border-emerald-900';
                                                                innerTextColor = 'text-emerald-300';
                                                            } else {
                                                                // Normal Step
                                                                innerDotColor = 'bg-slate-500 border-slate-800';
                                                            }

                                                            return (
                                                                <div key={sIdx} className="relative group">
                                                                    {/* Inner Timeline Dot */}
                                                                    <div className={`absolute -left-[29px] top-1.5 w-3 h-3 rounded-full border-2 ${innerDotColor} shadow-sm z-10`} />

                                                                    <div className="flex flex-col sm:flex-row gap-1 sm:gap-4 items-start">
                                                                        {/* Timestamp */}
                                                                        <div className="font-mono text-[10px] text-slate-500 mt-1 shrink-0 bg-white/5 px-1.5 py-0.5 rounded border border-white/5 w-fit sm:w-24 overflow-hidden text-ellipsis whitespace-nowrap">
                                                                            {step.timestamp || "00:00"}
                                                                        </div>

                                                                        {/* Description */}
                                                                        <div className="space-y-1">
                                                                            <p className={`text-sm leading-relaxed font-medium ${innerTextColor}`}>
                                                                                {step.description}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                ) : (
                                                    <div className="text-sm text-slate-400 pl-2">
                                                        {section.key_actions?.map((act: string, k: number) => (
                                                            <div key={k} className="mb-2 relative pl-4">
                                                                <span className="absolute left-0 top-2 w-1.5 h-1.5 rounded-full bg-slate-600"></span>
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
                </TabsContent>

                {/* Success Tab - NEW */}
                <TabsContent value="success" className="mt-6">
                    {data.success_analysis?.length > 0 ? (
                        <div className="grid gap-4">
                            {data.success_analysis.map((success: any, index: number) => (
                                <Card key={index} className="border-l-4 border-l-emerald-500 bg-emerald-500/5">
                                    <CardHeader className="pb-2">
                                        <div className="flex justify-between items-center">
                                            <CardTitle className="text-base font-bold flex items-center gap-2 text-emerald-400">
                                                <CheckCircle className="h-5 w-5" />
                                                {success.action}
                                            </CardTitle>
                                            <span className="font-mono text-xs text-emerald-300/70 bg-emerald-900/30 px-2 py-1 rounded">
                                                {success.timestamp}
                                            </span>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        {success.ocr_text && (
                                            <div className="bg-black/30 p-2 rounded-md font-mono text-xs text-emerald-200 border border-emerald-500/20 inline-block">
                                                OCR: "{success.ocr_text}"
                                            </div>
                                        )}
                                        <p className="text-sm text-slate-300">{success.details}</p>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-muted-foreground">
                            <p>No specific success actions detected.</p>
                        </div>
                    )}
                </TabsContent>

                {/* Error Analysis Tab */}
                <TabsContent value="errors" className="mt-6">
                    {data.error_analysis?.length > 0 ? (
                        <div className="grid gap-4">
                            {data.error_analysis.map((error: any, index: number) => {
                                const isPersistent = error.type === 'PERSISTENT_WARNING';
                                const isCritical = error.type.includes('CRITICAL') || error.type.includes('FUNCTIONAL');

                                let borderClass = 'border-l-yellow-500';
                                if (isCritical) borderClass = 'border-l-red-500';
                                if (isPersistent) borderClass = 'border-l-blue-500'; // Blue for persistent/info

                                return (
                                    <Card key={index} className={`border-l-4 ${borderClass} ${isPersistent ? 'opacity-80' : ''}`}>
                                        <CardHeader className="pb-2">
                                            <div className="flex justify-between items-center">
                                                <CardTitle className="text-base font-bold flex items-center gap-2">
                                                    {isCritical && <AlertCircle className="text-red-500 h-5 w-5" />}
                                                    {!isCritical && !isPersistent && <AlertTriangle className="text-yellow-500 h-5 w-5" />}
                                                    {isPersistent && <AlertTriangle className="text-blue-500 h-5 w-5" />}

                                                    {error.type} {isPersistent && <span className="text-xs font-normal text-muted-foreground ml-2">(Ignored as Error)</span>}
                                                </CardTitle>
                                                <span className="font-mono text-xs text-muted-foreground bg-secondary px-2 py-1 rounded">
                                                    {error.timestamp}
                                                </span>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            {error.ocr_text && (
                                                <div className={`bg-black/30 p-3 rounded-md font-mono text-xs border ${isPersistent ? 'border-blue-500/20 text-blue-200' : 'border-red-500/20 text-red-200'}`}>
                                                    OCR: "{error.ocr_text}"
                                                </div>
                                            )}
                                            <p className="text-sm">{error.analysis}</p>
                                        </CardContent>
                                    </Card>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-muted-foreground">
                            <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500/50" />
                            <p>No explicit errors detected in this session.</p>
                        </div>
                    )}
                </TabsContent>

                {/* UX Insights Tab - NEW */}
                <TabsContent value="ux" className="mt-6">
                    {data.ux_analysis?.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {data.ux_analysis.map((insight: any, index: number) => {
                                const isOk = insight.status === "OK";
                                return (
                                    <Card key={index} className={`border-l-4 ${isOk ? 'border-l-green-500' : 'border-l-orange-500'} bg-transparent`}>
                                        <CardHeader className="pb-2">
                                            <div className="flex justify-between items-start gap-4">
                                                <CardTitle className="text-base font-bold flex items-center gap-2">
                                                    {isOk ? <CheckCircle className="text-green-500 h-5 w-5" /> : <Lightbulb className="text-orange-500 h-5 w-5" />}
                                                    {insight.heuristic}
                                                </CardTitle>
                                                <Badge variant="outline" className={`${isOk ? 'text-green-500 border-green-500/30' : 'text-orange-500 border-orange-500/30'}`}>
                                                    {insight.status}
                                                </Badge>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-2 text-sm">
                                            <p className="text-slate-300">{insight.observation}</p>
                                            {!isOk && insight.recommendation && (
                                                <div className="mt-3 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-200 flex gap-2">
                                                    <Activity className="h-4 w-4 shrink-0 mt-0.5" />
                                                    <span>{insight.recommendation}</span>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-muted-foreground">
                            <p>No specific UX insights available for this session.</p>
                        </div>
                    )}
                </TabsContent>

                {/* Technical Notes Tab */}
                <TabsContent value="tech" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Code className="w-5 h-5 text-blue-400" /> Technical Observations
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="prose dark:prose-invert">
                            <ReactMarkdown>{data.technical_notes || "No technical notes available."}</ReactMarkdown>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Maestro Test Tab */}
                <TabsContent value="test" className="mt-6">
                    <Card className="bg-slate-950 border-slate-800">
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                                <FileText className="w-4 h-4" /> Maestro Test Script (YAML)
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <pre className="font-mono text-xs text-green-400 overflow-x-auto p-4 rounded-lg bg-black/50 border border-white/5">
                                {data.maestro_yaml || "# No Test generated"}
                            </pre>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
