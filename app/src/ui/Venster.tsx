import { AnimatePresence, motion } from 'motion/react'
import type { ReactNode } from 'react'
import { achtergrondVervaag, sheet } from './beweging'

/** Venster dat als een sheet van onderen omhoog glijdt en weer wegglijdt; tik naast het venster sluit het. */
export function Venster({ open, sluit, label, ruim = false, children }: { open: boolean; sluit: () => void; label: string; ruim?: boolean; children: ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="paneel-achtergrond" variants={achtergrondVervaag} initial="verborgen" animate="zichtbaar" exit="verborgen" onClick={sluit}>
          <motion.div className={`paneel${ruim ? ' ruim' : ''}`} role="dialog" aria-label={label} variants={sheet} initial="verborgen" animate="zichtbaar" exit="verborgen" onClick={(e) => e.stopPropagation()}>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
