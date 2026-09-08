import type { Corridor as C, Segment } from './types'
import { bikesLastYear, collisionsUsual, compare, delaysUsual, fmt, monthLabel, prevYear, segmentState, tpsCovers, tpsMonth, verdict, weatherIcon, weatherLastYear, weatherMonth, type Verdict } from './data'
import { WeatherBadge } from './WeatherBadge'
import { MonthSlider } from './MonthSlider'
import { BikeIcon, CarIcon, TrainIcon, WalkIcon, WorksIcon } from './Icons'

type Props = { c: C; seg: Segment | null; ym: string; months: string[]; onSelect: (id: string | null) => void; onMonth: (ym: string) => void }
const VERDICT_TEXT: Record<Exclude<Verdict, null>, string> = { fewer: 'fewer collisions than usual', usual: 'about the usual number of collisions', more: 'more collisions than usual' }

export function CorridorMap({ c, seg, ym, months, onSelect, onMonth }: Props) {
  const W = 1180, H = 440, padL = 44, padR = 44, roadY = 215
  const L = c.corridor.length_m
  const x = (m: number) => W - padR - (m / L) * (W - padL - padR)
  const states = Object.fromEntries(c.segments.map(s => [s.id, segmentState(c, s.id, ym)]))
  const covered = tpsCovers(c, ym)
  const w = weatherMonth(c, ym), wly = weatherLastYear(c, ym)

  // Dashboard for the selection, each with a line of context.
  const pick = seg ? [states[seg.id]] : Object.values(states)
  const sum = (f: (s: (typeof pick)[number]) => number | null) => pick.some(s => f(s) != null) ? pick.reduce((a, s) => a + (f(s) ?? 0), 0) : null
  const bikesList = pick.filter(s => s.bikes != null)
  const bikes = bikesList.length ? bikesList.reduce((a, s) => a + (s.bikes ?? 0), 0) / bikesList.length : null
  const bly = bikesLastYear(c, seg?.id ?? null, ym)
  const col = sum(s => s.collisions), colBike = sum(s => s.colBike), colPed = sum(s => s.colPed), injury = sum(s => s.injury)
  const colUsual = covered ? collisionsUsual(c, seg?.id ?? null, ym) : null
  const colV = verdict(col, colUsual)
  const delays = sum(s => s.delays), works = pick.reduce((a, s) => a + s.works, 0)
  const stationIds = seg ? [seg.from, seg.to] : c.boundaries.map(b => b.id)
  const dUsual = delays != null ? delaysUsual(c, stationIds, ym) : null
  const ly = monthLabel(prevYear(ym))

  return (
    <div className="mapwrap hero">
      <div className="maptop">
        <div className="maphead">
          <div className="maptitle">{seg ? seg.name : `${c.corridor.to} to ${c.corridor.from}`}</div>
          <div className="mapsub">{seg ? `${(seg.length_m / 1000).toFixed(1)} km` : `${(c.corridor.length_m / 1000).toFixed(1)} km · 17 stretches between Line 2 stations`}{covered ? '' : ` · collision records not yet published for ${monthLabel(ym)}`}</div>
        </div>
        <div className="dash">
          <div className="dcard"><BikeIcon /><div><div className="v">{bikes == null ? '—' : fmt(bikes)}</div><div className="l">bikes a day</div><div className="ctx">{bly ? compare(bly.now, bly.then, ly) : bikes != null ? `${bikesList.length} counter${bikesList.length === 1 ? '' : 's'}` : seg ? 'no counter on this stretch' : 'counters start Oct 2022'}</div></div></div>
          <div className="dcard wide"><div><div className="v">{col ?? '—'}</div><div className="l">collisions{injury != null ? `, ${injury} with injury` : ''}</div><div className="ctx">{colV ? (colUsual != null ? `${VERDICT_TEXT[colV].replace(' collisions', '')}, usually about ${fmt(colUsual)}` : '') : covered ? 'first months on record' : 'not yet published'}</div></div><div className="bytype"><span title="involving a bicycle"><BikeIcon />{colBike ?? '—'}</span><span title="involving a pedestrian"><WalkIcon />{colPed ?? '—'}</span><span title="vehicles only"><CarIcon />{col != null ? col - (colBike ?? 0) - (colPed ?? 0) : '—'}</span></div></div>
          <div className="dcard"><TrainIcon /><div><div className="v">{delays ?? '—'}</div><div className="l">subway delays</div><div className="ctx">{delays != null ? (dUsual != null ? compare(delays, dUsual, 'a usual month') : 'first months on record') : 'records start Jan 2025'}</div></div></div>
          <div className="dcard"><WorksIcon /><div><div className="v">{works}</div><div className="l">street works</div><div className="ctx">{ym >= c.corridor.snapshot.slice(0, 7) ? 'City restriction list' : 'no history before Sep 2026'}</div></div></div>
          <div className="dcard weather"><WeatherBadge icon={weatherIcon(w)} temp={w.tmean} /><div className="ctx">{w.days ? (wly?.tmean != null && w.tmean != null ? `${Math.abs(w.tmean - wly.tmean) < 1 ? 'same as' : w.tmean > wly.tmean ? `${(w.tmean - wly.tmean).toFixed(0)}° warmer than` : `${(wly.tmean - w.tmean).toFixed(0)}° colder than`} ${ly}` : `${w.rain} rainy days${w.snow ? `, ${w.snow} snow` : ''}`) : 'no weather archived'}</div></div>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="map" role="img" aria-label={`${c.corridor.street} from ${c.corridor.to} to ${c.corridor.from}`}>
        <defs>
          <pattern id="works" width={9} height={9} patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width={9} height={9} fill="#f2c94c" /><line x1={0} y1={0} x2={0} y2={9} stroke="#1a1a1a" strokeWidth={3.5} /></pattern>
          <pattern id="grid" width={60} height={60} patternUnits="userSpaceOnUse"><path d="M60 0H0V60" fill="none" stroke="#000" strokeOpacity={0.04} /></pattern>
        </defs>
        <rect x={0} y={0} width={W} height={H} fill="url(#grid)" />
        {c.boundaries.map(b => <line key={b.id} x1={x(b.pos_m)} x2={x(b.pos_m)} y1={20} y2={H - 40} className="crossstreet" />)}
        <line x1={x(L)} x2={x(0)} y1={roadY} y2={roadY} className="casing" />
        {c.segments.map(s => {
          const on = seg?.id === s.id, dim = seg != null && !on
          const st = states[s.id]
          const x0 = x(s.pos_end_m), x1 = x(s.pos_start_m)
          const n = covered ? tpsMonth(c, s.id, ym).total : null, u = covered ? collisionsUsual(c, s.id, ym) : null
          return (
            <g key={s.id} className={`seg ${on ? 'on' : ''} ${dim ? 'dim' : ''}`} onClick={() => onSelect(on ? null : s.id)} tabIndex={0} role="button" aria-pressed={on} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(on ? null : s.id) } }}>
              <title>{s.name} · {(s.length_m / 1000).toFixed(1)} km{n != null ? ` · ${n} collisions this month${u != null ? `, usually about ${fmt(u)}` : ''}` : ' · collision records not yet published'}{st.works ? ' · street works' : ''}</title>
              <rect x={x0 + 1.5} y={roadY - 9} width={Math.max(4, x1 - x0 - 3)} height={18} rx={3} className="segbar neutral" />
              {st.works > 0 && <rect x={x0 + 1.5} y={roadY - 9} width={Math.max(4, x1 - x0 - 3)} height={18} rx={3} fill="url(#works)" className="worksbar" />}
            </g>
          )
        })}
        {c.boundaries.map((b, i) => {
          const inSel = seg ? seg.from === b.id || seg.to === b.id : false
          const up = i % 2 === 0
          return (
            <g key={b.id} className={`station ${inSel ? 'on' : ''} ${seg && !inSel ? 'dim' : ''}`}>
              <circle cx={x(b.pos_m)} cy={roadY} r={5} />
              <text x={x(b.pos_m)} y={up ? roadY - 50 : roadY + 64} textAnchor="middle">{b.station}</text>
              <line x1={x(b.pos_m)} x2={x(b.pos_m)} y1={up ? roadY - 42 : roadY + 42} y2={up ? roadY - 16 : roadY + 16} className="leader" />
            </g>
          )
        })}
        <text x={padL - 28} y={H - 10} className="compass">← west</text>
        <text x={W - padR + 28} y={H - 10} textAnchor="end" className="compass">east →</text>
        <g className="maplegend" transform={`translate(${W / 2 - 120}, ${H - 10})`}>
          <rect x={0} y={-9} width={16} height={9} rx={2} className="segbar neutral" /><text x={20} y={0}>a stretch of the street (click to focus)</text>
          <rect x={210} y={-9} width={16} height={9} rx={2} fill="url(#works)" /><text x={230} y={0}>street works this month</text>
        </g>
      </svg>
      <div className="mapslider"><MonthSlider c={c} months={months} value={ym} onChange={onMonth} /></div>
    </div>
  )
}
