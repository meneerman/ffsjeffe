import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useMemo, useState } from 'react'
import { behoeften, boodschappenRegels } from '../core/boodschappen'
import type { Recept, Slot, WeekPlan } from '../core/types'
import { alternatieven, stelVoor, vervang } from '../core/voorstel'
import { DAGEN, maandagVan, teplannenWeek, volgendeWeek } from '../core/week'
import { VerouderdFout } from '../data/github'
import type { SchermProps } from './App'
import { lees, schrijf } from './opslag'
import { Ruilen } from './Ruilen'

const MAANDEN = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

export function weekKop(week: string): string {
  const ma = maandagVan(week)
  const vr = new Date(ma.getFullYear(), ma.getMonth(), ma.getDate() + 4)
  const nr = Number(week.split('-W')[1])
  const datum =
    ma.getMonth() === vr.getMonth()
      ? `${ma.getDate()}–${vr.getDate()} ${MAANDEN[vr.getMonth()]}`
      : `${ma.getDate()} ${MAANDEN[ma.getMonth()]} – ${vr.getDate()} ${MAANDEN[vr.getMonth()]}`
  return `Week ${nr} · ${datum}`
}

const conceptSleutel = (week: string) => `ffsjeffe.concept.${week}`

type Props = SchermProps & { vandaag?: Date; Extra?: (p: { slots: Slot[]; perId: Record<string, Recept>; vastgezet: WeekPlan | null }) => JSX.Element }

export function Week({ vandaag = new Date(), ...p }: Props) {
  const basis = teplannenWeek(vandaag)
  const [week, setWeek] = useState(basis)
  const [lokaal, setLokaal] = useState<Record<string, { plan: WeekPlan; sha: string }>>({})
  const opGitHub = p.data.plannen.find((x) => x.plan.week === week) ?? null
  const vastgezet = lokaal[week] ?? opGitHub

  return (
    <>
      <h1>{weekKop(week)}</h1>
      <div className="knoppen">
        {week === basis ? (
          <button onClick={() => setWeek(volgendeWeek(basis))}>Volgende week</button>
        ) : (
          <button onClick={() => setWeek(basis)}>Deze week</button>
        )}
      </div>
      <WeekInhoud key={week} {...p} week={week} vastgezet={vastgezet} bijVastzetten={(plan, sha) => setLokaal((l) => ({ ...l, [week]: { plan, sha } }))} />
    </>
  )
}

