import { useState } from 'react'
import type { Corridor as C, Segment } from './types'
import { MODE_COLOURS, MODE_LABEL, QUESTIONS, minutes, type Behaviour, type QId, type Q1, type Q2 } from './behaviour'
import { fmt } from './data'

const SERIES = ['#1f2a30', '#6a9bb5', '#c9a86a', '#8b7a9e']
type P = { c: C; b: Behaviour; seg: Segment | null }

export function Questions({ c, b, seg }: P) {
  const [q, setQ] = useState<QId>('q4')
  const Q = QUESTIONS.find(x => x.id === q)!
  return (
    <section className="questions">
      <div className="qpills">{QUESTIONS.map(x => <button key={x.id} className={q === x.id ? 'on' : ''} onClick={() => setQ(x.id)}>{x.short}</button>)}</div>
      <div className="qcard">
        <h2>{Q.text}</h2>
        {q === 'q1' && <Weather c={c} b={b} seg={seg} />}
        {q === 'q2' && <Hours c={c} b={b} seg={seg} />}
        {q === 'q3' && <Peaks c={c} b={b} seg={seg} />}
        {q === 'q4' && <Mode c={c} b={b} seg={seg} />}
        {q === 'q5' && <Conflicts c={c} b={b} seg={seg} />}
        {q === 'q6' && <Parallel c={c} b={b} seg={seg} />}
      </div>
    </section>
  )
}

/* ---------- shared chart bits ---------- */
function Axis({ W, H, pl, pb, ymax, yfmt, xlabels }: { W: number; H: number; pl: number; pb: number; ymax: number; yfmt: (v: number) => string; xlabels: { x: number; t: string }[] }) {
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => f * ymax)
  return <g className="axis">
    {ticks.map(v => <g key={v}><line x1={pl} x2={W - 8} y1={H - pb - (v / ymax) * (H - pb - 10)} y2={H - pb - (v / ymax) * (H - pb - 10)} className="grid" /><text x={pl - 6} y={H - pb - (v / ymax) * (H - pb - 10) + 3} textAnchor="end">{yfmt(v)}</text></g>)}
    {xlabels.map(l => <text key={l.t + l.x} x={l.x} y={H - pb + 14} textAnchor="middle">{l.t}</text>)}
  </g>
}
const Note = ({ children }: { children: React.ReactNode }) => <p className="qnote">{children}</p>
const Cannot = ({ children }: { children: React.ReactNode }) => <p className="qcannot"><b>What this cannot show.</b> {children}</p>

