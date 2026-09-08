import { useEffect, useMemo, useState } from 'react'
import type { Corridor as C } from './types'
import { defaultMonth, monthLabel, monthsBetween } from './data'
import { CorridorMap } from './CorridorMap'
import { Tiles } from './Tiles'
import { Overview } from './Overview'
import { About } from './About'
import { DataPage } from './DataPage'
import { Questions } from './Questions'
import type { Behaviour } from './behaviour'

type Page = 'home' | 'about' | 'data'
const pageFromHash = (): Page => (location.hash === '#about' ? 'about' : location.hash === '#data' ? 'data' : 'home')

export default function App() {
  const [c, setC] = useState<C | null>(null)
  const [b, setB] = useState<Behaviour | null>(null)
  const [page, setPage] = useState<Page>(pageFromHash())
  const [sel, setSel] = useState<string | null>(null)
  const [ym, setYm] = useState('')

  useEffect(() => { fetch('/data/toronto-bloor-west.json').then(r => r.json()).then((d: C) => { setC(d); setYm(defaultMonth(d)) }); fetch('/data/toronto-bloor-west-behaviour.json').then(r => r.json()).then(setB) }, [])
  useEffect(() => { const h = () => setPage(pageFromHash()); window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h) }, [])
  const months = useMemo(() => c ? monthsBetween('2016-01', c.corridor.snapshot.slice(0, 7)) : [], [c])
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (!months.length || (e.target as HTMLElement)?.tagName === 'INPUT') return; const i = months.indexOf(ym); if (e.key === 'ArrowLeft' && i > 0) setYm(months[i - 1]); if (e.key === 'ArrowRight' && i < months.length - 1) setYm(months[i + 1]) }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [sel, ym, months])
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
          <CorridorMap c={c} b={b} seg={seg} ym={ym} months={months} onSelect={setSel} onMonth={setYm} />
          <p className="mapnote">{seg ? <>Showing <b>{seg.name}</b>. Click it again for the whole street.</> : <>Click a stretch of the street to ask the questions about it. The bars show who passes through.</>}</p>
          {b && <Questions c={c} b={b} seg={seg} />}
          <section className="segment">
            <h2 className="sectionhead">Month by month <span className="sub">{monthLabel(ym)} · move the slider on the map to change</span></h2>
            <CorridorMap c={c} b={b} seg={seg} ym={ym} months={months} onSelect={setSel} onMonth={setYm} showDash />
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
