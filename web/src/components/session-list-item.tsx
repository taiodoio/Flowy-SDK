import { formatDistanceToNow } from "date-fns"
import { CheckCircle, AlertCircle, Smartphone, Clock, FileText, ChevronRight, Tag, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

interface SessionListItemProps {
    session: any
    onToggleApproval: (id: string, isApproved: boolean) => void
    onDelete: (id: string) => void
    onSelect?: (session: any) => void
}

export function SessionListItem({ session, onToggleApproval, onDelete }: SessionListItemProps) {
    const router = useRouter()
    const isAnalyzed = !!session.report
    const errorCount = session.events?.filter((e: any) => (e.action || e.type || "").toLowerCase() === 'error').length || 0

    const handleClick = () => {
        if (!session.id) {
            console.error("No session ID");
            return;
        }
        // Force hard reload to guarantee URL update
        window.location.href = `/report/${session.id}`;
    }

    return (
        <div
            onClick={handleClick}
            title={`Session ID: ${session.id}`}
            className="group relative block bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/30 transition-all duration-300 rounded-xl p-5 cursor-pointer overflow-hidden transform active:scale-[0.99]"
        >
            <div className="flex items-center justify-between gap-4">
                {/* Status Indicator Stripe */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${isAnalyzed ? 'bg-gradient-to-b from-purple-500 to-indigo-600' : 'bg-slate-700'}`} />

                <div className="flex-1 pl-4 space-y-2">
                    <div className="flex items-center gap-3">
                        <span className="font-mono text-sm text-slate-400 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                            {session.id?.substring(0, 8) || "NO-ID"}...
                        </span>
                        {isAnalyzed ? (
                            <Badge variant="secondary" className="bg-green-500/10 text-green-400 border-green-500/20 text-xs gap-1">
                                <CheckCircle className="w-3 h-3" /> Analyzed
                            </Badge>
                        ) : (
                            <Badge variant="secondary" className="bg-slate-500/10 text-slate-400 border-slate-500/20 text-xs gap-1">
                                <Clock className="w-3 h-3" /> Pending
                            </Badge>
                        )}
                        <span className="text-xs text-slate-500 ml-auto">
                            {session.uploadedAt && formatDistanceToNow(new Date(session.uploadedAt), { addSuffix: true })}
                        </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                        <div className="flex items-center gap-1.5">
                            <Smartphone className="w-3.5 h-3.5" />
                            {session.deviceInfo?.deviceModel || "Unknown Device"}
                        </div>
                        <div className="flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5" />
                            {session.events?.length || 0} Events
                        </div>
                        {errorCount > 0 && (
                            <div className="flex items-center gap-1.5 text-red-400">
                                <AlertCircle className="w-3.5 h-3.5" />
                                {errorCount} Errors
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
                    {/* Tags Preview */}
                    {session.tags?.length > 0 && (
                        <div className="hidden sm:flex -space-x-2">
                            {session.tags.slice(0, 3).map((tag: string) => (
                                <Badge key={tag} className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 px-1 py-0 h-5" variant="secondary">
                                    <Tag className="w-3 h-3" />
                                </Badge>
                            ))}
                        </div>
                    )}

                    <div className="flex items-center gap-2 border-l border-white/10 pl-4">
                        <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Approved</span>
                        <Switch
                            checked={session.isApproved}
                            onCheckedChange={(checked) => onToggleApproval(session.id, checked)}
                            className="data-[state=checked]:bg-green-500"
                        />
                    </div>

                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Are you sure you want to delete this session? This action cannot be undone.')) {
                                onDelete(session.id);
                            }
                        }}
                    >
                        <Trash2 className="w-4 h-4" />
                    </Button>

                    <Button variant="ghost" size="icon" className="text-slate-500 group-hover:text-white group-hover:translate-x-1 transition-all">
                        <ChevronRight className="w-5 h-5" />
                    </Button>
                </div>
            </div>
        </div>
    )
}
