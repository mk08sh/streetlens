import { useEffect, useMemo, useRef, useState } from 'react'
import type { Corridor as C } from './types'
import { defaultMonth, monthLabel, monthsBetween } from './data'
import { CorridorMap } from './CorridorMap'
import { Tiles } from './Tiles'
import { Overview } from './Overview'
import { About } from './About'
import { DataPage } from './DataPage'
import { Questions } from './Questions'
import type { Behaviour } from './behaviour'
import { FlowMap } from './FlowMap'
import { cursorYm, daysIn, type Cursor, type Flow, type Gran } from './flow'

type Page = 'home' | 'about' | 'data'
const pageFromHash = (): Page => (location.hash === '#about' ? 'about' : location.hash === '#data' ? 'data' : 'home')

export default function App() {
  const [c, setC] = useState<C | null>(null)
  const [b, setB] = useState<Behaviour | null>(null)
  const [fl, setFl] = useState<Flow | null>(null)
  const [cursor, setCursor] = useState<Cursor>({ y: 2026, m: 6, d: 15, h: 8 })
  const [gran, setGran] = useState<Gran>('month')
  const [page, setPage] = useState<Page>(pageFromHash())
  const [sel, setSel] = useState<string | null>(null)
  const [ym, setYm] = useState('')
  const ym0 = useRef('')

  useEffect(() => { fetch(`${import.meta.env.BASE_URL}data/toronto-bloor-west.json`).then(r => r.json()).then((d: C) => { setC(d); setYm(defaultMonth(d)) }); fetch(`${import.meta.env.BASE_URL}data/toronto-bloor-west-behaviour.json`).then(r => r.json()).then(setB); fetch(`${import.meta.env.BASE_URL}data/toronto-bloor-west-flow.json`).then(r => r.json()).then(setFl) }, [])
  useEffect(() => { const h = () => setPage(pageFromHash()); window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h) }, [])
  const months = useMemo(() => c ? monthsBetween('2016-01', c.corridor.snapshot.slice(0, 7)) : [], [c])
  useEffect(() => { const ym = cursorYm(cursor); if (ym !== ym0.current) { ym0.current = ym; if (months.includes(ym)) setYm(ym) } }, [cursor, months])
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.target as HTMLElement)?.tagName === 'INPUT') return; const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (!step) return
      setCursor(k => { if (gran === 'hour') return { ...k, h: Math.max(0, Math.min(23, k.h + step)) }; if (gran === 'day') return { ...k, d: Math.max(1, Math.min(daysIn(k.y, k.m), k.d + step)) }; if (gran === 'month') { let m = k.m + step, y = k.y; if (m < 1) { m = 12; y-- } if (m > 12) { m = 1; y++ } return { ...k, y, m, d: Math.min(k.d, daysIn(y, m)) } } return { ...k, y: Math.max(1984, Math.min(2026, k.y + step)) } }) }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [gran])
  if (!c || !ym) return <div className="loading">Loading…</div>
  const seg = sel ? c.segments.find(s => s.id === sel)! : null

  return (
    <div className="app">
      <header>
        <a className="brand" href="#" onClick={() => setPage('home')}>StreetLens</a>
        <nav>
          <a href="#" className={page === 'home' ? 'on' : ''}>Bloor Street West</a>
          <a href="#about" className={page === 'about' ? 'on' : ''}>About</a>
          <a href="#data" className={page === 'data' ? 'on' : ''}>Data</a>
        </nav>
      </header>

      {page === 'about' && <About c={c} />}
      {page === 'data' && <DataPage c={c} />}
      {page === 'home' && (
        <main>
          <h1 className="streetname">{c.corridor.street}<span className="sub"> · Toronto</span></h1>
          {fl ? <FlowMap c={c} fl={fl} seg={seg} cursor={cursor} gran={gran} onSelect={setSel} onCursor={setCursor} onGran={setGran} /> : <CorridorMap c={c} b={b} seg={seg} ym={ym} months={months} onSelect={setSel} onMonth={setYm} />}
          <p className="mapnote">{seg ? <>Showing <b>{seg.name}</b>. Click it again for the whole street.</> : <>Click a stretch of the street to focus on it. Hover any line for the number and where it comes from.</>}</p>
          {b && <Questions c={c} b={b} seg={seg} />}
          <section className="segment">
            <h2 className="sectionhead">Month by month <span className="sub">{monthLabel(ym)} · move the slider on the map to change</span></h2>
            <CorridorMap c={c} b={b} seg={seg} ym={ym} months={months} onSelect={setSel} onMonth={m => { setYm(m); const [y, mo] = m.split('-').map(Number); setCursor(k => ({ ...k, y, m: mo, d: Math.min(k.d, daysIn(y, mo)) })) }} showDash />
            <Tiles c={c} seg={seg} ym={ym} />
            <p className="caveat">Raw measurements for {seg ? 'one stretch' : 'the street'} in one month. Not adjusted for season, weather or weekday, and not compared with any other street. A change on the street cannot be shown to have caused a change in these numbers from this view alone.</p>
          </section>
          {!seg && <Overview c={c} />}
        </main>
      )}
      <footer>Open source · code AGPL-3.0 · data CC BY 4.0 · snapshot {c.corridor.snapshot} · <a href="#data">sources</a></footer>
    </div>
  )
}
