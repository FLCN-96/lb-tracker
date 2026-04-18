import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/cn'

const badge = cva(
  'inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full',
  {
    variants: {
      tone: {
        default: 'bg-[var(--color-primary)] text-white',
        down:    'bg-[var(--color-down)] text-white',
        up:      'bg-[var(--color-up)] text-white',
        accent:  'bg-[var(--color-accent)] text-white',
        muted:   'bg-[var(--color-bg-alt)] text-[var(--color-text-muted)] border border-[var(--color-border)]',
        // BMI categories
        under:   'bg-blue-100 text-blue-800',
        normal:  'bg-green-100 text-green-800',
        over:    'bg-orange-100 text-orange-800',
        obese:   'bg-red-100 text-red-800',
      },
    },
    defaultVariants: {
      tone: 'default',
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badge> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badge({ tone }), className)} {...props} />
}
