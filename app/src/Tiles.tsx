import { memo, useState, type ReactNode } from 'react'
import type { Corridor as C, Segment } from './types'
import { bikesLastYear, collisionsUsual, compare, counterMonth, countersMonth, delaysCover, delaysMonth, delaysUsual, fmt, ksiCovers, ksiMonth, latestTmc, monthEnd, monthLabel, prevYear, rankSegments, restrictionsMonth, tpsCovers, tpsMonth, tpsRange, usage, weatherCovers, weatherLastYear, weatherMonth } from './data'

function Tile({ title, story, children, raw }: { title: string; story?: ReactNode; children: ReactNode; raw?: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="tile">
      <div className="tilehead"><h3>{title}</h3>{raw && <button className="rawbtn" onClick={() => setOpen(o => !o)}>{open ? 'hide raw data' : 'raw data'}</button>}</div>
      {story && <p className="story">{story}</p>}
      {children}
      {open && raw && <div className="raw">{raw}</div>}
    </div>
  )
}
const Big = ({ v, label }: { v: ReactNode; label: string }) => <div className="big"><div className="v">{v}</div><div className="l">{label}</div></div>
const Row = ({ children }: { children: ReactNode }) => <div className="bigrow">{children}</div>
const Empty = ({ children }: { children: ReactNode }) => <p className="empty">{children}</p>

