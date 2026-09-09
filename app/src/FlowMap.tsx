import { useMemo } from 'react'
import type { Corridor as C, Segment } from './types'
import { GRANS, cursorDate, daysIn, label, laneRate, modeReference, type Cursor, type Dir, type Flow, type Gran, type Mode } from './flow'
import { fmt } from './data'

type Props = { c: C; fl: Flow; seg: Segment | null; cursor: Cursor; gran: Gran; onSelect: (id: string | null) => void; onCursor: (c: Cursor) => void; onGran: (g: Gran) => void }

const MODES: { mode: Mode; name: string; colour: string; max: number }[] = [
  { mode: 'ped', name: 'on foot', colour: '#c9a86a', max: 16 },
  { mode: 'bike', name: 'bicycles', colour: '#6a9bb5', max: 16 },
  { mode: 'veh', name: 'vehicles', colour: '#5b6670', max: 22 },
  { mode: 'bus', name: 'buses', colour: '#9a7b52', max: 10 },
]
const SUBWAY = '#8b7a9e'

export function FlowMap({ c, fl, seg, cursor, gran, onSelect, onCursor, onGran }: Props) {
  const W = 1180, H = 480, padL = 96, padR = 96, mid = 250, gap = 40, laneStep = 30
  const L = c.corridor.length_m
  const x = (m: number) => W - padR - (m / L) * (W - padL - padR)
  const ref = useMemo(() => modeReference(fl), [fl])

  // Lane centre lines. Outermost lane (on foot) is furthest from the centre; the two sides are separated by `gap` on each side of the subway.
  const laneY = (dir: Dir, i: number) => dir === 'wb' ? mid - gap - (3 - i) * laneStep - 8 : mid + gap + (3 - i) * laneStep + 8

  // Time controls.
  const steps = gran === 'hour' ? 24 : gran === 'day' ? daysIn(cursor.y, cursor.m) : gran === 'month' ? 12 : (2026 - 1984 + 1)
  const value = gran === 'hour' ? cursor.h : gran === 'day' ? cursor.d - 1 : gran === 'month' ? cursor.m - 1 : cursor.y - 1984
  const setValue = (v: number) => onCursor(gran === 'hour' ? { ...cursor, h: v } : gran === 'day' ? { ...cursor, d: v + 1 } : gran === 'month' ? { ...cursor, m: v + 1, d: Math.min(cursor.d, daysIn(cursor.y, v + 1)) } : { ...cursor, y: 1984 + v, d: Math.min(cursor.d, daysIn(1984 + v, cursor.m)) })
  const tick = (i: number) => gran === 'hour' ? `${i}:00` : gran === 'day' ? `${i + 1}` : gran === 'month' ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i] : `${1984 + i}`

  // Everything the map draws for this moment, computed once per cursor change.
  const lanes = useMemo(() => c.segments.flatMap(s => (['wb', 'eb'] as Dir[]).flatMap(dir => MODES.map((m, i) => {
    const v = laneRate(fl, s.id, m.mode, dir, cursor, gran)
    const r = v.rate == null ? null : Math.min(1, v.rate / (gran === 'hour' ? ref.hour : ref.avg)[m.mode])
    return { s, dir, m, i, v, width: r == null ? 0 : 1.5 + Math.sqrt(r) * (m.max - 1.5) }
  }))), [c, fl, cursor, gran, ref])
  const subwayMax = Math.max(1, ...Object.values(fl.subway).map(v => v ?? 0))
  const focus = (s: Segment) => seg ? (seg.id === s.id ? 'on' : 'dim') : ''

  return (
    <div className="flowwrap">
      <div className="flowtop">
        <div>
          <div className="maptitle">{seg ? seg.name : `${c.corridor.to} to ${c.corridor.from}`}</div>
          <div className="mapsub">{seg ? `${(seg.length_m / 1000).toFixed(1)} km` : `${(c.corridor.length_m / 1000).toFixed(1)} km · 17 stretches`} · line thickness is people per hour, by kind of movement and direction</div>
        </div>
        <div className="timebox">
          <div className="when">{label(cursor, gran)}</div>
          <div className="whenbasis">{gran === 'hour' ? 'a typical weekday hour, from the latest count or counter' : gran === 'day' ? 'latest City count on or before this day; counters for that day' : `latest counts as of this ${gran}; counter averages`}</div>
        </div>
      </div>
      <div className="flowbody">
        <svg viewBox={`0 0 ${W} ${H}`} className="flowmap" role="img" aria-label="Flow of people along Bloor Street West by direction and kind of movement">
          {/* station cross streets, labelled once */}
          {fl.boundaries.map((b, i) => <g key={b.id} className={`station ${seg && seg.from !== b.id && seg.to !== b.id ? 'dim' : ''}`}>
            <line x1={x(b.pos_m)} x2={x(b.pos_m)} y1={laneY('wb', 0) - 22} y2={laneY('eb', 0) + 22} />
            <text x={x(b.pos_m)} y={laneY('wb', 0) - 30 - (i % 2 ? 16 : 0)} textAnchor="middle">{b.station}</text>
          </g>)}
          {/* lanes: continuous lines, thickness = rate */}
          {lanes.map(l => { const y = laneY(l.dir, l.i); const x0 = x(l.s.pos_end_m) + 1, x1 = x(l.s.pos_start_m) - 1
            return <g key={`${l.s.id}-${l.dir}-${l.m.mode}`} className={`lane ${focus(l.s)}`}>
              <title>{l.s.name} · {l.m.name} {l.dir === 'eb' ? 'eastbound →' : '← westbound'}: {l.v.rate == null ? 'no data' : `${fmt(l.v.rate)} per hour`} · {l.v.basis}</title>
              {l.width ? <line x1={x0} x2={x1} y1={y} y2={y} stroke={l.m.colour} strokeWidth={l.width} strokeLinecap="butt" /> : <line x1={x0} x2={x1} y1={y} y2={y} className="nodata" />}
            </g> })}
          {/* subway in the centre */}
          {c.segments.map(s => { const a = fl.subway[s.from] ?? 0, b = fl.subway[s.to] ?? 0; const r = (a + b) / 2 / subwayMax
            return <g key={s.id + 'sub'} className={`lane ${focus(s)}`}><title>{s.name} · subway, Line 2: about {fmt((a + b) / 2)} riders a weekday at each end station, both directions; no hourly data</title>
              <line x1={x(s.pos_end_m) + 1} x2={x(s.pos_start_m) - 1} y1={mid} y2={mid} stroke={SUBWAY} strokeWidth={2 + Math.sqrt(r) * 12} /></g> })}
          {/* click targets */}
          {c.segments.map(s => <rect key={s.id + 'hit'} x={x(s.pos_end_m)} y={laneY('wb', 0) - 18} width={x(s.pos_start_m) - x(s.pos_end_m)} height={laneY('eb', 0) - laneY('wb', 0) + 36} className={`hit ${seg?.id === s.id ? 'on' : ''}`} onClick={() => onSelect(seg?.id === s.id ? null : s.id)} tabIndex={0} role="button" aria-label={s.name} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(seg?.id === s.id ? null : s.id) } }} />)}
          {/* labels */}
          <text x={x(0) + 10} y={laneY('wb', 1) + 4} className="dirlabel">← westbound</text>
          <text x={x(0) + 10} y={laneY('eb', 1) + 4} className="dirlabel">eastbound →</text>
          <text x={x(0) + 10} y={mid + 4} className="dirlabel">both ways</text>
          {MODES.map((m, i) => <g key={m.name}><text x={x(L) - 10} y={laneY('wb', i) + 4} textAnchor="end" className="lanelabel" style={{ fill: m.colour }}>{m.name}</text><text x={x(L) - 10} y={laneY('eb', i) + 4} textAnchor="end" className="lanelabel" style={{ fill: m.colour }}>{m.name}</text></g>)}
          <text x={x(L) - 10} y={mid + 4} textAnchor="end" className="lanelabel" style={{ fill: SUBWAY }}>subway</text>
          <text x={padL} y={H - 10} className="flownote">Thicker is more people per hour, scaled against the busiest measured for that kind of movement on this street. A hairline means no measurement. Hover a line for the number and its source.</text>
        </svg>
        <div className="zoom">
          <span className="zl"><b>+</b> hours</span>
          <input type="range" min={0} max={GRANS.length - 1} value={GRANS.indexOf(gran)} onChange={e => onGran(GRANS[parseInt(e.target.value)])} aria-label="time zoom" className="vslider" />
          <span className="zl"><b>−</b> years</span>
        </div>
      </div>
      <div className="flowslider">
        <input type="range" min={0} max={steps - 1} step={1} value={value} onInput={e => setValue(parseInt((e.target as HTMLInputElement).value))} onChange={e => setValue(parseInt(e.target.value))} aria-label={`move through ${gran}s`} className="bigslider" />
        <div className="ticks">{Array.from({ length: steps }, (_, i) => <span key={i} style={{ left: `${(i / (steps - 1)) * 100}%` }} className={(gran === 'year' && (i % 5)) || (gran === 'day' && i % 5 !== 0 && i !== steps - 1) || (gran === 'hour' && i % 3) ? 'minor' : ''}>{tick(i)}</span>)}</div>
        <div className="slidernote">moving through <b>{gran}s</b> · the small slider zooms time · {cursorDate(cursor)}</div>
      </div>
    </div>
  )
}
