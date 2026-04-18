import { Toaster as Sonner } from 'sonner'

export function Toaster() {
  return (
    <Sonner
      position="top-center"
      richColors
      closeButton
      toastOptions={{
        style: {
          fontFamily: 'var(--font-sans)',
          fontSize: 14,
        },
      }}
    />
  )
}

export { toast } from 'sonner'
