import { useMemo, type ReactElement } from 'react'
import type { Corridor as C, Segment } from './types'
import { GRANS, cursorDate, daysIn, label, laneRate, modeReference, type Cursor, type Dir, type Flow, type Gran, type Mode } from './flow'
import { fmt } from './data'

type Props = { c: C; fl: Flow; seg: Segment | null; cursor: Cursor; gran: Gran; onSelect: (id: string | null) => void; onCursor: (c: Cursor) => void; onGran: (g: Gran) => void }

type LaneMode = Mode | 'subway'
const LANES: { mode: LaneMode; name: string; colour: string; max: number }[] = [
  { mode: 'ped', name: 'on foot', colour: '#c9a86a', max: 18 },
  { mode: 'bike', name: 'bicycles', colour: '#6a9bb5', max: 18 },
  { mode: 'veh', name: 'vehicles', colour: '#5b6670', max: 24 },
  { mode: 'bus', name: 'buses', colour: '#9a7b52', max: 10 },
  { mode: 'subway', name: 'subway', colour: '#8b7a9e', max: 18 },
]
// Pictograms drawn in a 24-unit box, stroke in the lane colour.
const ICON: Record<LaneMode, ReactElement> = {
  ped: <><circle cx={13} cy={4.5} r={1.8} fill="currentColor" /><path d="M11 9l2 1 1.5 3 3 1M13 10l-3 5 1 5M10 15l-3 4M13 13l3 6" /></>,
  bike: <><circle cx={6} cy={16} r={3.5} /><circle cx={18} cy={16} r={3.5} /><path d="M6 16l4-7h4l4 7M10 9l-1.5-3h3M14 9l-2 7" /></>,
  veh: <><path d="M5 13l1.5-4.5A2 2 0 0 1 8.4 7h7.2a2 2 0 0 1 1.9 1.5L19 13v5h-2v-1H7v1H5v-5z" /><circle cx={8} cy={14.5} r={1.2} fill="currentColor" /><circle cx={16} cy={14.5} r={1.2} fill="currentColor" /></>,
  bus: <><rect x={4} y={4} width={16} height={14} rx={2.5} /><path d="M4 12h16M7 18v2M17 18v2" /><circle cx={8} cy={15} r={1} fill="currentColor" /><circle cx={16} cy={15} r={1} fill="currentColor" /></>,
  subway: <><rect x={6} y={3} width={12} height={14} rx={3} /><path d="M6 11h12M9 20l-1.5 2M15 20l1.5 2M8 17l-1 3h10l-1-3" /><circle cx={9.5} cy={14} r={1} fill="currentColor" /><circle cx={14.5} cy={14} r={1} fill="currentColor" /></>,
}

/** Closed path for a ribbon along y with width w(x) at sample points, smoothed with Catmull-Rom curves. Reads like a pipe with bulges. */
function ribbon(pts: { x: number; w: number }[], y: number) {
  if (pts.length < 2) return ''
  const top = pts.map(p => ({ x: p.x, y: y - p.w / 2 })), bot = pts.map(p => ({ x: p.x, y: y + p.w / 2 })).reverse()
  const smooth = (P: { x: number; y: number }[]) => {
    let d = `M${P[0].x.toFixed(1)},${P[0].y.toFixed(1)}`
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[i - 1] ?? P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] ?? p2
      const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6, c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6
      d += `C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`
    }
    return d
  }
  return smooth(top) + `L${bot[0].x.toFixed(1)},${bot[0].y.toFixed(1)}` + smooth(bot).slice(smooth(bot).indexOf('C')) + 'Z'
}

