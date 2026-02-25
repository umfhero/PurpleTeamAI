import { cn } from '../lib/utils'

interface NotificationBadgeProps {
  count: number
  className?: string
}

/**
 * Compact scan-count badge shown on grouped target entries.
 * Sharp corners, solid fill, font-mono — follows design rules.
 */
export default function NotificationBadge({ count, className }: NotificationBadgeProps) {
  if (count <= 1) return null
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1',
        'bg-primary text-primary-foreground font-mono text-[9px] font-bold',
        'leading-none tracking-wide flex-shrink-0',
        className
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}
