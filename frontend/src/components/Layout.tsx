import { Outlet, Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, Crosshair, FileText } from 'lucide-react'
import { cn } from '../lib/utils'
import TitleBar from './TitleBar'

export default function Layout() {
    const location = useLocation()

    const navItems = [
        { name: 'Scan', path: '/scan', icon: Crosshair, step: 1 },
        { name: 'Results', path: '/dashboard', icon: LayoutDashboard, step: 2 },
        { name: 'Reports', path: '/reports', icon: FileText, step: 3 },
    ]

    const activeIndex = navItems.findIndex(i => location.pathname.startsWith(i.path))
    const currentStep = activeIndex === -1 ? 0 : activeIndex

    return (
        <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
            <TitleBar />

            {/* Top bar: branding + stepper + status */}
            <header className="bg-card border-b border-border shrink-0">
                {/* Upper row: branding + status */}
                <div className="flex items-center justify-between px-5 h-10">
                    <div className="flex items-baseline gap-2">
                        <span className="font-bold text-sm text-primary tracking-tight">PURPLETEAM</span>
                        <span className="font-bold text-xs text-muted-foreground tracking-tight">SUITE</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] font-mono text-muted-foreground tracking-wider">v2.5.0-dev</span>
                        <span className="text-[10px] font-mono text-muted-foreground tracking-wider">READY</span>
                    </div>
                </div>

                {/* Stepper rail */}
                <div className="flex h-12 relative overflow-hidden">
                    {/* Sliding purple fill — covers steps 0..currentStep */}
                    <div
                        className="absolute inset-y-0 left-0 bg-primary stepper-bg-slide"
                        style={{ width: `${((currentStep + 1) / navItems.length) * 100}%` }}
                    />

                    {navItems.map((item, index) => {
                        const Icon = item.icon
                        const isActive = index === currentStep
                        const isFilled = index <= currentStep

                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={cn(
                                    "flex-1 relative z-10 flex items-center font-mono uppercase tracking-wider transition-colors duration-300",
                                    "border-r border-border/30 last:border-r-0",
                                    isFilled
                                        ? "text-primary-foreground hover:bg-primary/80"
                                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                )}
                            >
                                {/* Step number — left-aligned */}
                                <span className={cn(
                                    "w-10 shrink-0 flex items-center justify-center text-[10px] font-bold transition-colors duration-300",
                                    isFilled ? "text-primary-foreground/50" : "text-border"
                                )}>
                                    {item.step}
                                </span>

                                {/* Name — centred in remaining space */}
                                <span className={cn(
                                    "flex-1 text-center text-base font-bold tracking-wide",
                                    isActive && "text-primary-foreground"
                                )}>
                                    {item.name}
                                </span>

                                {/* Icon — right-aligned */}
                                <span className="w-10 shrink-0 flex items-center justify-center">
                                    <Icon size={16} />
                                </span>
                            </Link>
                        )
                    })}
                </div>
            </header>

            {/* Main content */}
            <main className="flex-1 overflow-auto">
                <Outlet />
            </main>
        </div>
    )
}
