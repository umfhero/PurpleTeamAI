import { Activity, AlertTriangle, CheckCircle, Target } from 'lucide-react'

export default function Dashboard() {
    const stats = [
        { name: 'Active Scans', value: '0', icon: Activity, color: 'text-primary' },
        { name: 'Vulnerabilities', value: '0', icon: AlertTriangle, color: 'text-[hsl(var(--critical))]' },
        { name: 'Targets Scanned', value: '0', icon: Target, color: 'text-[hsl(var(--medium))]' },
        { name: 'Remediated', value: '0', icon: CheckCircle, color: 'text-[hsl(var(--low))]' },
    ]

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat) => {
                    const Icon = stat.icon
                    return (
                        <div key={stat.name} className="p-6 border border-border bg-card shadow-brutal">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{stat.name}</p>
                                    <p className="text-3xl font-bold mt-2 tracking-tight">{stat.value}</p>
                                </div>
                                <Icon className={`h-8 w-8 ${stat.color}`} />
                            </div>
                        </div>
                    )
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="p-6 border border-border bg-card shadow-brutal h-[300px]">
                    <h3 className="text-lg mb-4">Recent Scans</h3>
                    <div className="text-muted-foreground text-sm font-mono">
                        <p>No scans yet. Go to Scan to start.</p>
                    </div>
                </div>
                <div className="p-6 border border-border bg-card shadow-brutal h-[300px]">
                    <h3 className="text-lg mb-4">System Status</h3>
                    <div className="space-y-3 font-mono text-sm">
                        <div className="flex justify-between items-center py-2 border-b border-border">
                            <span className="text-muted-foreground">Nmap</span>
                            <span className="text-[hsl(var(--low))]">READY</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-border">
                            <span className="text-muted-foreground">Gemini API</span>
                            <span className="text-[hsl(var(--medium))]">PENDING</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-border">
                            <span className="text-muted-foreground">Ollama</span>
                            <span className="text-muted-foreground">OFFLINE</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
