import { cn } from '@/lib/cn'

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-[var(--shadow-sm)]',
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-4 pt-4 pb-2', className)} {...props} />
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]', className)}
      {...props}
    />
  )
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-4 pb-4', className)} {...props} />
}
