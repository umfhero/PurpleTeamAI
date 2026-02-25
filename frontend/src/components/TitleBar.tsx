import { useState, useEffect } from 'react'
import { Minus, Square, X, Maximize2 } from 'lucide-react'

export default function TitleBar() {
    const [isMaximized, setIsMaximized] = useState(false)

    useEffect(() => {
        // Poll maximized state so the icon updates on snap/restore
        const check = async () => {
            const maximized = await window.electronAPI?.windowControls?.isMaximized()
            setIsMaximized(!!maximized)
        }
        check()
        const interval = setInterval(check, 500)
        return () => clearInterval(interval)
    }, [])

    const minimize = () => window.electronAPI?.windowControls?.minimize()
    const maximize = () => {
        window.electronAPI?.windowControls?.maximize()
        setIsMaximized(prev => !prev)
    }
    const close = () => window.electronAPI?.windowControls?.close()

    return (
        <div
            className="h-6 flex items-center justify-end border-b border-border select-none shrink-0"
            style={{ WebkitAppRegion: 'drag', backgroundColor: '#f2f2f2' } as React.CSSProperties}
        >
            {/* Spacer so buttons sit at right */}
            <div className="flex-1" />

            {/* Window control buttons — must opt out of drag */}
            <div
                className="flex items-center h-full"
                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
                <button
                    onClick={minimize}
                    className="h-full w-9 flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                    title="Minimize"
                >
                    <Minus size={10} />
                </button>
                <button
                    onClick={maximize}
                    className="h-full w-9 flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                    title={isMaximized ? 'Restore' : 'Maximize'}
                >
                    {isMaximized ? <Square size={10} /> : <Maximize2 size={10} />}
                </button>
                <button
                    onClick={close}
                    className="h-full w-9 flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                    title="Close"
                >
                    <X size={10} />
                </button>
            </div>
        </div>
    )
}