export function FlowMap({ c, fl, seg, cursor, gran, onSelect, onCursor, onGran }: Props) {
  const W = 1180, H = 500, padL = 92, padR = 92, mid = 250, gap = 22, laneStep = 32
  const L = c.corridor.length_m
  const x = (m: number) => W - padR - (m / L) * (W - padL - padR)
  const ref = useMemo(() => modeReference(fl), [fl])
  const laneY = (dir: Dir, i: number) => dir === 'wb' ? mid - gap - (4 - i) * laneStep : mid + gap + (4 - i) * laneStep

  const steps = gran === 'hour' ? 24 : gran === 'day' ? daysIn(cursor.y, cursor.m) : gran === 'month' ? 12 : (2026 - 1984 + 1)
  const value = gran === 'hour' ? cursor.h : gran === 'day' ? cursor.d - 1 : gran === 'month' ? cursor.m - 1 : cursor.y - 1984
  const setValue = (v: number) => onCursor(gran === 'hour' ? { ...cursor, h: v } : gran === 'day' ? { ...cursor, d: v + 1 } : gran === 'month' ? { ...cursor, m: v + 1, d: Math.min(cursor.d, daysIn(cursor.y, v + 1)) } : { ...cursor, y: 1984 + v, d: Math.min(cursor.d, daysIn(1984 + v, cursor.m)) })
  const tick = (i: number) => gran === 'hour' ? `${i}:00` : gran === 'day' ? `${i + 1}` : gran === 'month' ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i] : `${1984 + i}`
  const subwayMax = Math.max(1, ...Object.values(fl.subway).map(v => v ?? 0))

  // One value per stretch per lane, then a ribbon per lane through the stretch midpoints.
  const lanes = useMemo(() => (['wb', 'eb'] as Dir[]).flatMap(dir => LANES.map((m, i) => {
    const cells = c.segments.map(s => {
      if (m.mode === 'subway') { const a = fl.subway[s.from] ?? 0, b = fl.subway[s.to] ?? 0; const v = (a + b) / 2 / 2; return { s, rate: v, ratio: v / (subwayMax / 2), basis: 'typical weekday riders at the two stations, split evenly by direction; no hourly or directional data exists', stale: false } }
      const v = laneRate(fl, s.id, m.mode, dir, cursor, gran)
      const stale = v.source === 'count' && v.date != null && (Date.parse(cursorDate(cursor)) - Date.parse(v.date)) > 365 * 86400000
      return { s, rate: v.rate, ratio: v.rate == null ? null : Math.min(1, v.rate / (gran === 'hour' ? ref.hour : ref.avg)[m.mode]), basis: stale ? `${v.basis} · more than a year before the selected date` : v.basis, stale }
    })
    const w = (r: number | null) => r == null ? 1 : 2 + Math.sqrt(r) * (m.max - 2)
    const pts = [{ x: x(L), w: w(cells[cells.length - 1].ratio) }, ...cells.map(k => ({ x: (x(k.s.pos_start_m) + x(k.s.pos_end_m)) / 2, w: w(k.ratio) })), { x: x(0), w: w(cells[0].ratio) }].sort((a, b) => a.x - b.x)
    return { dir, m, i, cells, d: ribbon(pts, laneY(dir, i)) }
  })), [c, fl, cursor, gran, ref, subwayMax])  // eslint-disable-line react-hooks/exhaustive-deps

  const hitTop = laneY('wb', 0) - 16, hitBot = laneY('eb', 0) + 16

  return (
    <div className="flowwrap">
      <div className="flowtop">
        <div>
          <div className="maptitle">{seg ? seg.name : `${c.corridor.to} to ${c.corridor.from}`}</div>
          <div className="mapsub">{seg ? `${(seg.length_m / 1000).toFixed(1)} km` : `${(c.corridor.length_m / 1000).toFixed(1)} km · 17 stretches`} · each pipe is one kind of movement in one direction; it swells where more people pass per hour</div>
        </div>
        <div className="timebox">
          <div className="when">{label(cursor, gran)}</div>
          <div className="whenbasis">{gran === 'hour' ? 'a typical weekday hour, from the latest count or counter' : gran === 'day' ? 'latest City count on or before this day; counters for that day' : `latest counts as of this ${gran}; counter averages`}</div>
        </div>
      </div>
      <div className="flowbody">
        <svg viewBox={`0 0 ${W} ${H}`} className="flowmap" role="img" aria-label="Flow of people along Bloor Street West by direction and kind of movement">
          {fl.boundaries.map((b, i) => <g key={b.id} className={`station ${seg && seg.from !== b.id && seg.to !== b.id ? 'dim' : ''}`}>
            <line x1={x(b.pos_m)} x2={x(b.pos_m)} y1={hitTop - 4} y2={hitBot + 4} />
            <text x={x(b.pos_m)} y={hitTop - 14 - (i % 2 ? 16 : 0)} textAnchor="middle">{b.station}</text>
          </g>)}
          <defs>
            <pattern id="stale" width={7} height={7} patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1={0} y1={0} x2={0} y2={7} stroke="#fff" strokeWidth={2.2} /></pattern>
            {lanes.map(l => <clipPath key={`clip-${l.dir}-${l.m.mode}`} id={`clip-${l.dir}-${l.m.mode}`}><path d={l.d} /></clipPath>)}
          </defs>
          {/* ribbons */}
          {lanes.map(l => <g key={`${l.dir}-${l.m.mode}`} className={`lane ${seg ? 'hasfocus' : ''}`}>
            <path d={l.d} fill={l.m.colour} />
            {/* age texture: a City count older than a year is hatched */}
            <g clipPath={`url(#clip-${l.dir}-${l.m.mode})`}>{l.cells.filter(k => k.stale).map(k => <rect key={k.s.id + 'stale'} x={x(k.s.pos_end_m)} y={laneY(l.dir, l.i) - laneStep / 2} width={x(k.s.pos_start_m) - x(k.s.pos_end_m)} height={laneStep} fill="url(#stale)" opacity={0.85} />)}</g>
            {/* per-stretch hover targets with the number and source */}
            {l.cells.map(k => <rect key={k.s.id} x={x(k.s.pos_end_m)} y={laneY(l.dir, l.i) - laneStep / 2} width={x(k.s.pos_start_m) - x(k.s.pos_end_m)} height={laneStep} className={`cell ${seg ? (seg.id === k.s.id ? 'on' : 'dim') : ''}`}>
              <title>{k.s.name} · {l.m.name} {l.dir === 'eb' ? 'eastbound →' : '← westbound'}: {k.rate == null ? 'no data' : `${fmt(k.rate)} per hour`} · {k.basis}</title></rect>)}
          </g>)}
          {/* focus veil: dims everything outside the selected stretch */}
          {seg && <><rect x={0} y={hitTop - 40} width={x(seg.pos_end_m)} height={hitBot - hitTop + 80} className="veil" /><rect x={x(seg.pos_start_m)} y={hitTop - 40} width={W - x(seg.pos_start_m)} height={hitBot - hitTop + 80} className="veil" /></>}
          {/* click targets */}
          {c.segments.map(s => <rect key={s.id + 'hit'} x={x(s.pos_end_m)} y={hitTop} width={x(s.pos_start_m) - x(s.pos_end_m)} height={hitBot - hitTop} className={`hit ${seg?.id === s.id ? 'on' : ''}`} onClick={() => onSelect(seg?.id === s.id ? null : s.id)} tabIndex={0} role="button" aria-label={s.name} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(seg?.id === s.id ? null : s.id) } }} />)}
          {/* icons and direction labels */}
          {(['wb', 'eb'] as Dir[]).map(dir => LANES.map((m, i) => <svg key={dir + m.mode} x={x(L) - 40} y={laneY(dir, i) - 12} width={24} height={24} viewBox="0 0 24 24" className="laneicon" style={{ color: m.colour }}><title>{m.name}</title>{ICON[m.mode]}</svg>))}
          <text x={x(0) + 10} y={laneY('wb', 2) + 4} className="dirlabel">← westbound</text>
          <text x={x(0) + 10} y={laneY('eb', 2) + 4} className="dirlabel">eastbound →</text>
          <text x={padL - 40} y={H - 10} className="flownote">Pipes swell with people per hour, scaled against the busiest measured for that kind of movement on this street. A thread means no measurement. Hatched means the count is more than a year old. Subway riders are split evenly by direction. Hover any stretch for the number and its source.</text>
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
