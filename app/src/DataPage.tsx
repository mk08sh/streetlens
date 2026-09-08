import type { Corridor as C } from './types'
import { fmt } from './data'

export function DataPage({ c }: { c: C }) {
  return (
    <article className="page">
      <h1>Data</h1>
      <p className="lede">Everything on this site comes from the snapshot taken on {c.corridor.snapshot}. Each file in a snapshot is recorded with its URL, size and SHA-256 hash so any number can be traced to its source.</p>
      <p><a href="/data/toronto-bloor-west.json" download>Download the derived corridor file (JSON, ~0.4 MB)</a>. It contains every value shown on the site, per stretch and per station.</p>
      <h2>What is covered, and from when</h2>
      <table className="cov">
        <tbody>
          <tr><td>Automatic bicycle counters</td><td>{c.coverage.counters?.join(' to ')}</td><td>4 counters on the corridor, daily</td></tr>
          <tr><td>City intersection counts</td><td>1984 to 2026</td><td>{Object.values(c.tmc).reduce((a, l) => a + l.length, 0)} counts at 18 stations, one day each, years apart</td></tr>
          <tr><td>Police collisions, all severities</td><td>{c.coverage.tps?.join(' to ')}</td><td>monthly, offset to nearest intersection</td></tr>
          <tr><td>Killed or seriously injured</td><td>{c.coverage.ksi?.join(' to ')}</td><td>{fmt(Object.values(c.ksi).reduce((a, l) => a + l.length, 0))} people, on the street</td></tr>
          <tr><td>Subway station usage</td><td>{c.subway_usage ? Object.values(c.subway_usage.periods).map(p => p.covers).join('; ') : '—'}</td><td>annual, typical weekday</td></tr>
          <tr><td>Subway delays</td><td>{c.coverage.subway_delays?.join(' to ')}</td><td>per station, per delay</td></tr>
          <tr><td>Weather</td><td>{c.coverage.weather?.join(' to ')}</td><td>hourly, two downtown stations</td></tr>
          <tr><td>Road restrictions</td><td>{c.coverage.restrictions[0]} onward</td><td>current list only; history accumulates from snapshots</td></tr>
          <tr><td>Bike Share stations</td><td>{c.corridor.snapshot}</td><td>point in time</td></tr>
        </tbody>
      </table>
      <h2>Sources</h2>
      <table className="sources">
        <thead><tr><th>Dataset</th><th>Publisher</th><th>Updated</th><th>What it cannot tell you</th></tr></thead>
        <tbody>{c.sources.map(s => <tr key={s.id}><td><a href={s.dataset} target="_blank" rel="noreferrer">{s.title}</a></td><td>{s.publisher}</td><td>{s.cadence}</td><td>{s.limits}</td></tr>)}</tbody>
      </table>
      <h2>Not open</h2>
      <ul>{c.not_open.map(s => <li key={s}>{s}</li>)}</ul>
      <p className="sub">Points more than {c.corridor.max_offset_m} m from the street were excluded: {fmt(c.dropped.ksi_off_corridor)} KSI rows and {fmt(c.dropped.tps_off_corridor)} police collision rows from the surrounding band.</p>
    </article>
  )
}
