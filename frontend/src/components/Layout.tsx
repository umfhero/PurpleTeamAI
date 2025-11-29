import { Outlet, Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, Shield, Crosshair, Search, Settings, Menu } from 'lucide-react'
import { cn } from '../lib/utils'
import { useState } from 'react'

export default function Layout() {
    const location = useLocation()
    const [sidebarOpen, setSidebarOpen] = useState(true)

    const navItems = [
        { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
        { name: 'Recon', path: '/recon', icon: Search },
        { name: 'Pentest', path: '/pentest', icon: Crosshair },
        { name: 'Defense', path: '/defense', icon: Shield },
        { name: 'Settings', path: '/settings', icon: Settings },
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
                    {sidebarOpen && <span className="font-bold text-xl text-primary">RedTeamAI</span>}
                    <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1 hover:bg-accent rounded">
                        <Menu size={20} />
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
                                    "flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
                                    isActive
                                        ? "bg-primary text-primary-foreground"
                                        : "hover:bg-accent hover:text-accent-foreground"
                                )}
                            >
                                <Icon size={20} />
                                {sidebarOpen && <span>{item.name}</span>}
                            </Link>
                        )
                    })}
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                <header className="h-16 border-b border-border bg-card flex items-center px-6 justify-between">
                    <h1 className="text-lg font-semibold">
                        {navItems.find(i => location.pathname.startsWith(i.path))?.name || 'Dashboard'}
                    </h1>
                    <div className="flex items-center gap-4">
                        {/* User profile or other header items */}
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                            U
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-auto p-6">
                    <Outlet />
                </div>
            </main>
        </div>
    )
}
