import { useState, useCallback, useEffect, useRef } from 'react'

const STORAGE_KEY = 'purpleteam-panel-widths'

type PanelWidths = Record<string, number>

function loadWidths(): PanelWidths {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        return raw ? JSON.parse(raw) : {}
    } catch {
        return {}
    }
}

function saveWidths(widths: PanelWidths) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widths))
}

/**
 * Hook for a draggable panel resize handle.
 * Returns the current width and a set of handlers to attach to the drag handle.
 */
export function useResizablePanel(
    id: string,
    defaultWidth: number,
    min: number,
    max: number,
) {
    const [width, setWidth] = useState(() => {
        const stored = loadWidths()[id]
        return stored != null ? Math.max(min, Math.min(max, stored)) : defaultWidth
    })
    const dragging = useRef(false)
    const startX = useRef(0)
    const startW = useRef(0)

    const onMouseMove = useCallback((e: MouseEvent) => {
        if (!dragging.current) return
        const delta = e.clientX - startX.current
        const next = Math.max(min, Math.min(max, startW.current + delta))
        setWidth(next)
    }, [min, max])

    const onMouseUp = useCallback(() => {
        if (!dragging.current) return
        dragging.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        // Persist
        setWidth(w => {
            const all = loadWidths()
            all[id] = w
            saveWidths(all)
            return w
        })
    }, [id])

    useEffect(() => {
        document.addEventListener('mousemove', onMouseMove)
        document.addEventListener('mouseup', onMouseUp)
        return () => {
            document.removeEventListener('mousemove', onMouseMove)
            document.removeEventListener('mouseup', onMouseUp)
        }
    }, [onMouseMove, onMouseUp])

    const onMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault()
        dragging.current = true
        startX.current = e.clientX
        startW.current = width
        document.body.style.cursor = 'col-resize'
        document.body.style.userSelect = 'none'
    }, [width])

    return { width, onMouseDown }
}
