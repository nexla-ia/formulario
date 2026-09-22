import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { Logo } from '../components/ui/Chrome'
import { Button } from '../components/ui/Button'

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md text-center"
      >
        <div className="flex justify-center">
          <Logo size="lg" />
        </div>

        <motion.p
          className="mt-10 text-[clamp(4rem,16vw,6rem)] leading-none font-extrabold tracking-[-0.06em] text-brand-soft"
          animate={{ scale: [1, 1.02, 1] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        >
          404
        </motion.p>

        <h1 className="mt-2 text-[24px] font-extrabold tracking-[-0.03em]">Página não encontrada</h1>
        <p className="mt-2 text-[14.5px] leading-relaxed text-ink-3">
          Esse endereço não existe por aqui. Se era um link de formulário, confira se veio completo.
        </p>

        <div className="mt-7 flex justify-center">
          <Link to="/painel">
            <Button size="lg">Ir para o painel</Button>
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
