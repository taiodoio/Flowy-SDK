"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { ArrowRight, FileText, BarChart3, Smartphone, CheckCircle, XCircle, Minus, Sparkles } from "lucide-react"

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-background text-foreground font-sans">

            {/* Header */}
            <header className="border-b border-[var(--border)] sticky top-0 z-50 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
                <div className="container mx-auto px-6 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-md bg-[var(--accent)] grid place-items-center text-[var(--accent-foreground)]">
                            <Sparkles className="h-3.5 w-3.5" />
                        </div>
                        <span className="font-semibold tracking-tight">Flowy</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <ThemeToggle />
                        <Link href="/dashboard">
                            <Button variant="outline" size="sm" className="gap-1.5">
                                Dashboard <ArrowRight className="w-3.5 h-3.5" />
                            </Button>
                        </Link>
                    </div>
                </div>
            </header>

            {/* Hero */}
            <section className="container mx-auto px-6 pt-24 pb-20">
                <div className="max-w-3xl">
                    <p className="text-xs font-mono text-[var(--text-tertiary)] mb-6 uppercase tracking-[0.18em]">Session Analysis</p>
                    <h1 className="text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.05] mb-6 text-[var(--text-primary)]">
                        Understand what users actually do in your app.
                    </h1>
                    <p className="text-lg text-[var(--text-secondary)] max-w-xl mb-10 leading-relaxed">
                        Flowy captures iOS session logs and turns them into structured reports with AI. See exact user flows, detect errors, and replay interactions with screenshots.
                    </p>
                    <div className="flex items-center gap-3">
                        <Link href="/dashboard">
                            <Button className="px-6">Open Dashboard</Button>
                        </Link>
                        <Button
                            variant="ghost"
                            className="text-[var(--text-secondary)] gap-1"
                            onClick={() => document.getElementById('comparison')?.scrollIntoView({ behavior: 'smooth' })}
                        >
                            See how it works
                        </Button>
                    </div>
                </div>
            </section>

            {/* Comparison */}
            <section id="comparison" className="border-t border-[var(--border)] bg-[var(--surface-2)]">
                <div className="container mx-auto px-6 py-20">
                    <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">How Flowy compares</h2>
                    <p className="text-[var(--text-tertiary)] text-sm mb-12">Three approaches to understanding session data.</p>

                    <div className="grid md:grid-cols-3 gap-px bg-[var(--border)] border border-[var(--border)] rounded-xl overflow-hidden">

                        {/* Raw Logs */}
                        <div className="bg-[var(--surface)] p-7">
                            <div className="w-9 h-9 rounded-lg border border-[var(--border)] flex items-center justify-center mb-5">
                                <FileText className="w-4 h-4 text-[var(--text-tertiary)]" />
                            </div>
                            <h3 className="font-semibold text-[var(--text-primary)] mb-2">Raw Logs</h3>
                            <p className="text-sm text-[var(--text-tertiary)] leading-relaxed mb-6">
                                JSON blobs and text files. Precise, but unreadable by humans without significant effort.
                            </p>
                            <ul className="space-y-2.5 text-sm">
                                <FeatureRow status="no" label="Human readable" />
                                <FeatureRow status="no" label="Visual flow" />
                                <FeatureRow status="no" label="Error context" />
                                <FeatureRow status="yes" label="Complete data" />
                            </ul>
                        </div>

                        {/* Analytics tools */}
                        <div className="bg-[var(--surface)] p-7">
                            <div className="w-9 h-9 rounded-lg border border-[var(--border)] flex items-center justify-center mb-5">
                                <BarChart3 className="w-4 h-4 text-[var(--text-tertiary)]" />
                            </div>
                            <h3 className="font-semibold text-[var(--text-primary)] mb-2">Analytics Platforms</h3>
                            <p className="text-sm text-[var(--text-tertiary)] leading-relaxed mb-6">
                                Funnels, charts, aggregate metrics. Good for trends, blind to individual session problems.
                            </p>
                            <ul className="space-y-2.5 text-sm">
                                <FeatureRow status="partial" label="Human readable" />
                                <FeatureRow status="no" label="Visual flow" />
                                <FeatureRow status="no" label="Error context" />
                                <FeatureRow status="yes" label="Complete data" />
                            </ul>
                        </div>

                        {/* Flowy */}
                        <div className="bg-[var(--surface)] p-7 relative">
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--accent)]" />
                            <div className="w-9 h-9 rounded-lg bg-[var(--accent-soft)] flex items-center justify-center mb-5">
                                <Smartphone className="w-4 h-4 text-[var(--accent)]" />
                            </div>
                            <div className="flex items-center gap-2 mb-2">
                                <h3 className="font-semibold text-[var(--text-primary)]">Flowy</h3>
                                <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--accent)] bg-[var(--accent-soft)] rounded-full px-2 py-0.5">This</span>
                            </div>
                            <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-6">
                                AI reconstructs the session narrative. Errors, successes, screen flows, and UX insights from raw events.
                            </p>
                            <ul className="space-y-2.5 text-sm">
                                <FeatureRow status="yes" label="Human readable" />
                                <FeatureRow status="yes" label="Visual flow" />
                                <FeatureRow status="yes" label="Error context" />
                                <FeatureRow status="yes" label="Complete data" />
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-[var(--border)]">
                <div className="container mx-auto px-6 py-8 flex items-center justify-between">
                    <span className="text-sm text-[var(--text-muted)]">Flowy — 2026</span>
                    <Link href="/dashboard">
                        <Button variant="ghost" size="sm" className="text-[var(--text-tertiary)] gap-1.5">
                            Open Dashboard <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                    </Link>
                </div>
            </footer>
        </div>
    )
}

function FeatureRow({ status, label }: { status: "yes" | "no" | "partial"; label: string }) {
    return (
        <li className="flex items-center gap-2.5">
            {status === "yes" && <CheckCircle className="w-3.5 h-3.5 text-[var(--success)] flex-shrink-0" />}
            {status === "no" && <XCircle className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" />}
            {status === "partial" && <Minus className="w-3.5 h-3.5 text-[var(--warning)] flex-shrink-0" />}
            <span className={status === "yes" ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}>{label}</span>
        </li>
    )
}
