import { useMemo } from 'react'
import type { Corridor as C, Segment } from './types'
import { GRANS, cursorDate, daysIn, label, laneRate, modeReference, type Cursor, type Dir, type Flow, type Gran, type Mode } from './flow'
import { fmt } from './data'

type Props = { c: C; fl: Flow; seg: Segment | null; cursor: Cursor; gran: Gran; onSelect: (id: string | null) => void; onCursor: (c: Cursor) => void; onGran: (g: Gran) => void }

const MODES: { mode: Mode; name: string; colour: string; width: number; speed: number }[] = [
  { mode: 'ped', name: 'on foot', colour: '#c9a86a', width: 6, speed: 26 },
  { mode: 'bike', name: 'bicycles', colour: '#6a9bb5', width: 6, speed: 14 },
  { mode: 'veh', name: 'vehicles', colour: '#5b6670', width: 8, speed: 8 },
  { mode: 'bus', name: 'buses', colour: '#9a7b52', width: 5, speed: 10 },
]
const LOAD = (ratio: number | null) => ratio == null ? 'none' : ratio < 0.35 ? 'light' : ratio < 0.7 ? 'busy' : 'peak'

export function FlowMap({ c, fl, seg, cursor, gran, onSelect, onCursor, onGran }: Props) {
  const W = 1180, H = 470, padL = 104, padR = 100, mid = 235, laneGap = 15
  const L = c.corridor.length_m
  const x = (m: number) => W - padR - (m / L) * (W - padL - padR)
  const ref = useMemo(() => modeReference(fl), [fl])

  // lane y positions: westbound band above the centre (north side), eastbound below
  const laneY = (dir: Dir, i: number) => dir === 'wb' ? mid - 16 - (3 - i) * laneGap : mid + 16 + (3 - i) * laneGap
  // MODES order is outermost first: ped, bike, veh, bus. Outermost = furthest from centre.
  const yFor = (dir: Dir, idx: number) => laneY(dir, idx)

  // time controls
  const steps = gran === 'hour' ? 24 : gran === 'day' ? daysIn(cursor.y, cursor.m) : gran === 'month' ? 12 : (2026 - 1984 + 1)
  const value = gran === 'hour' ? cursor.h : gran === 'day' ? cursor.d - 1 : gran === 'month' ? cursor.m - 1 : cursor.y - 1984
  const setValue = (v: number) => onCursor(gran === 'hour' ? { ...cursor, h: v } : gran === 'day' ? { ...cursor, d: v + 1 } : gran === 'month' ? { ...cursor, m: v + 1, d: Math.min(cursor.d, daysIn(cursor.y, v + 1)) } : { ...cursor, y: 1984 + v, d: Math.min(cursor.d, daysIn(1984 + v, cursor.m)) })
  const tick = (i: number) => gran === 'hour' ? `${i}:00` : gran === 'day' ? `${i + 1}` : gran === 'month' ? ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'][i] : `${1984 + i}`

  const lanes = c.segments.flatMap(s => (['wb', 'eb'] as Dir[]).flatMap(dir => MODES.map((m, i) => { const v = laneRate(fl, s.id, m.mode, dir, cursor, gran); return { s, dir, m, i, v, ratio: v.rate == null ? null : Math.min(1, v.rate / (gran === 'hour' ? ref.hour : ref.avg)[m.mode]) } })))
  const subwayMax = Math.max(1, ...Object.values(fl.subway).map(v => v ?? 0))

  return (
    <div className="flowwrap">
      <div className="flowtop">
        <div>
          <div className="maptitle">{seg ? seg.name : `${c.corridor.to} to ${c.corridor.from}`}</div>
          <div className="mapsub">{seg ? `${(seg.length_m / 1000).toFixed(1)} km` : `${(c.corridor.length_m / 1000).toFixed(1)} km · 17 stretches`} · each line is one kind of movement in one direction; denser and brighter means more people per hour</div>
        </div>
        <div className="timebox">
          <div className="when">{label(cursor, gran)}</div>
          <div className="whenbasis">{gran === 'hour' ? 'a typical weekday hour, from the latest count or counter' : gran === 'day' ? 'latest City count on or before this day; counters for that day' : `latest counts as of this ${gran}; counter averages`}</div>
        </div>
      </div>
      <div className="flowbody">
        <svg viewBox={`0 0 ${W} ${H}`} className="flowmap" role="img" aria-label="Flow of people along Bloor Street West by direction and mode">
          <defs><pattern id="grid2" width={60} height={60} patternUnits="userSpaceOnUse"><path d="M60 0H0V60" fill="none" stroke="#000" strokeOpacity={0.035} /></pattern></defs>
          <rect x={0} y={0} width={W} height={H} fill="url(#grid2)" />
          {/* cross streets */}
          {fl.cross_streets.map(cs => { const isStation = fl.boundaries.some(b => Math.abs(b.pos_m - cs.pos_m) < 30); return <g key={cs.pos_m + cs.name} className={`cross ${isStation ? 'station' : ''}`}><line x1={x(cs.pos_m)} x2={x(cs.pos_m)} y1={30} y2={H - 60} /><title>{cs.name}</title></g> })}
          {fl.boundaries.map((b, i) => <g key={b.id} className={`crosslabel ${seg && seg.from !== b.id && seg.to !== b.id ? 'dim' : ''}`}><text x={x(b.pos_m)} y={i % 2 ? 46 : 30} textAnchor="middle">{b.cross_street.split(' / ')[0]}</text><text x={x(b.pos_m)} y={H - 44 + (i % 2 ? 14 : 0)} textAnchor="middle" className="stationname">{b.station}</text></g>)}
          {/* road surface */}
          <rect x={x(L) - 6} y={mid - 16 - 3 * laneGap - 6} width={x(0) - x(L) + 12} height={(3 * laneGap + 16 + 6) * 2} rx={8} className="roadbed" />
          {/* lanes */}
          {lanes.map(l => { const s = l.s; const x0 = x(s.pos_end_m) + 2, x1 = x(s.pos_start_m) - 2; const y = yFor(l.dir, l.i); const load = LOAD(l.ratio); const dash = l.m.mode === 'veh' ? 9 : l.m.mode === 'bus' ? 14 : 4
            const gap = l.ratio == null ? 0 : Math.round(2 + (1 - l.ratio) * 26)
            return <g key={`${s.id}-${l.dir}-${l.m.mode}`} className={`lane ${load} ${seg && seg.id !== s.id ? 'dim' : ''}`} style={{ color: l.m.colour }}>
              <title>{s.name} · {l.m.name} {l.dir === 'eb' ? 'eastbound →' : '← westbound'}: {l.v.rate == null ? 'no data' : `${fmt(l.v.rate)} per hour`} · {l.v.basis}</title>
              {l.ratio == null ? <line x1={x0} x2={x1} y1={y} y2={y} className="empty" strokeWidth={l.m.width} /> :
                <line x1={x0} x2={x1} y1={y} y2={y} className="flow" strokeWidth={l.m.width} style={{ strokeDasharray: `${dash} ${gap}`, animationDuration: `${(l.m.speed * (dash + gap)) / 10}s`, animationDirection: l.dir === 'eb' ? 'reverse' : 'normal' }} />}
            </g> })}
          {/* subway, centre */}
          {c.segments.map(s => { const a = fl.subway[s.from] ?? 0, b = fl.subway[s.to] ?? 0; const r = (a + b) / 2 / subwayMax; const x0 = x(s.pos_end_m) + 2, x1 = x(s.pos_start_m) - 2
            return <g key={s.id + 'sub'} className={`lane subway ${seg && seg.id !== s.id ? 'dim' : ''}`}><title>{s.name} · subway, Line 2: about {fmt((a + b) / 2)} riders a weekday at each end station, both directions; no hourly data</title>
              <line x1={x0} x2={x1} y1={mid} y2={mid} className="flow" strokeWidth={6} style={{ strokeDasharray: `18 ${Math.max(6, Math.round(60 * (1 - r) + 6))}`, animationDuration: '6s' }} /></g> })}
          {/* selection hit areas */}
          {c.segments.map(s => <rect key={s.id + 'hit'} x={x(s.pos_end_m)} y={mid - 16 - 3 * laneGap - 6} width={x(s.pos_start_m) - x(s.pos_end_m)} height={(3 * laneGap + 16 + 6) * 2} className={`hit ${seg?.id === s.id ? 'on' : ''}`} onClick={() => onSelect(seg?.id === s.id ? null : s.id)} tabIndex={0} role="button" aria-label={s.name} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(seg?.id === s.id ? null : s.id) } }} />)}
          {/* direction and lane labels at the right edge */}
          <text x={x(0) + 8} y={mid - 16 - 3 * laneGap - 12} className="dirlabel">← westbound</text>
          <text x={x(0) + 8} y={mid + 16 + 3 * laneGap + 20} className="dirlabel">eastbound →</text>
          {MODES.map((m, i) => <g key={m.name}><text x={x(L) - 12} y={yFor('wb', i) + 3} textAnchor="end" className="lanelabel" style={{ fill: m.colour }}>{m.name}</text><text x={x(L) - 12} y={yFor('eb', i) + 3} textAnchor="end" className="lanelabel" style={{ fill: m.colour }}>{m.name}</text></g>)}
          <text x={x(L) - 12} y={mid + 3} textAnchor="end" className="lanelabel" style={{ fill: '#8b7a9e' }}>subway</text>
          <g className="flowlegend" transform={`translate(${padL - 90}, ${H - 8})`}>
            <text x={0} y={0}>density: people per hour against the busiest {gran === 'hour' ? 'hour' : 'day-average'} measured for that kind of movement on this street</text>
            <line x1={560} x2={590} y1={-4} y2={-4} className="lg light" /><text x={596} y={0}>light</text>
            <line x1={640} x2={670} y1={-4} y2={-4} className="lg busy" /><text x={676} y={0}>busy</text>
            <line x1={716} x2={746} y1={-4} y2={-4} className="lg peak" /><text x={752} y={0}>near the street's peak</text>
            <line x1={900} x2={930} y1={-4} y2={-4} className="lg none" /><text x={936} y={0}>no data</text>
          </g>
        </svg>
        <div className="zoom">
          <span className="zl"><b>+</b> hours</span>
          <input type="range" min={0} max={GRANS.length - 1} value={GRANS.indexOf(gran)} onChange={e => onGran(GRANS[parseInt(e.target.value)])} aria-label="time zoom" className="vslider" />
          <span className="zl"><b>−</b> years</span>
        </div>
      </div>
      <div className="flowslider">
        <input type="range" min={0} max={steps - 1} value={value} onChange={e => setValue(parseInt(e.target.value))} aria-label={`move through ${gran}s`} className="bigslider" />
        <div className="ticks">{Array.from({ length: steps }, (_, i) => <span key={i} style={{ left: `${(i / (steps - 1)) * 100}%` }} className={(gran === 'year' && (i % 5)) || (gran === 'day' && i % 5 !== 0 && i !== steps - 1) || (gran === 'hour' && i % 3) ? 'minor' : ''}>{tick(i)}</span>)}</div>
        <div className="slidernote">moving through <b>{gran}s</b> · use the small slider to zoom time · {cursorDate(cursor)}</div>
      </div>
    </div>
  )
}
