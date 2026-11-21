import { useEffect, useRef } from 'react'

/** Twee zachte gloedvlakken die traag drijven en bij scrollen meebewegen (uit bij prefers-reduced-motion, zie stijl.css). */
export function Achtergrond() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const volg = () => el.style.setProperty('--scroll', String(Math.round(window.scrollY)))
    volg()
    window.addEventListener('scroll', volg, { passive: true })
    return () => window.removeEventListener('scroll', volg)
  }, [])
  return (
    <div className="achtergrond" aria-hidden="true" ref={ref}>
      <div className="gloed gloed-violet" />
      <div className="gloed gloed-warm" />
    </div>
  )
}