function TilesInner({ c, seg, ym }: { c: C; seg: Segment | null; ym: string }) {
  const end = monthEnd(ym), ml = monthLabel(ym)
  const stations = seg ? [seg.from, seg.to].map(id => c.boundaries.find(b => b.id === id)!) : c.boundaries
  const counts = stations.map(b => ({ b, t: latestTmc(c, b.id, end) })).filter(o => o.t)
  const veh = counts.reduce((a, o) => a + (o.t!.veh ?? 0), 0), people = counts.reduce((a, o) => a + (o.t!.people ?? 0), 0), bike = counts.reduce((a, o) => a + (o.t!.bike ?? 0), 0), ped = counts.reduce((a, o) => a + (o.t!.ped ?? 0), 0)
  const dates = counts.map(o => o.t!.date).sort()
  const bikes = seg ? counterMonth(c, seg.id, ym) : null
  const cm = countersMonth(c, ym); const cmVals = Object.values(cm)
  const tps = seg ? tpsMonth(c, seg.id, ym) : tpsRange(c, null, ym, ym)
  const ksi = seg ? ksiMonth(c, seg.id, ym) : c.segments.flatMap(s => ksiMonth(c, s.id, ym))
  const w = weatherMonth(c, ym)
  const rest = seg ? restrictionsMonth(c, seg.id, ym) : c.segments.flatMap(s => restrictionsMonth(c, s.id, ym))
  const bsList = seg ? [c.bikeshare[seg.id]].filter(Boolean) : Object.values(c.bikeshare)
  const bs = bsList.length ? { stations: bsList.reduce((a, b) => a + b.stations, 0), capacity: bsList.reduce((a, b) => a + b.capacity, 0) } : null
  const design = seg ? (c.design[seg.id] ?? []) : Object.values(c.design).flat()
  const delays = stations.reduce((a, b) => a + delaysMonth(c, b.id, ym).count, 0)
  const periods = c.subway_usage ? Object.keys(c.subway_usage.periods).sort() : []
  const riders = periods.map(p => stations.reduce((a, b) => a + ((c.subway_usage!.stations[b.id]?.[p] as number) ?? 0), 0))
  const where = seg ? 'this stretch' : 'the whole street'
  const ly = monthLabel(prevYear(ym))
  const bly = bikesLastYear(c, seg?.id ?? null, ym)
  const colUsual = tpsCovers(c, ym) ? collisionsUsual(c, seg?.id ?? null, ym) : null
  const rank = !seg ? rankSegments(c, ym) : null
  const dUsual = delaysCover(c, ym) ? delaysUsual(c, stations.map(b => b.id), ym) : null
  const wly = weatherLastYear(c, ym)
  const cams = stations.flatMap(b => ((c.cameras ?? {})[b.id] ?? []).map(cam => ({ ...cam, station: b.station })))
  const inVeh = people ? Math.round(veh * c.corridor.occupancy_assumption / people * 100) : null

  return (
    <div className="tiles">
      <Tile title="People and vehicles" story={counts.length ? <>On the most recent City count days, about <b>{fmt(people)}</b> people passed through {seg ? 'the two stations' : 'the 18 station intersections'}: {inVeh}% in vehicles, {Math.round(ped / people * 100)}% on foot, {Math.round(bike / people * 100)}% on bicycles.</> : undefined}
        raw={<table><thead><tr><th>station</th><th>counted</th><th>hours</th><th>vehicles</th><th>bicycles</th><th>pedestrians</th><th>people</th></tr></thead><tbody>{stations.flatMap(b => (c.tmc[b.id] ?? []).filter(t => t.date <= end).slice().reverse().map(t => <tr key={b.id + t.date}><td>{b.station}</td><td>{t.date}</td><td>{fmt(t.hours)}</td><td>{fmt(t.veh)}</td><td>{fmt(t.bike)}</td><td>{fmt(t.ped)}</td><td>{fmt(t.people)}</td></tr>))}</tbody></table>}>
        {counts.length ? <>
          <Row><Big v={fmt(veh)} label="vehicles" /><Big v={fmt(people)} label="people" /><Big v={fmt(bike)} label="on bicycles" /><Big v={fmt(ped)} label="on foot" /></Row>
          <p className="sub">Counted by the City {dates.length > 1 && dates[0] !== dates.at(-1) ? `between ${dates[0]} and ${dates.at(-1)}` : `on ${dates[0]}`}, one day per intersection. People = vehicles × {c.corridor.occupancy_assumption} + bicycles + pedestrians. Subway riders are in the subway card.</p>
        </> : <Empty>No City count at these stations on or before {ml}.</Empty>}
      </Tile>

      <Tile title="Bicycles" story={seg ? (bikes?.value != null ? <>About <b>{fmt(bikes.value)}</b> bicycles a day passed the counter in {ml}{bly ? <>, {compare(bly.now, bly.then, ly)}</> : null}.</> : undefined) : (cmVals.length ? <>The street's {cmVals.length} automatic counters averaged <b>{fmt(cmVals.reduce((a, b) => a + b, 0) / cmVals.length)}</b> bicycles a day in {ml}{bly ? <>, {compare(bly.now, bly.then, ly)} at the same counters</> : null}.</> : undefined)}
        raw={seg && bikes?.hasCounter ? <table><thead><tr><th>day</th><th>eastbound</th><th>westbound</th></tr></thead><tbody>{c.counters.filter(k => k.segment === seg.id).flatMap(k => k.daily.filter(d => d[0].startsWith(ym)).map(d => <tr key={k.name + d[0]}><td>{d[0]}</td><td>{fmt(d[1])}</td><td>{fmt(d[2])}</td></tr>))}</tbody></table> : !seg ? <table><thead><tr><th>counter</th><th>bicycles / day</th></tr></thead><tbody>{Object.entries(cm).map(([k, v]) => <tr key={k}><td>{k}</td><td>{fmt(v)}</td></tr>)}</tbody></table> : undefined}>
        {seg ? (bikes!.hasCounter ? (bikes!.value != null ? <Row><Big v={fmt(bikes!.value)} label="bicycles per day, both directions" /><Big v={bikes!.days} label="days measured" /></Row> : <Empty>The counter at {bikes!.name} has no data for {ml}.</Empty>) : <Empty>No automatic counter on this stretch. Bicycles are counted only on City count days, in the card above.</Empty>)
          : (cmVals.length ? <Row>{Object.entries(cm).map(([k, v]) => <Big key={k} v={fmt(v)} label={k.replace('Bloor St W, ', '')} />)}</Row> : <Empty>No automatic counter data for {ml}. Counters run from {c.coverage.counters?.[0]}.</Empty>)}
      </Tile>

      <Tile title="Subway" story={riders.length ? <>About <b>{fmt(riders.at(-1))}</b> riders use {seg ? 'these two stations' : 'the 18 stations'} on a typical weekday.{delaysCover(c, ym) ? <> In {ml}, {delays} delays were logged at them{dUsual != null ? `, ${compare(delays, dUsual, 'a usual month')}` : ''}.</> : null}</> : undefined}
        raw={<table><thead><tr><th>station</th><th>{periods.join(' / ')}</th><th>delays in {ml}</th></tr></thead><tbody>{stations.map(b => { const u = usage(c, b.id); return <tr key={b.id}><td>{b.station}</td><td>{u ? u.values.map(v => fmt(v)).join(' / ') : '—'}</td><td>{delaysCover(c, ym) ? delaysMonth(c, b.id, ym).count : '—'}</td></tr> })}</tbody></table>}>
        <Row>{riders.map((v, i) => <Big key={i} v={fmt(v)} label={`riders per weekday, ${periods[i]}`} />)}{delaysCover(c, ym) ? <Big v={delays} label={`delays in ${ml}`} /> : <Big v="—" label="delays (no data this month)" />}</Row>
        {seg && stations.map(b => { const u = usage(c, b.id); return u?.note ? <p key={b.id} className="sub">{b.station}: {u.note}</p> : null })}
        <p className="sub">Riders: customers to and from the Line 2 platform, from the TTC's annual tables. Delays: any cause, TTC open data from Jan 2025.</p>
      </Tile>

      <Tile title="Collisions" story={tpsCovers(c, ym) ? <>Police recorded <b>{tps.total}</b> collision{tps.total === 1 ? '' : 's'} on {where} in {ml}, {tps.injury} with an injury.{colUsual != null ? <> A usual month has about {fmt(colUsual)}.</> : null}{rank && rank[0].n > 0 ? <> The most were on {rank[0].s.name} ({rank[0].n}){rank[1]?.n ? ` and ${rank[1].s.name} (${rank[1].n})` : ''}.</> : null}{ksiCovers(c, ym) ? (ksi.length ? <> {ksi.length} {ksi.length === 1 ? 'person was' : 'people were'} killed or seriously injured.</> : <> No one was killed or seriously injured.</>) : null}</> : undefined}
        raw={<table><thead><tr><th>month</th><th>all</th><th>injury</th><th>bicycle</th><th>pedestrian</th></tr></thead><tbody>{Object.entries(seg ? (c.tps[seg.id] ?? {}) : Object.values(c.tps).reduce((acc, m) => { for (const [k, v] of Object.entries(m)) { const a = acc[k] ?? { total: 0, injury: 0, bicycle: 0, pedestrian: 0, ftr: 0 }; acc[k] = { total: a.total + v.total, injury: a.injury + v.injury, bicycle: a.bicycle + v.bicycle, pedestrian: a.pedestrian + v.pedestrian, ftr: a.ftr + v.ftr } } return acc }, {} as Record<string, { total: number; injury: number; bicycle: number; pedestrian: number; ftr: number }>)).sort().reverse().map(([m, d]) => <tr key={m}><td>{m}</td><td>{d.total}</td><td>{d.injury}</td><td>{d.bicycle}</td><td>{d.pedestrian}</td></tr>)}</tbody></table>}>
        {tpsCovers(c, ym) ? <><Row><Big v={tps.total} label="police-reported collisions" /><Big v={tps.injury} label="with an injury" /><Big v={tps.bicycle} label="involving a bicycle" /><Big v={tps.pedestrian} label="involving a pedestrian" /></Row><p className="sub">A count, not a rate: not adjusted for how many people used the street.</p></> : <Empty>Police collision data covers {c.coverage.tps?.[0]} to {c.coverage.tps?.[1]}.</Empty>}
        {ksiCovers(c, ym) && ksi.length > 0 && <ul className="list">{ksi.map((k, i) => <li key={`${k.collision_id}-${i}`}>{k.date}: {k.road_user.toLowerCase()} {k.injury.toLowerCase()} ({k.acclass.toLowerCase()})</li>)}</ul>}
        {!ksiCovers(c, ym) && <p className="sub">Killed-or-seriously-injured records cover {c.coverage.ksi?.[0]} to {c.coverage.ksi?.[1]}.</p>}
      </Tile>

      <Tile title="Weather" story={weatherCovers(c, ym) && w.days ? <>{ml} averaged <b>{fmt(w.tmean, 1)} °C</b> with {w.rain} rainy days{w.snow ? `, ${w.snow} snow days` : ''}{w.heat ? `, ${w.heat} days at 30 °C or more` : ''}{w.freezing ? `, ${w.freezing} days below freezing` : ''}.{wly?.tmean != null && w.tmean != null ? <> {ly} averaged {fmt(wly.tmean, 1)} °C with {wly.rain} rainy days.</> : null}</> : undefined}
        raw={<table><thead><tr><th>day</th><th>mean °C</th><th>low</th><th>high</th><th>mm</th><th>conditions</th></tr></thead><tbody>{c.weather.filter(d => d.date.startsWith(ym)).map(d => <tr key={d.date}><td>{d.date}</td><td>{fmt(d.tmean, 1)}</td><td>{fmt(d.tmin, 1)}</td><td>{fmt(d.tmax, 1)}</td><td>{fmt(d.precip, 1)}</td><td>{d.cond.join(', ').replace(/_/g, ' ')}</td></tr>)}</tbody></table>}>
        {weatherCovers(c, ym) && w.days ? <><Row><Big v={w.rain} label="rainy days" /><Big v={w.snow} label="snow days" /><Big v={w.fog} label="fog or haze" /><Big v={w.freezing} label="days below 0 °C" /><Big v={w.heat} label="days at 30 °C+" /></Row><p className="sub">Temperatures from the Toronto City station; conditions from the island airport, which sees more fog than Bloor.</p></> : <Empty>Weather is archived from {c.coverage.weather?.[0]} onward.</Empty>}
      </Tile>

      <Tile title="Street works" story={rest.length ? <><b>{rest.length}</b> City road restriction{rest.length === 1 ? '' : 's'} on {where} in {ml}.</> : undefined}
        raw={rest.length ? <table><thead><tr><th>what</th><th>where</th><th>from</th><th>to</th></tr></thead><tbody>{rest.map(r => <tr key={r.id}><td>{r.type}</td><td>{r.name}</td><td>{r.start}</td><td>{r.end || 'open'}</td></tr>)}</tbody></table> : undefined}>
        {rest.length ? <ul className="list">{rest.slice(0, 5).map(r => <li key={r.id}>{r.type}: {r.name}</li>)}{rest.length > 5 && <li>and {rest.length - 5} more in the raw data</li>}</ul> : <Empty>{ym >= c.corridor.snapshot.slice(0, 7) ? `No City road restriction on ${where} in ${ml}.` : `Road restrictions are only known from ${c.corridor.snapshot} onward; the City publishes the current list, not history.`}</Empty>}
      </Tile>

      {cams.length > 0 && <Tile title="Right now at the intersection" story={<>Live City traffic-camera stills at {[...new Set(cams.map(k => k.station))].join(' and ')}. These show the street <b>as it is now</b>, not in {ml}; the City keeps no archive.</>}>
        <div className="cams">{cams.slice(0, 4).map((k, i) => <figure key={k.image + i}><img src={k.image} alt={`Traffic camera at ${k.name}`} /><figcaption>{k.station}{cams.filter(o => o.station === k.station).length > 1 ? ` · camera ${cams.filter(o => o.station === k.station).indexOf(k) + 1}` : ''}</figcaption></figure>)}</div>
        <p className="sub">Images refresh every few minutes and are shown directly from the City's server. Nothing is stored by this site.</p>
      </Tile>}

      <Tile title="Bike Share and bike lanes" story={bs ? <><b>{bs.stations}</b> Bike Share stations with {bs.capacity} docks sit within 250 m of {where}.</> : undefined}>
        {bs ? <Row><Big v={bs.stations} label="Bike Share stations" /><Big v={bs.capacity} label="docks" /></Row> : <Empty>No Bike Share station within 250 m.</Empty>}
        {design.length ? <p className="sub">City-mapped cycling infrastructure: {seg ? design.map(d => `${d.infra.toLowerCase()} from ${d.from} to ${d.to}, installed ${d.installed}`).join('; ') : `${design.length} mapped sections, installed ${Math.min(...design.map(d => parseInt(d.installed)).filter(n => !isNaN(n)))} to ${Math.max(...design.map(d => parseInt(d.installed)).filter(n => !isNaN(n)))}`}.</p> : <p className="sub">The City maps no cycling infrastructure on {where}.</p>}
      </Tile>
    </div>
  )
}

export const Tiles = memo(TilesInner)