/* ---------- Q1 weather response ---------- */
function Weather({ c, b, seg }: P) {
  const all = b.q1_weather
  const mine = seg ? all.filter(x => x.segment === seg.id) : all
  const W = 720, H = 260, pl = 44, pb = 28
  const bins = all[0].dry_bins.map(x => x.lo)
  const x = (lo: number) => pl + ((lo + 2.5 - bins[0]) / (bins[bins.length - 1] + 5 - bins[0])) * (W - pl - 12)
  const normalize = !seg
  const ymax = normalize ? 120 : Math.max(...mine.flatMap(q => [...q.dry_bins, ...q.wet_bins].map(z => z.mean ?? 0))) * 1.08 || 1
  const y = (v: number) => H - pb - (v / ymax) * (H - pb - 10)
  const val = (q: Q1, z: { mean: number | null }) => z.mean == null ? null : normalize ? (q.summer_mean ? (100 * z.mean) / q.summer_mean : null) : z.mean
  const path = (q: Q1, series: Q1['dry_bins']) => { let d = '', pen = false; for (const z of series) { const v = val(q, z); if (v == null) { pen = false; continue } d += `${pen ? 'L' : 'M'}${x(z.lo).toFixed(1)},${y(v).toFixed(1)}`; pen = true } return d }
  if (!mine.length) return <><Note>No permanent bicycle counter on this stretch, so this question cannot be asked here. It can be asked on {all.map(q => c.segments.find(s => s.id === q.segment)?.name).join(', ')}.</Note><Cannot>Anything about this stretch. Counters exist on 4 of 17.</Cannot></>
  const seg1 = (q: Q1) => c.segments.find(s => s.id === q.segment)?.name
  return <>
    <Note>{normalize ? <>Each line is one counter, scaled so its warm-weather weekday average is 100. A flat line means people keep riding through cold; a steep one means they stop. Dashed lines are rainy weekdays.</> : <>Mean bicycles on a weekday at {mine[0].counter}, by temperature. Solid: dry days. Dashed: days with 2 mm or more of rain. Weekdays since {mine[0].since}.</>}</Note>
    <svg viewBox={`0 0 ${W} ${H}`} className="chart">
      <Axis W={W} H={H} pl={pl} pb={pb} ymax={ymax} yfmt={v => normalize ? `${Math.round(v)}%` : fmt(v)} xlabels={bins.filter((_, i) => i % 2 === 0).map(lo => ({ x: x(lo), t: `${lo}°` }))} />
      {mine.map((q, i) => <g key={q.counter} style={{ color: SERIES[all.indexOf(q) % SERIES.length] }}>
        <path d={path(q, q.dry_bins)} className="line" /><path d={path(q, q.wet_bins)} className="line dashed" />
        {q.dry_bins.map(z => { const v = val(q, z); return v == null ? null : <circle key={z.lo} cx={x(z.lo)} cy={y(v)} r={2.5} className="dot"><title>{z.lo} to {z.lo + 5} °C, dry: {fmt(z.mean)} a day over {z.n} weekdays</title></circle> })}
        {normalize && <text x={W - 10} y={14 + i * 14} textAnchor="end" className="serieslabel">{q.counter}</text>}
      </g>)}
    </svg>
    <div className="qfacts">{mine.map(q => <div key={q.counter} className="qfact">
      <div className="k">{q.counter} <span className="muted">· {seg1(q)}</span></div>
      <div className="v">{q.per_degree != null ? <>+{fmt(q.per_degree)} riders per °C</> : '—'}</div>
      <div className="s">between 0 and 25 °C on dry weekdays. Winter keeps <b>{q.winter_retention_pct ?? '—'}%</b> of the warm-weather riders; a rainy day keeps <b>{q.rain_retention_pct ?? '—'}%</b> at the same temperature. {q.dry_days} dry and {q.wet_days} rainy weekdays.</div>
    </div>)}</div>
    <Cannot>Why the curves differ. Downtown stretches have protected lanes, more destinations and more short trips; this chart cannot separate those. It shows the size of the response, and that it differs by stretch.</Cannot>
  </>
}

