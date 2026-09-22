import type { Transition, Variants } from 'motion/react'

/* ── Molas do sistema ───────────────────────────────────── */

/** Padrão: responde rápido, assenta sem balançar. */
export const spring: Transition = { type: 'spring', stiffness: 420, damping: 32, mass: 0.7 }
/** Com um leve repique — botões, seleções, marcações. */
export const springPop: Transition = { type: 'spring', stiffness: 600, damping: 20, mass: 0.6 }
/** Mais calma — painéis, cartões grandes. */
export const springSoft: Transition = { type: 'spring', stiffness: 220, damping: 28 }

export const expo: Transition = { duration: 0.55, ease: [0.16, 1, 0.3, 1] }
export const expoFast: Transition = { duration: 0.3, ease: [0.16, 1, 0.3, 1] }

/* ── Variantes reutilizáveis ────────────────────────────── */

export const listParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.055, delayChildren: 0.05 } },
}

export const listItem: Variants = {
  hidden: { opacity: 0, y: 18, scale: 0.985 },
  show: { opacity: 1, y: 0, scale: 1, transition: expo },
}

export const pageVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.42, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.2, ease: 'easeIn' } },
}

/** Passo do formulário — direção depende de avançar/voltar. */
export const stepVariants: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 52 : -52, scale: 0.985 }),
  center: { opacity: 1, x: 0, scale: 1, transition: { duration: 0.44, ease: [0.16, 1, 0.3, 1] } },
  exit: (dir: number) => ({
    opacity: 0,
    x: dir > 0 ? -52 : 52,
    scale: 0.985,
    transition: { duration: 0.24, ease: 'easeIn' },
  }),
}

/** Cartão que sobe ao entrar na tela (usa whileInView). */
export const revealUp: Variants = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
