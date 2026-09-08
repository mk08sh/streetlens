# StreetLens

**Open evidence about how streets and neighbourhoods actually work, for anyone making decisions about them.**

StreetLens is an open-source, non-partisan civic project. It aggregates public data about a street corridor, records every change made to that corridor in an immutable public log, and lets residents contribute observations. The goal is to ground public-service decisions in the lived experience of the people who use the street, continuously, instead of in a one-time impact report.

The first corridor is **Bloor Street West, Toronto, from Yonge Street to Kipling Avenue**, segmented by Line 2 subway station.

## What this is, and is not

- It is a **measurement protocol and a public archive first**, and a dashboard second. The "before" state of a street cannot be recreated once it changes. Capturing it is the urgent part.
- It publishes **evidence, methods, and uncertainty**. It does not publish conclusions. Any interpretation is signed, versioned, and open to correction.
- It is **neutral by construction**, not by promise. The analysis plan is registered before results exist, every metric is shown beside its counter-metric, and gaps in the data are shown as gaps.
- It is **one repository for many cities**. A city joins by adding a folder that conforms to the shared schema. Every conforming city renders on the same site. Nothing is scattered across forks.

## Principles

1. Segment, don't generalize. The unit of analysis is a street segment in a fixed time window, never "the street".
2. People moved per hour is always shown beside vehicles per hour.
3. Safety is always shown as a rate per exposure, never only as a count.
4. Every comparison is season- and weather-normalized, or it is labelled as raw.
5. No metric is ever displayed alone.
6. Missing data is displayed as missing. Nothing is interpolated to fill a chart.
7. Construction is its own phase. It is never folded into "after".
8. No sale of data. No advertising SDKs. No raw GPS traces. Anonymous contribution is always allowed.

See [docs/methodology.md](docs/methodology.md), [docs/analysis-plan.md](docs/analysis-plan.md) and [docs/data-use-norms.md](docs/data-use-norms.md).

## Repository layout

```
core/
  schema/       JSON Schemas every city folder must satisfy
  ingest/       snapshot.py: downloads every source listed by a city into a dated archive
  derive/       build_corridor.py: aggregates one snapshot into a compact JSON for the UI
app/            local UI: corridor schematic, time slider, detail panel
cities/
  toronto/
    sources.yaml            source catalogue with URLs, licences, cadence, and known limits
    bloor-west/
      segments.geojson      18 station-bounded boundaries, 17 segments
      interventions.yaml    immutable log of every change to the corridor
      sensors.yaml          permanent counters and signalized intersections on the corridor
docs/                       methodology, registered analysis plan, data-use norms, governance
data/snapshots/YYYY-MM-DD/  dated raw archives (git-ignored; see "Archive storage")
```

## Quick start

```bash
pip install -r requirements.txt
python core/ingest/snapshot.py --city toronto            # snapshot every "small" source
python core/ingest/snapshot.py --city toronto --full     # include the large raw count files
python core/ingest/validate.py                           # check every city folder against the schema
python core/derive/build_corridor.py --snapshot YYYY-MM-DD   # aggregate a snapshot into app/public/data/
cd app && npm install && npm run dev                     # local UI on http://localhost:5175
```

The UI (`app/`, Vite + React, no chart library) is the corridor schematic, a time slider over every archived observation, and a detail panel where every metric is shown beside its counter-metric. It reads only the derived JSON, so every number on screen traces to a hashed file in a snapshot manifest.

Each run writes `data/snapshots/<date>/<source-id>.<ext>` plus a `manifest.json` with the URL, timestamp, byte size and SHA-256 of every file fetched.

## Archive storage

Snapshots are git-ignored because raw count files are hundreds of megabytes. The intended home for them is a public object store or GitHub release assets, with the manifest committed to the repo so every published number can be traced to a hashed file. Until that is set up, keep snapshots locally and back them up.

## Roadmap

- **Release 1, baseline archive (this repo, now).** Segments, interventions log, source catalogue, registered analysis plan, scheduled snapshots.
- **Release 2, public corridor view.** Schematic corridor map as the primary interaction, a time slider over historical data with event markers and a data-density strip, weather as a layer, cars and people moved side by side.
- **Release 3, resident contributions.** One-tap condition reports with expiry by type, confirmations, optional verified presence, quarterly pulse surveys segmented by verified use.

## Licence

Code: [AGPL-3.0](LICENSE). Derived data and documentation: [CC BY 4.0](LICENSE-DATA). Imported data keeps its original licence; see each entry in `cities/*/sources.yaml`.
