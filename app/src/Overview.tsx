import type { Corridor as C } from './types'
import { bikesSameMonth, fmt, lastCounterMonth, latestTmc, monthLabel, pct, tpsRange } from './data'

/** Plain-language, corridor-wide observations computed from the archive. Descriptive only. */
export function Overview({ c }: { c: C }) {
  const snap = c.corridor.snapshot
  // People vs vehicles: latest count at every station. No then-vs-now here: older counts ran 8 hours, recent ones 14, so totals are not comparable.
  let vehNow = 0, peopleNow = 0, bikeNow = 0, pedNow = 0
  for (const b of c.boundaries) { const now = latestTmc(c, b.id, snap); if (!now) continue; vehNow += now.veh ?? 0; peopleNow += now.people ?? 0; bikeNow += now.bike ?? 0; pedNow += now.ped ?? 0 }
  const inVeh = peopleNow ? (vehNow * c.corridor.occupancy_assumption) / peopleNow * 100 : null
  const bikes = bikesSameMonth(c, lastCounterMonth(c))
  const tpsEnd = c.coverage.tps?.[1] ?? snap.slice(0, 7)
  const tpsStart = `${parseInt(tpsEnd.slice(0, 4)) - 1}${tpsEnd.slice(4)}`
  const col = tpsRange(c, null, tpsStart, tpsEnd)
  const u = c.subway_usage
  const flagged = u ? c.boundaries.filter(b => u.stations[b.id]?.note && String(u.stations[b.id].note).includes('Do not read')).map(b => b.id) : []
  const ridersByPeriod = u ? Object.keys(u.periods).sort().map(p => ({ p, v: c.boundaries.reduce((a, b) => a + ((u.stations[b.id]?.[p] as number) ?? 0), 0), vx: c.boundaries.filter(b => !flagged.includes(b.id)).reduce((a, b) => a + ((u.stations[b.id]?.[p] as number) ?? 0), 0) })) : []
  const flaggedNames = flagged.map(id => c.boundaries.find(b => b.id === id)!.station)
  const latest = c.events.filter(e => e.kind !== 'confounder' && e.status === 'verified').sort((a, b) => b.date.localeCompare(a.date))[0]

  return (
    <section className="overview">
      <h2>The longer view</h2>
      <div className="insights">
        <div className="insight">
          <div className="num">{fmt(peopleNow)}</div>
          <div className="txt">people pass through the corridor's 18 station intersections on the latest City count days: about {fmt(inVeh)}% of them in {fmt(vehNow)} vehicles, {fmt(pedNow / peopleNow * 100)}% on foot and {fmt(bikeNow / peopleNow * 100)}% on bicycles.</div>
          <div className="src">City turning-movement counts, one day per station, counted between 2024 and 2026 on different days. Subway riders are not included.</div>
        </div>
        <div className="insight">
          <div className="num">{fmt(bikes.now)}</div>
          <div className="txt">bicycles per day on average at the corridor's automatic counters in {monthLabel(lastCounterMonth(c))}{bikes.thenYm && bikes.then != null ? <>. The same {bikes.counters} counters recorded {fmt(bikes.then)} in {monthLabel(bikes.thenYm)}, a change of {fmt(Math.abs(pct(bikes.now, bikes.then) ?? 0))}% {(pct(bikes.now, bikes.then) ?? 0) >= 0 ? 'up' : 'down'}</> : null}.</div>
          <div className="src">Same counters, same calendar month, both directions. Not adjusted for weather.</div>
        </div>
        <div className="insight">
          <div className="num">{fmt(ridersByPeriod.at(-1)?.v)}</div>
          <div className="txt">subway riders use the 18 Line 2 stations along the corridor on a typical weekday.{ridersByPeriod.length > 1 ? <> Leaving out {flaggedNames.join(', ')}, whose figure changed sharply between releases, the other stations went from {fmt(ridersByPeriod[0].vx)} to {fmt(ridersByPeriod.at(-1)!.vx)}.</> : null}</div>
          <div className="src">TTC station usage tables, {ridersByPeriod.map(r => r.p).join(' and ')}. Customers to and from the Line 2 platform.</div>
        </div>
        <div className="insight">
          <div className="num">{fmt(col.total)}</div>
          <div className="txt">police-reported collisions on the corridor in the twelve months to {monthLabel(tpsEnd)}, {fmt(col.injury)} with an injury, {fmt(col.bicycle)} involving a bicycle and {fmt(col.pedestrian)} a pedestrian.</div>
          <div className="src">Toronto Police, all severities, within {c.corridor.max_offset_m} m of the street. Counts, not rates.</div>
        </div>
      </div>
      {latest && <p className="latest"><b>Latest verified change:</b> {latest.date}, {latest.kind.replace(/-/g, ' ')}{latest.extent ? `, ${latest.extent}` : ''}. {latest.notes}</p>}
    </section>
  )
}
