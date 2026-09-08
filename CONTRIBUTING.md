# Contributing

Thank you. Three kinds of contribution matter most right now, in this order.

## 1. Verify an interventions entry

`cities/toronto/bloor-west/interventions.yaml` has entries marked `unverified` or `reported`. Find the primary source, such as a Council decision item, a City notice, or a court decision, add its URL under `sources`, and set `status: verified`. Open a pull request with the source linked in the description.

## 2. Add or improve a data source

Edit `cities/<city>/sources.yaml`. Every source needs an id, publisher, dataset page, licence key, cadence, size, layer, fetch instructions, and a `limits` line saying what the data cannot tell you. Run `python core/ingest/snapshot.py --city <city> --only <id>` to prove it fetches, and `python core/ingest/validate.py`.

## 3. Add a city

1. Copy `cities/toronto/` to `cities/<your-city>/`.
2. Replace `sources.yaml` with your city's open data. Keep the `not_open` list honest.
3. Define one corridor: `segments.geojson` with boundaries and segments, `interventions.yaml`, `sensors.yaml`.
4. Run `python core/ingest/validate.py` until it passes.
5. Add yourself to MAINTAINERS.md as the city maintainer.
6. Open a pull request. The main site renders every city folder that validates.

## Ground rules

- Keep the methodology and the data separate. A pull request that changes both is split.
- No interpretation in data files. Notes describe what a source is and what it lacks, not what it means.
- No projected dates in the interventions log. Events are recorded when they happen or are formally announced.
- Run `python core/ingest/validate.py` before every pull request.

## Code

Python 3.11+, standard library where possible. The snapshot script deliberately has one dependency. Keep it that way until there is a reason not to.
