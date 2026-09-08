# Methodology

This document is the contract between the project and its readers. It says what we measure, how, and what a chart on this site can and cannot show. It changes only by pull request, and every change is logged in [CHANGELOG-methodology.md](CHANGELOG-methodology.md).

## 1. Unit of analysis

The unit is a **corridor segment during a fixed time window**. For Bloor West the segments are bounded by the Bloor St W intersections at each Line 2 station cross-street, Yonge to Kipling, 17 segments over about 12.4 km. Segment definitions live in `cities/toronto/bloor-west/segments.geojson` and are versioned. A segment is never redrawn after data has been published against it. If a better boundary is needed, a new segment set is created with a new version and both are kept.

The time window depends on the source. Permanent counters and weather are 15-minute and hourly. Turning movement counts are single days. Collisions are events. The site never presents a source at finer resolution than it was collected.

## 2. Layers

| Layer | Sources (Toronto) | Native resolution |
|---|---|---|
| Movement | Turning movement counts, permanent bicycle counters, TTC subway delays, Bike Share station status | 15 min to one day, irregular |
| Safety | KSI collisions, Police all-severity collisions | Event, refreshed annually |
| Weather | ECCC Toronto City hourly | Hourly |
| Operations | Road restrictions, cycling network geometry | Point-in-time snapshots |
| Community | Resident reports and surveys (Release 3) | Event |
| Context | Centreline, census population | Static to five-yearly |

## 3. Core measures

- **People moved per hour** through a boundary intersection: vehicles × assumed occupancy + bicycles + pedestrians + transit riders where a transit count exists. The occupancy assumption is published and fixed for the study period. Vehicles per hour is always displayed beside it.
- **Bicycle volume** from permanent counters, daily and 15-minute, by direction.
- **Collision rate** = collisions per 100,000 estimated segment trips for that road user. Counts are always displayed beside rates. Where exposure cannot be estimated, only the count is shown and the rate is marked unavailable.
- **Construction exposure** = days per month a segment appears in Road Restrictions.

## 4. Comparison rules

1. Same calendar weeks only. September is compared with September.
2. Weather-adjusted where the layer allows it. The adjustment model is published with its coefficients.
3. Weekday and time-of-day matched.
4. Construction periods are a separate phase, never pooled into "after".
5. Preferred design is difference-in-differences: change on a treated segment minus change on comparable untreated segments over the same dates. Comparison segments are named in the analysis plan before results exist.
6. Anything that does not meet rules 1 to 4 is labelled **raw** in the interface and cannot be exported as a "cite this view" card.

## 5. Sparse data

Turning movement counts happen at any one intersection every one to eight years. The time slider shows a data-density strip so that a reader can see where observations exist. Between observations the chart shows nothing. We do not interpolate.

## 6. What a chart on this site can and cannot show

It can show: what was measured, where, when, by whom, and how that compares with the same measure at another time or place under the stated rules.

It cannot show: that a design change caused a measured change, unless the view is a registered difference-in-differences comparison with its confounders listed. It cannot show anything about a segment or period without data. It cannot show what people think, unless the view is a survey result, in which case it shows what the respondents who answered think, segmented as described.

## 7. Contribution data (Release 3)

Resident reports carry a type, a segment, a timestamp, and optional photo with metadata stripped. Each type has an expiry. Confidence rises through independent confirmations nearby, verified presence, reporter history, and agreement with an official record. Verified presence establishes only that a device passed through a segment at a plausible time and speed. Raw traces are never stored. Trip ends are truncated before aggregation. Public trip aggregates are delayed.

## 8. Corrections

Errors are corrected in place with a dated note in the corrections log. The original is retained in version control. The corrections log is public.
