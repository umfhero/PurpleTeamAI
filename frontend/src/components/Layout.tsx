import { Outlet, Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, Crosshair, FileText, Menu } from 'lucide-react'
import { cn } from '../lib/utils'
import { useState } from 'react'

export default function Layout() {
    const location = useLocation()
    const [sidebarOpen, setSidebarOpen] = useState(true)

    const navItems = [
        { name: 'Scan', path: '/scan', icon: Crosshair },
        { name: 'Results', path: '/dashboard', icon: LayoutDashboard },
        { name: 'Reports', path: '/reports', icon: FileText },
    ]

    return (
        <div className="flex h-screen bg-background text-foreground overflow-hidden">
            {/* Sidebar */}
            <aside
                className={cn(
                    "bg-card border-r border-border transition-all duration-300 ease-in-out flex flex-col",
                    sidebarOpen ? "w-64" : "w-16"
                )}
            >
                <div className="p-4 flex items-center justify-between border-b border-border h-16">
                    {sidebarOpen && <span className="font-bold text-xl text-primary tracking-tight">PURPLETEAM <span className="text-foreground">SUITE</span></span>}
                    <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-muted border border-transparent hover:border-border">
                        <Menu size={18} />
                    </button>
                </div>

                <nav className="flex-1 p-2 space-y-1">
                    {navItems.map((item) => {
                        const Icon = item.icon
                        const isActive = location.pathname.startsWith(item.path)
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2 border border-transparent transition-colors font-mono text-sm uppercase tracking-wider",
                                    isActive
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "hover:bg-muted hover:border-border"
                                )}
                            >
                                <Icon size={18} />
                                {sidebarOpen && <span>{item.name}</span>}
                            </Link>
                        )
                    })}
                </nav>
                
                {/* Version info */}
                {sidebarOpen && (
                    <div className="p-4 border-t border-border text-xs font-mono text-muted-foreground">
                        v2.1.0-dev
                    </div>
                )}
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                <header className="h-16 border-b border-border bg-card flex items-center px-6 justify-between">
                    <h1 className="text-xl tracking-tight">
                        {navItems.find(i => location.pathname.startsWith(i.path))?.name || 'Scan'}
                    </h1>
                    <div className="flex items-center gap-4">
                        <div className="text-xs font-mono text-muted-foreground">
                            READY
                        </div>
                        <div className="w-2 h-2 bg-[hsl(var(--low))]" />
                    </div>
                </header>

                <div className="flex-1 overflow-auto">
                    <Outlet />
                </div>
            </main>
        </div>
    )
}
