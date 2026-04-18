import * as Progress from '@radix-ui/react-progress'
import { cn } from '@/lib/cn'

interface ProgressBarProps {
  value: number       // 0–100
  className?: string
  label?: string
  startLabel?: string
  endLabel?: string
}

export function ProgressBar({ value, className, startLabel, endLabel, label }: ProgressBarProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Progress.Root
        className="relative h-2.5 w-full overflow-hidden rounded-full bg-[var(--color-bg-alt)]"
        value={value}
        aria-label={label ?? 'Progress'}
      >
        <Progress.Indicator
          className="h-full rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-mid)] transition-all duration-500 ease-out"
          style={{ width: `${value}%` }}
        />
      </Progress.Root>
      {(startLabel || endLabel) && (
        <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
          <span>{startLabel}</span>
          <span className="font-semibold text-[var(--color-primary)]">{value}%</span>
          <span>{endLabel}</span>
        </div>
      )}
    </div>
  )
}