/* ---------- Q2 time of day ---------- */
function Hours({ c, b, seg }: P) {
  const all = b.q2_hours
  const mine = seg ? all.filter(x => x.segment === seg.id) : all
  if (!mine.length) return <><Note>No permanent counter on this stretch. The two stations' City counts give a single peak-hour figure but not the shape of the day.</Note><Cannot>Anything hourly about this stretch.</Cannot></>
  const W = 720, H = 220, pl = 44, pb = 28
  const x = (h: number) => pl + (h / 23) * (W - pl - 12)
  const verdict = (q: Q2) => q.am_eastbound_pct >= 62 && q.pm_eastbound_pct <= 45 ? 'a commuting route: eastbound in the morning, westbound in the evening' : q.peak_share_pct >= 42 ? 'peaked at rush hours, but balanced in direction' : 'used through the day in both directions, more like a destination than a route'
  return <>
    <Note>Average bicycles per hour on a weekday over the last 12 months, eastbound and westbound. Below it, the same hours on dry weekdays against rainy ones.</Note>
    <div className={`multi ${mine.length > 1 ? 'grid' : ''}`}>{mine.map(q => {
      const ymax = Math.max(...q.eb, ...q.wb) * 1.1 || 1; const y = (v: number) => H - pb - (v / ymax) * (H - pb - 10)
      const line = (a: number[]) => a.map((v, h) => `${h ? 'L' : 'M'}${x(h).toFixed(1)},${y(v).toFixed(1)}`).join('')
      const ret = q.dry_hourly && q.wet_hourly ? q.dry_hourly.map((d, h) => d >= 5 ? Math.round((100 * (q.wet_hourly as number[])[h]) / d) : null) : null
      const at = (h: number) => ret?.[h] ?? null
      return <div key={q.counter} className="qpanel">
        <div className="k">{q.counter} <span className="muted">· {c.segments.find(s => s.id === q.segment)?.name}</span></div>
        <svg viewBox={`0 0 ${W} ${H}`} className="chart">
          <Axis W={W} H={H} pl={pl} pb={pb} ymax={ymax} yfmt={v => fmt(v)} xlabels={[0, 6, 9, 12, 15, 18, 21].map(h => ({ x: x(h), t: `${h}:00` }))} />
          <path d={line(q.eb)} className="line" style={{ color: SERIES[0] }} /><path d={line(q.wb)} className="line" style={{ color: SERIES[1] }} />
          <text x={W - 10} y={14} textAnchor="end" className="serieslabel" style={{ fill: SERIES[0] }}>eastbound</text><text x={W - 10} y={28} textAnchor="end" className="serieslabel" style={{ fill: SERIES[1] }}>westbound</text>
        </svg>
        <div className="s">Reads as {verdict(q)}. {q.peak_share_pct}% of the day's riders pass in the two rush-hour windows; {q.am_eastbound_pct}% of morning riders head east, {q.pm_eastbound_pct}% of evening riders. {q.days} weekdays.</div>
        {ret && <div className="s">On rainy weekdays, riders at 8:00 are {at(8) ?? '—'}% of a dry day; at 12:00, {at(12) ?? '—'}%; at 17:00, {at(17) ?? '—'}%. {q.wet_days} rainy weekdays against {q.dry_days} dry.</div>}
      </div>
    })}</div>
    <Cannot>Trip purpose or who the riders are. A morning eastbound surge is consistent with commuting downtown; it does not prove it.</Cannot>
  </>
}

/* ---------- Q3 peak spreading ---------- */
function Peaks({ c, b, seg }: P) {
  const ids = seg ? [seg.from, seg.to] : c.boundaries.map(x => x.id)
  const rows = ids.map(id => ({ b: c.boundaries.find(x => x.id === id)!, p: (b.q3_peaks[id] ?? []).filter(x => x.am_start && x.am_veh) }))
  const W = 720, H = 220, pl = 48, pb = 28
  const years = [1984, 2027]; const x = (d: string) => pl + ((parseInt(d.slice(0, 4)) + (parseInt(d.slice(5, 7)) - 1) / 12 - years[0]) / (years[1] - years[0])) * (W - pl - 12)
  const ymin = 6 * 60, ymax = 10 * 60; const y = (m: number) => H - pb - ((m - ymin) / (ymax - ymin)) * (H - pb - 10)
  return <>
    <Note>Start of the busiest morning hour for vehicles at each City count since 1984. If the rush hour is spreading, the start drifts earlier and the peak hour holds a smaller share of the day. Each dot is one count day.</Note>
    <svg viewBox={`0 0 ${W} ${H}`} className="chart">
      <g className="axis">{[6, 7, 8, 9, 10].map(h => <g key={h}><line x1={pl} x2={W - 8} y1={y(h * 60)} y2={y(h * 60)} className="grid" /><text x={pl - 6} y={y(h * 60) + 3} textAnchor="end">{h}:00</text></g>)}
        {[1985, 1995, 2005, 2015, 2025].map(yr => <text key={yr} x={x(`${yr}-01`)} y={H - pb + 14} textAnchor="middle">{yr}</text>)}</g>
      {rows.map((r, i) => <g key={r.b.id} style={{ color: seg ? SERIES[i] : '#1f2a30' }}>{r.p.map(p => { const m = minutes(p.am_start); return m == null ? null : <circle key={p.date} cx={x(p.date)} cy={y(Math.max(ymin, Math.min(ymax, m)))} r={seg ? 4 : 2.5} className="dot" opacity={seg ? 0.9 : 0.45}><title>{r.b.station}, {p.date}: morning peak starts {p.am_start}, {fmt(p.am_veh)} vehicles in that hour ({p.duration}h count)</title></circle> })}</g>)}
      {seg && rows.map((r, i) => <text key={r.b.id} x={W - 10} y={14 + i * 14} textAnchor="end" className="serieslabel" style={{ fill: SERIES[i] }}>{r.b.station}</text>)}
    </svg>
    <table className="qtable"><thead><tr><th>station</th><th>first count</th><th>AM peak then</th><th>latest count</th><th>AM peak now</th><th>peak-hour vehicles then → now</th></tr></thead><tbody>
      {rows.filter(r => r.p.length >= 2).map(r => { const a = r.p[0], z = r.p[r.p.length - 1]; return <tr key={r.b.id}><td>{r.b.station}</td><td>{a.date.slice(0, 4)}</td><td>{a.am_start}</td><td>{z.date.slice(0, 4)}</td><td>{z.am_start}</td><td>{fmt(a.am_veh)} → {fmt(z.am_veh)}</td></tr> })}
    </tbody></table>
    <Cannot>Congestion or delay. Peak spreading is consistent with an intersection near capacity, but count methods changed over forty years (8-hour counts before, 14-hour since about 2022), so compare the peak hour, never the daily total.</Cannot>
  </>
}

