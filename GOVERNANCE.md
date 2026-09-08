# Governance

StreetLens is a non-partisan public-good project. It has no client and no sponsor with a position on the policy questions its data touches.

## Roles

- **Maintainers** merge code and content. Listed in MAINTAINERS.md with affiliations.
- **City maintainers** own a `cities/<city>/` folder: its source catalogue, segments, interventions log and sensor register. One or more per city.
- **Methodology advisory group** reviews the methodology, the analysis plan, and any published interpretation. Members are chosen to hold different views on the policy questions in scope. Membership, affiliations and disclosures are public. The group does not vote on findings. It reviews whether the rules in `docs/methodology.md` were followed.

## Decisions

- Methodology and analysis-plan changes require a pull request, a review from at least one advisory group member, and an entry in the methodology changelog.
- Interventions log entries require a primary source to be marked verified. Anyone can propose an entry. Entries are appended, never deleted; errors get a dated correction note.
- A new city is accepted when its folder passes `core/ingest/validate.py`, names a city maintainer, and lists its licences.

## Funding

All funding sources and in-kind contributions are listed in FUNDING.md with amounts and any conditions. Funding conditional on a finding or framing is refused.

## Interpretations

The site publishes data and methods. Written interpretations, if any, are signed by a named author, versioned, and reviewed by the advisory group before publication. Disagreement within the group is published alongside.

## Corrections and citations

`docs/corrections.md` and `docs/cited-in.md` are public and maintained by the maintainers. See `docs/data-use-norms.md`.
