import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/cn'

const button = cva(
  'inline-flex items-center justify-center gap-2 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none',
  {
    variants: {
      variant: {
        primary:   'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-mid)] focus-visible:ring-[var(--color-primary)] active:scale-[0.98]',
        secondary: 'bg-[var(--color-surface-2)] text-[var(--color-text)] border border-[var(--color-border)] hover:bg-[var(--color-bg-alt)] active:scale-[0.98]',
        ghost:     'bg-transparent text-[var(--color-text-2)] hover:bg-[var(--color-bg-alt)] active:scale-[0.98]',
        danger:    'bg-[#b5302a] text-white hover:bg-[#992520] focus-visible:ring-[#b5302a] active:scale-[0.98]',
        accent:    'bg-[var(--color-accent)] text-white hover:opacity-90 active:scale-[0.98]',
      },
      size: {
        sm:   'h-8 px-3 text-xs rounded-[var(--radius-sm)]',
        md:   'h-10 px-4 text-sm rounded-[var(--radius-md)]',
        lg:   'h-12 px-5 text-base rounded-[var(--radius-md)]',
        icon: 'h-10 w-10 rounded-[var(--radius-md)]',
      },
      full: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size:    'md',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, full, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(button({ variant, size, full }), className)}
      {...props}
    />
  ),
)
Button.displayName = 'Button'

export { Button, button }
