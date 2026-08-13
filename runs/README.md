# Runs page

The page reads generated public data from `/runs/data/`; it never receives Strava credentials. `runs-data.js` is included so the page also works when opened directly from the filesystem.

## First-time setup

1. Create a Strava API application at <https://www.strava.com/settings/api>.
2. Add `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_REFRESH_TOKEN`, and `STRAVA_TOKEN_STORE_KEY` as GitHub Actions repository secrets. The refresh token must be authorized with the `activity:read_all` scope. Create the token-store key with `openssl rand -base64 32`.
3. Run the **Sync Strava runs** workflow manually once from GitHub Actions. It then runs daily.

Only activities whose Strava visibility is `everyone` are published by default. Set the repository variable `STRAVA_INCLUDE_PRIVATE` to `true` only if you explicitly want private activities published on this public website. Route starts and ends are trimmed by 300m by default; set `STRAVA_ROUTE_TRIM_METERS` to another value to change it.

The dashboard charts pace, distance, frequency, and average heart rate (when the run has heart-rate data in Strava). Heart-rate values are published in the static dataset, so do not enable the page if you do not want those values public.

Strava may rotate refresh tokens. After the initial run, the workflow persists the current token in an AES-256-GCM encrypted file; only the `STRAVA_TOKEN_STORE_KEY` secret can decrypt it. Do not remove that secret.

## Importing a one-time Strava export

Run `node scripts/import-strava-export.mjs /path/to/strava-export.zip`. It imports every activity whose type contains “Run”, uses the export's moving time, distance, and average heart rate, and trims GPX and FIT route ends by 300m.