/* ---------- Q4 mode share ---------- */
function Mode({ c, b, seg }: P) {
  const segs = seg ? [seg] : c.segments
  const keys = ['car', 'foot', 'bike', 'subway'] as const
  return <>
    <Note>Who passes through each stretch's stations on the latest City count day, plus a typical weekday of subway riders at those stations. Vehicles are counted as {b.occupancy} people each.</Note>
    <div className="modelist">{segs.map(s => { const m = b.q4_mode.segment[s.id]; if (!m) return <div key={s.id} className="moderow"><div className="k">{s.name}</div><div className="s">no count</div></div>
      return <div key={s.id} className="moderow"><div className="k">{s.name}</div><div className="modebar">{keys.map(k => <span key={k} style={{ width: `${m[k]}%`, background: MODE_COLOURS[k] }} title={`${m[k]}% ${MODE_LABEL[k]}`}>{m[k] >= 12 ? `${m[k]}%` : ''}</span>)}</div></div> })}</div>
    <div className="modelegend">{keys.map(k => <span key={k}><i style={{ background: MODE_COLOURS[k] }} />{MODE_LABEL[k]}</span>)}</div>
    {seg && [seg.from, seg.to].map(id => { const st = b.q4_mode.station[id]; const bd = c.boundaries.find(x => x.id === id)!; return st ? <div key={id} className="s"><b>{bd.station}</b>: {fmt(st.car)} people in vehicles, {fmt(st.foot)} on foot, {fmt(st.bike)} on bicycles on {st.date} ({st.hours}-hour count); {st.subway != null ? `${fmt(st.subway)} subway riders on a typical weekday (Sep 2024 to Nov 2025).` : 'no subway figure.'}</div> : null })}
    <Cannot>Growth or decline. Each station's count is one day, years apart from its neighbour's, and subway riders are annual figures. This is composition, not trend.</Cannot>
  </>
}

