import { Activity, AlertTriangle, CheckCircle, Target } from 'lucide-react'

export default function Dashboard() {
    const stats = [
        { name: 'Active Scans', value: '3', icon: Activity, color: 'text-blue-500' },
        { name: 'Vulnerabilities', value: '12', icon: AlertTriangle, color: 'text-red-500' },
        { name: 'Assets Discovered', value: '156', icon: Target, color: 'text-purple-500' },
        { name: 'Remediated', value: '8', icon: CheckCircle, color: 'text-green-500' },
    ]

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat) => {
                    const Icon = stat.icon
                    return (
                        <div key={stat.name} className="p-6 rounded-lg border border-border bg-card shadow-sm">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">{stat.name}</p>
                                    <p className="text-2xl font-bold mt-1">{stat.value}</p>
                                </div>
                                <Icon className={`h-8 w-8 ${stat.color}`} />
                            </div>
                        </div>
                    )
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="p-6 rounded-lg border border-border bg-card shadow-sm h-[300px]">
                    <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
                    <div className="text-muted-foreground text-sm">
                        <p>No recent activity.</p>
                    </div>
                </div>
                <div className="p-6 rounded-lg border border-border bg-card shadow-sm h-[300px]">
                    <h3 className="text-lg font-semibold mb-4">System Status</h3>
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span>Backend API</span>
                            <span className="text-green-500">Online</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span>Database</span>
                            <span className="text-green-500">Connected</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span>AI Engine</span>
                            <span className="text-yellow-500">Standby</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
