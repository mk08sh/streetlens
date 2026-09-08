# Registered analysis plan: Bloor St W, Yonge to Kipling

**Status: draft v0.1, opened 2026-09-04. Becomes registered when frozen by pull request before any post-change data is analysed.**

This plan is written before the results exist. It names the questions, the measures, the comparison segments, and the rules in advance so that neither the project nor its readers can pick a framing after the fact.

## Questions

Q1. After a segment's design changes, how do vehicles per hour, bicycles per hour, and people moved per hour through its boundary intersections change relative to comparison segments over the same calendar weeks?

Q2. How does the collision rate per road user change, exposure-adjusted, relative to comparison segments?

Q3. How much construction exposure does each segment carry per month, and how do Q1 and Q2 look when construction months are held out?

Q4. What do corridor users, residents, and business operators report about safety and satisfaction each quarter, segmented by verified use? (Release 3)

## Treated segments as of 2026-09-04

- `seg:royal-york-islington`, sub-extent Resurrection Rd to Clissold Rd, reconfigured 2025-12, vehicle lane restored and bike lane retained.

No other segment is treated. Segments are added to this list only when a change is observed on the ground and logged in `interventions.yaml`, never on announcement.

## Comparison segments

Primary within-corridor comparison for the Etobicoke section: `seg:jane-old-mill` and `seg:old-mill-royal-york`, which share the permanent counter east of Old Mill Trl and the 2026-05 count sweep.

Cross-corridor comparisons are to be named before freezing. Candidates must have similar road class, a permanent bicycle counter, and no design change in the study window.

## Measures and sources

| Measure | Source | Segment coverage |
|---|---|---|
| Bicycles per day, per direction | Permanent counters 3/4, 5/6, 8/9, 12/13 | 4 segments continuously |
| Vehicles, bicycles, pedestrians per count day | Turning movement counts at boundary intersections | All 18 boundaries, irregular |
| KSI collisions by road user | KSI dataset, deduplicated on collision_id | All, ~1 year lag |
| All collisions by severity | TPS collisions | All, ~1 year lag |
| Construction days per month | Road restrictions snapshots | All, from 2026-09-04 forward only |
| Temperature, precipitation | ECCC Toronto City hourly | Corridor-wide |

## Rules frozen with this plan

- Same calendar weeks. Weekday matched. Weather-adjusted for bicycle volumes using a published linear model on daily mean temperature and precipitation, fitted on 2023 to 2025 data from the same counter.
- Construction is its own phase.
- Difference-in-differences against the named comparison segments.
- Minimum data thresholds for publishing a comparison: at least 8 weeks of counter data in each phase, or at least one turning movement count in each phase at the same intersection.
- No comparison is published for a segment that lacks the thresholds. The interface shows "insufficient data" instead.

## What this plan does not do

It does not estimate business revenue, insurance claims, emergency response times, or origin-destination flows. Those sources are not open. Their absence is stated, not filled.

## Freezing

When frozen, this file gains a `registered:` date and a git tag `analysis-plan-v1`. Changes after that are amendments appended below with a date and reason, never edits above the line.