function WeekInhoud({ data, repo, naam, herlaad, week, vastgezet, bijVastzetten, Extra }: SchermProps & {
  week: string
  vastgezet: { plan: WeekPlan; sha: string } | null
  bijVastzetten: (plan: WeekPlan, sha: string) => void
  Extra?: Props['Extra']
}) {
  const { recepten, verpakkingen, instellingen } = data
  const plannen = useMemo(() => data.plannen.map((x) => x.plan), [data.plannen])
  const perId = useMemo(() => Object.fromEntries(recepten.map((r) => [r.id, r])), [recepten])
  const voorstel = () => stelVoor(recepten, week, plannen, verpakkingen, instellingen.huishouden)

  const [slots, zetSlots] = useState<Slot[]>(() => {
    const concept = lees<Slot[]>(conceptSleutel(week))
    const bron = concept ?? vastgezet?.plan.slots ?? voorstel()
    return bron.filter((s) => perId[s.receptId])
  })
  const [heeftConcept, setHeeftConcept] = useState(() => lees(conceptSleutel(week)) !== null)
  const [ruilIndex, setRuilIndex] = useState<number | null>(null)
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState<Error | null>(null)

  const wijzig = (nieuw: Slot[]) => {
    zetSlots(nieuw)
    schrijf(conceptSleutel(week), nieuw)
    setHeeftConcept(true)
    setFout(null)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const naSlepen = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const van = slots.findIndex((s) => s.receptId === active.id)
    const naar = slots.findIndex((s) => s.receptId === over.id)
    wijzig(arrayMove(slots, van, naar))
  }

  const zetVast = async () => {
    setBezig(true)
    setFout(null)
    const plan: WeekPlan = {
      week,
      status: 'vastgezet',
      slots,
      boodschappen: boodschappenRegels(behoeften(slots, perId, instellingen.huishouden), verpakkingen),
      vastgezetOp: new Date().toISOString(),
      door: naam,
    }
    try {
      const sha = await repo.zetVast(plan, vastgezet?.sha ?? null)
      schrijf(conceptSleutel(week), null)
      setHeeftConcept(false)
      bijVastzetten(plan, sha)
    } catch (e) {
      setFout(e as Error)
    } finally {
      setBezig(false)
    }
  }

  if (recepten.length === 0) {
    return <p className="kaart">Nog geen recepten. Voeg ze toe in Obsidian in de map <code>recepten</code>.</p>
  }

  // dagen per slot (ma, di–wo, …)
  let dag = 0
  const dagenPerSlot = slots.map((s) => {
    const d = DAGEN.slice(dag, dag + s.dagen)
    dag += s.dagen
    return d
  })

  return (
    <>
      <p className="zacht status">
        {vastgezet ? `Vastgezet door ${vastgezet.plan.door}` : 'Voorstel, nog niet vastgezet'}
        {vastgezet && heeftConcept && ' · gewijzigd, nog niet opnieuw vastgezet'}
      </p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={naSlepen}>
        <SortableContext items={slots.map((s) => s.receptId)} strategy={verticalListSortingStrategy}>
          <ol className="gerechten">
            {slots.map((s, i) => (
              <Gerecht
                key={s.receptId}
                recept={perId[s.receptId]}
                dagen={dagenPerSlot[i]}
                ruil={() => setRuilIndex(i)}
                omhoog={i > 0 ? () => wijzig(arrayMove(slots, i, i - 1)) : undefined}
                omlaag={i < slots.length - 1 ? () => wijzig(arrayMove(slots, i, i + 1)) : undefined}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>

      {fout && (
        <div className="kaart">
          <p className="melding fout">{fout.message}</p>
          {fout instanceof VerouderdFout && <button onClick={herlaad}>Herladen</button>}
        </div>
      )}

      <div className="knoppen">
        <button
          onClick={() => {
            schrijf(conceptSleutel(week), null)
            setHeeftConcept(false)
            zetSlots(voorstel())
          }}
        >
          Opnieuw voorstellen
        </button>
        <button className="primair" onClick={zetVast} disabled={bezig || slots.length === 0}>
          {bezig ? 'Bezig…' : 'Vastzetten'}
        </button>
      </div>

      {Extra && <Extra slots={slots} perId={perId} vastgezet={vastgezet?.plan ?? null} />}

      {ruilIndex !== null && (
        <Ruilen
          opties={alternatieven(ruilIndex, slots, recepten, week, plannen, verpakkingen, instellingen.huishouden)}
          sluit={() => setRuilIndex(null)}
          kies={(r) => {
            wijzig(vervang(slots, ruilIndex, r))
            setRuilIndex(null)
          }}
        />
      )}
    </>
  )
}

function Gerecht({ recept, dagen, ruil, omhoog, omlaag }: { recept: Recept; dagen: readonly string[]; ruil: () => void; omhoog?: () => void; omlaag?: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: recept.id })
  const label = dagen.length > 1 ? `${dagen[0]}–${dagen[dagen.length - 1]}` : dagen[0]
  return (
    <li
      ref={setNodeRef}
      data-testid="gerecht"
      className={`kaart gerecht${isDragging ? ' sleept' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <span className="greep" {...attributes} {...listeners} aria-label="Slepen">⠿</span>
      <span className="dag">{label}</span>
      <div className="midden">
        <a href={`#/recept/${encodeURIComponent(recept.id)}`}>{recept.titel}</a>
        <div className="zacht klein">
          {recept.tijdMinuten > 0 && `${recept.tijdMinuten} min`}
          {recept.dagen > 1 && ` · ${recept.dagen} avonden`}
        </div>
        {dagen.slice(1).map((d) => (
          <div key={d} className="zacht klein">{`${d}: rest van ${recept.titel}`}</div>
        ))}
      </div>
      <div className="acties">
        <button onClick={ruil}>Ruil</button>
        <button onClick={omhoog} disabled={!omhoog} aria-label="Omhoog">↑</button>
        <button onClick={omlaag} disabled={!omlaag} aria-label="Omlaag">↓</button>
      </div>
    </li>
  )
}
