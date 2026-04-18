import type { Transition } from 'motion/react'

export const springSoft: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
}

export const springSnappy: Transition = {
  type: 'spring',
  stiffness: 500,
  damping: 40,
}

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit:    { opacity: 0 },
}

export const slideUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: 8 },
}

export const popIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit:    { opacity: 0, scale: 0.95 },
}
