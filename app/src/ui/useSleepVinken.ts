import type { PointerEvent } from 'react'
import { useRef } from 'react'

/** orig = stand van een rij voor de sleep, bekend = stand die wij er zelf aan gaven (React rendert pas later opnieuw) */
type Sleep = { id: string; doel: boolean; orig: Map<string, boolean>; bekend: Map<string, boolean>; geveegd: boolean }

/**
 * Slepen over een lijst met vinkjes: begin op een vinkje en sleep omhoog of omlaag, dan krijgen alle rijen
 * onderweg dezelfde stand als de eerste rij na de tik (aan wordt uit, uit wordt aan). Terugslepen maakt de
 * rijen die je weer loslaat ongedaan. Alleen het vinkje zelf start een sleep, zodat de rest van de rij gewoon scrolt.
 *
 * De lijst (of een element om meerdere lijsten heen) krijgt `lijst`, elk vinkje `vinkvak(id)` en elke rij
 * `data-vink-id` (en `data-vink-uit` als de rij niet te zetten is).
 */
export function useSleepVinken(isAan: (id: string) => boolean, zet: (id: string, aan: boolean) => void) {
  const sleep = useRef<Sleep | null>(null)
  const net = useRef(false)

  const rijen = (el: Element) => Array.from(el.querySelectorAll<HTMLElement>('[data-vink-id]')).filter((r) => !r.hasAttribute('data-vink-uit'))
  const id = (r: HTMLElement) => r.dataset.vinkId!

  return {
    lijst: {
      onPointerMove(e: PointerEvent<HTMLElement>) {
        const s = sleep.current
        if (!s) return
        const onder = document.elementFromPoint?.(e.clientX, e.clientY)?.closest<HTMLElement>('[data-vink-id]')
        if (!onder) return
        const alle = rijen(e.currentTarget)
        const nu = alle.indexOf(onder)
        const begin = alle.findIndex((r) => id(r) === s.id)
        if (nu < 0 || begin < 0) return
        if (nu === begin && !s.geveegd) return
        s.geveegd = true
        net.current = true
        const [van, tot] = [Math.min(begin, nu), Math.max(begin, nu)]
        // rijen in het bereik krijgen de doelstand; rijen die er weer uit vallen hun oude stand terug
        const zetBekend = (rid: string, aan: boolean) => {
          if ((s.bekend.get(rid) ?? isAan(rid)) !== aan) zet(rid, aan)
          s.bekend.set(rid, aan)
        }
        alle.forEach((r, i) => {
          const rid = id(r)
          if (i >= van && i <= tot) {
            if (!s.orig.has(rid)) s.orig.set(rid, s.bekend.get(rid) ?? isAan(rid))
            zetBekend(rid, s.doel)
          } else if (s.orig.has(rid)) {
            zetBekend(rid, s.orig.get(rid)!)
            s.orig.delete(rid)
          }
        })
      },
      onPointerUp() { sleep.current = null },
      onPointerCancel() { sleep.current = null },
    },
    vinkvak: (vid: string) => ({
      onPointerDown(e: PointerEvent<HTMLElement>) {
        if (e.button !== 0) return
        net.current = false
        sleep.current = { id: vid, doel: !isAan(vid), orig: new Map(), bekend: new Map(), geveegd: false }
      },
      // na een echte sleep volgt nog een klik op het eerste vinkje: die mag niets meer omzetten
      onClickCapture(e: React.MouseEvent<HTMLElement>) {
        if (net.current) {
          e.preventDefault()
          e.stopPropagation()
          net.current = false
        }
      },
    }),
  }
}
