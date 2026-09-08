import type { Corridor as C } from './types'

export function About({ c }: { c: C }) {
  return (
    <article className="page">
      <h1>About StreetLens</h1>
      <p className="lede">StreetLens is an open-source, non-partisan project that makes public data about a street visible to the people who use it, and keeps watching after decisions are made instead of stopping at a one-time report.</p>
      <p>Public decisions about streets are argued with anecdotes and with studies that end when the study ends. Meanwhile the City, the police, the TTC and Environment Canada publish measurements every day. StreetLens gathers those measurements for one corridor, keeps a dated archive so the "before" can never be lost, records every change made to the street in a public log, and shows the result in plain language, segment by segment, month by month.</p>
      <h2>How it stays neutral</h2>
      <ul>
        <li>Every number is shown beside the number that argues with it: vehicles beside people, collisions beside how many used the street.</li>
        <li>Missing data is shown as missing. Nothing is estimated to fill a gap.</li>
        <li>Comparisons are labelled raw until they are matched for season, weekday and weather.</li>
        <li>The analysis plan is written and published before results exist.</li>
        <li>Interpretations, when any are published, are signed, versioned and open to correction. The data and the code are open.</li>
      </ul>
      <h2>Who it is for</h2>
      <p>Residents who want to know what is actually happening on their street. Business owners who want evidence instead of impressions. Officials and staff who need something they can defend. Journalists who need a source they can check. Other cities who want to run the same thing for their own corridor.</p>
      <h2>The first corridor</h2>
      <p>{c.corridor.street}, Toronto, from {c.corridor.from} to {c.corridor.to}: {(c.corridor.length_m / 1000).toFixed(1)} km divided into {c.segments.length} stretches between Line 2 subway stations. It was chosen because its lanes are being changed now, the change is contested, and the City has counted it since 1984.</p>
      <h2>Resources and references</h2>
      <ul className="refs">
        {c.sources.map(s => <li key={s.id}><a href={s.dataset} target="_blank" rel="noreferrer">{s.title}</a>, {s.publisher}. {s.licence_url ? <a href={s.licence_url} target="_blank" rel="noreferrer">{s.licence}</a> : s.licence}. Updated {s.cadence}.</li>)}
        <li><a href="https://news.ontario.ca/en/release/1007962/ontario-restoring-vehicle-lanes-on-torontos-busiest-streets" target="_blank" rel="noreferrer">Ontario Restoring Vehicle Lanes on Toronto's Busiest Streets</a>, Government of Ontario news release, 1 September 2026.</li>
        <li><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>, subway station locations used to check station cross-streets. ODbL.</li>
      </ul>
      <h2>Data that is not open</h2>
      <p>Some things people ask about cannot be measured from public data. They are listed rather than guessed: {c.not_open.map(s => s.split(':')[0]).join('; ')}.</p>
      <h2>Licence</h2>
      <p>Code is AGPL-3.0. Derived data and this text are CC BY 4.0. Imported data keeps its publisher's licence, listed above.</p>
    </article>
  )
}