/* ---------- Q5 conflicts ---------- */
function Conflicts({ c, b, seg }: P) {
  const ids = seg ? [seg.from, seg.to] : c.boundaries.map(x => x.id)
  const ksi = ids.map(id => ({ bd: c.boundaries.find(x => x.id === id)!, k: b.q5_conflicts.ksi[id], d: b.q5_conflicts.subway[id] }))
  const agg = (pick: (k: NonNullable<(typeof ksi)[number]['k']>) => [string, number][]) => { const m = new Map<string, number>(); for (const r of ksi) if (r.k) for (const [a, n] of pick(r.k)) m.set(a, (m.get(a) ?? 0) + n); return [...m].sort((a, z) => z[1] - a[1]) }
  const dagg = () => { const m = new Map<string, number>(); for (const r of ksi) if (r.d) for (const t of r.d.top) m.set(t.what, (m.get(t.what) ?? 0) + t.n); return [...m].sort((a, z) => z[1] - a[1]).slice(0, 6) }
  const total = ksi.reduce((a, r) => a + (r.k?.n ?? 0), 0)
  return <>
    <Note>How the people killed or seriously injured at these stations were hit, and who they were, in police records since 2006. Below, what stops the trains at these stations, from TTC delay logs since January 2025.</Note>
    <div className="twocol">
      <div><div className="k">On the street: {total} people killed or seriously injured{seg ? ' at these two stations' : ' at the 18 stations'}</div>
        <table className="qtable"><tbody>{agg(k => k.impact).slice(0, 6).map(([a, n]) => <tr key={a}><td>{a.replace(" (internal code)", "")}</td><td>{n}</td><td className="muted">{Math.round((100 * n) / total)}%</td></tr>)}</tbody></table>
        <div className="s">{agg(k => k.user).map(([u, n]) => `${n} ${u}`).join(', ')}. {seg ? ksi.filter(r => r.k).map(r => `${r.bd.station}: ${r.k!.dark_pct}% in the dark`).join('; ') : ''}</div></div>
      <div><div className="k">On the platform: what delays Line 2 here</div>
        <table className="qtable"><tbody>{dagg().map(([w, n]) => <tr key={w}><td>{w}</td><td>{n}</td></tr>)}</tbody></table>
        <div className="s">{ksi.filter(r => r.d).reduce((a, r) => a + r.d!.total, 0)} logged delays over {ksi.find(r => r.d)?.d?.months ?? 0} months.</div></div>
    </div>
    <Cannot>Risk. These are patterns without exposure. "Turning movement" being the most common impact says how the design gets hit, not how often per crossing.</Cannot>
  </>
}

/* ---------- Q6 parallel streets ---------- */
function Parallel({ c, b, seg }: P) {
  const segs = seg ? [seg] : c.segments
  const rows = segs.flatMap(s => (b.q6_parallel[s.id] ?? []).map(p => ({ ...p, seg: s.name })))
  const byInt = new Map<string, typeof rows>(); for (const r of rows) byInt.set(r.name, [...(byInt.get(r.name) ?? []), r])
  const list = [...byInt].map(([name, l]) => { l.sort((a, z) => a.date.localeCompare(z.date)); return { name, street: l[0].street, side: l[0].side, offset: l[0].offset_m, seg: l[0].seg, first: l[0], last: l[l.length - 1], n: l.length } }).sort((a, z) => z.last.date.localeCompare(a.last.date))
  return <>
    <Note>City vehicle counts on the parallel streets within 150 to 900 m of this {seg ? 'stretch' : 'street'}: {b.parallel_streets.join(', ')}. This is a watch list. It becomes an answer only when a count taken after a change on Bloor can be set against one taken before.</Note>
    {list.length ? <table className="qtable"><thead><tr><th>intersection</th><th>side</th><th>distance</th><th>counts</th><th>earliest</th><th>latest</th></tr></thead><tbody>
      {list.slice(0, 40).map(r => <tr key={r.name}><td>{r.name}{!seg && <span className="muted"> · {r.seg}</span>}</td><td>{r.side}</td><td>{r.offset} m</td><td>{r.n}</td><td>{r.first.date.slice(0, 4)}: {fmt(r.first.veh)}</td><td>{r.last.date.slice(0, 4)}: {fmt(r.last.veh)}</td></tr>)}
    </tbody></table> : <Note>No City count on a named parallel street near this stretch.</Note>}
    <Cannot>Diversion, yet. Two counts years apart on a side street differ for many reasons. The comparison that matters is a count after a Bloor change against the same intersection before it, and none exists yet.</Cannot>
  </>
}
