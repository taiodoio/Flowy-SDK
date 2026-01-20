"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { ArrowRight, LayoutDashboard, FileText, BarChart3, Fingerprint, Zap, Coffee } from "lucide-react"

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-purple-500/30 overflow-x-hidden">

            {/* Dynamic Background */}
            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-purple-600/20 blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-600/20 blur-[120px] animate-pulse delay-1000" />
                <div className="absolute top-[30%] left-[30%] w-[40%] h-[40%] rounded-full bg-pink-600/10 blur-[150px] animate-pulse delay-2000" />
            </div>

            {/* Header */}
            <header className="fixed top-0 w-full z-50 backdrop-blur-sm border-b border-white/5">
                <div className="container mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
                            <span className="font-bold text-white text-xl">F</span>
                        </div>
                        <span className="font-bold text-2xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">Flowy</span>
                    </div>

                    <Link href="/dashboard">
                        <Button variant="ghost" className="rounded-full hover:bg-white/10 gap-2">
                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-600 flex items-center justify-center border border-white/10">
                                <LayoutDashboard className="w-4 h-4 text-white" />
                            </div>
                            <span className="hidden sm:inline">Go to Dashboard</span>
                        </Button>
                    </Link>
                </div>
            </header>

            {/* Hero Section */}
            <section className="relative z-10 pt-32 pb-20 lg:pt-48 lg:pb-32 container mx-auto px-6 text-center">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                >
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-sm text-purple-300 mb-8 backdrop-blur-md">
                        <Zap className="w-4 h-4 fill-purple-300" />
                        <span>The Future of Session Analysis</span>
                    </div>

                    <h1 className="text-5xl lg:text-8xl font-black mb-6 tracking-tight leading-tight">
                        Stop guessing.<br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 animate-gradient-x">
                            Start Understanding.
                        </span>
                    </h1>

                    <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
                        Flowy transforms raw, chaotic session logs into beautiful, actionable user journeys using advanced AI. See exactly how users experience your app.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Button
                            size="lg"
                            className="h-14 px-8 text-lg rounded-full bg-white text-slate-950 hover:bg-purple-100 font-semibold shadow-xl shadow-purple-500/20"
                            onClick={() => document.getElementById('comparison')?.scrollIntoView({ behavior: 'smooth' })}
                        >
                            Discover More
                        </Button>
                        <Link href="/dashboard">
                            <Button variant="outline" size="lg" className="h-14 px-8 text-lg rounded-full border-white/10 hover:bg-white/5 hover:text-white backdrop-blur-md">
                                Try Dashboard <ArrowRight className="ml-2 w-5 h-5" />
                            </Button>
                        </Link>
                    </div>
                </motion.div>
            </section>

            {/* Comparison Section */}
            <section id="comparison" className="relative z-10 py-24 bg-slate-900/40 backdrop-blur-sm border-t border-white/5">
                <div className="container mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl lg:text-4xl font-bold mb-4">Why Flowy is Different</h2>
                        <p className="text-slate-400 max-w-xl mx-auto">
                            Traditional tools give you data. Flowy gives you the story.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">

                        {/* Old Logs */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.1 }}
                            className="p-8 rounded-2xl bg-slate-800/20 border border-white/5 hover:border-white/10 transition-all text-slate-500 grayscale opacity-70 hover:opacity-100 hover:grayscale-0"
                        >
                            <div className="h-14 w-14 rounded-full bg-slate-800 flex items-center justify-center mb-6">
                                <FileText className="w-7 h-7" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-3">Classic Logs</h3>
                            <p className="text-sm leading-relaxed mb-4">
                                Raw JSON files. text blobs. Thousands of lines of unreadable code. Good for machines, terrible for humans.
                            </p>
                            <ul className="space-y-2 text-sm">
                                <li className="flex items-center gap-2"><span className="text-red-500">×</span> Hard to read</li>
                                <li className="flex items-center gap-2"><span className="text-red-500">×</span> Zero context</li>
                                <li className="flex items-center gap-2"><span className="text-red-500">×</span> Time consuming</li>
                            </ul>
                        </motion.div>

                        {/* Analytics */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.2 }}
                            className="p-8 rounded-2xl bg-slate-800/20 border border-white/5 hover:border-white/10 transition-all"
                        >
                            <div className="h-14 w-14 rounded-full bg-blue-900/20 flex items-center justify-center mb-6">
                                <BarChart3 className="w-7 h-7 text-blue-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-3">Traditional Analytics</h3>
                            <p className="text-sm text-slate-400 leading-relaxed mb-4">
                                Charts, graphs, and funnels. Great for aggregate data, but fails to show the individual user experience or specific bugs.
                            </p>
                            <ul className="space-y-2 text-sm text-slate-400">
                                <li className="flex items-center gap-2"><span className="text-yellow-500">~</span> Good for trends</li>
                                <li className="flex items-center gap-2"><span className="text-red-500">×</span> Complex Setup</li>
                                <li className="flex items-center gap-2"><span className="text-red-500">×</span> Misses "Why"</li>
                                <li className="flex items-center gap-2"><span className="text-red-500">×</span> No visual flow</li>
                            </ul>
                        </motion.div>

                        {/* Flowy */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.3 }}
                            className="relative p-8 rounded-2xl bg-gradient-to-b from-purple-900/20 to-indigo-900/20 border border-purple-500/30 shadow-2xl shadow-purple-500/10 transform scale-105"
                        >
                            <div className="absolute top-0 right-0 p-3">
                                <Badge>Recommended</Badge>
                            </div>
                            <div className="h-14 w-14 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mb-6 shadow-lg shadow-purple-500/30">
                                <Fingerprint className="w-7 h-7 text-white" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-3">Flowy Approach</h3>
                            <p className="text-sm text-purple-100/80 leading-relaxed mb-4">
                                AI-powered reconstruction of the user session. It detects patterns, flags errors, and tells you the story of the session.
                            </p>
                            <ul className="space-y-2 text-sm text-purple-100">
                                <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Plug & Play SDK</li>
                                <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Visual Journey</li>
                                <li className="flex items-center gap-2"><span className="text-green-400">✓</span> AI Insights</li>
                                <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Instant Debugging</li>
                            </ul>
                        </motion.div>

                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="relative z-10 py-12 border-t border-white/5 bg-slate-950">
                <div className="container mx-auto px-6 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="flex items-center gap-2 text-slate-500 text-sm">
                        <span>Created with a lot of</span>
                        <Coffee className="w-4 h-4 text-amber-600" />
                        <span>by Flavio Montagner</span>
                    </div>
                    <p className="text-xs text-slate-700">
                        © 2026 Flowy Inc. We impress investors.
                    </p>
                </div>
            </footer>

        </div>
    )
}

function Badge({ children }: { children: React.ReactNode }) {
    return (
        <span className="bg-purple-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
            {children}
        </span>
    )
}
