# Security

This project runs no server. The site is static HTML, CSS and JavaScript built from `app/` and served from GitHub Pages; the data
pipeline in `core/` runs in GitHub Actions with read-only repository permissions and writes only to its own artifacts.

## What we collect
Nothing. The site sets no cookies, loads no analytics, and stores nothing in the browser. Camera stills are loaded directly
from the City of Toronto's servers by your browser; this project never receives or stores them.

## Reporting a vulnerability
Use GitHub's private vulnerability reporting on this repository ("Security" tab, "Report a vulnerability"). Do not open a public
issue for anything that could be exploited before it is fixed. You will get an acknowledgement within a week.

## Dependencies
Dependabot watches `app/package.json`, `requirements.txt` and the GitHub Actions used in `.github/workflows`. The site's
runtime dependencies are React and React DOM only; everything else is build tooling.

## Data
All imported data is public open data whose licences are listed in `cities/*/sources.yaml`. Collision records are published by
the City and the Toronto Police with locations already offset to the nearest intersection. This project adds no personal data
and will not accept contributions that do (see `docs/methodology.md`, section 7, for the rules planned for resident reports).
