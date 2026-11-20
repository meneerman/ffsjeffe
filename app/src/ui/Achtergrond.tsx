/** Twee zachte gloedvlakken die traag drijven (uit bij prefers-reduced-motion, zie stijl.css). */
export function Achtergrond() {
  return (
    <div className="achtergrond" aria-hidden="true">
      <div className="gloed gloed-violet" />
      <div className="gloed gloed-warm" />
    </div>
  )
}
