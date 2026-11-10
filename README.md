# WRDHOUND

WRDHOUND is a four letter word chase game. Reach the EXIT by changing exactly one letter per move while staying outside the Hound's immediate reach.

## Run locally

Use a local HTTP server so the service worker and installable app features work:

```bash
python -m http.server 8000
```

Open `http://localhost:8000/` in a modern browser.

## Rules

- Every move must be a valid four letter dictionary word.
- A move changes exactly one letter.
- The Hound moves after each non winning move.
- The Hound chooses the adjacent word that minimizes its graph distance to the runner. Alphabetical order breaks ties.
- Moving onto the EXIT wins immediately.
- Hints calculate a winning route and play its next move. The hint charge and move charge are both deducted.
- Campaign progress is saved locally in the browser. Challenge links encode the starting runner, Hound, and EXIT words.

## Files

- `index.html`: default web entry point.
- `hound.html`: standalone game page.
- `hound.css`: responsive interface, themes, and motion.
- `hound.js`: graph construction, puzzle generation, chase solver, persistence, and UI.
- `dictionary.js`: 3,889 unique four letter words.
- `manifest.webmanifest`, `sw.js`, and `icon-*.png`: installable PWA and offline app shell.
- `tests/core.test.cjs`: graph and puzzle solver regression checks.

## GitHub Pages deployment

The repository includes a GitHub Actions workflow that runs JavaScript syntax checks, gameplay regression tests, and PWA metadata validation before deployment. Every push to `main` triggers it.

**One time repository setup is required:** open **Settings → Pages → Build and deployment**, then set **Source** to **GitHub Actions**. The GitHub integration used to update this repository cannot change this administrative setting. Once selected, the workflow will publish automatically after the test job succeeds.

Published URL: https://kaelith69.github.io/WRDHound/

## Install as an app

- **Android and desktop Chromium:** open the published HTTPS site and use the browser's Install option when offered. Chrome, Edge, and other supported browsers may expose installation in the address bar or browser menu.
- **iPhone and iPad:** open the site in Safari, tap **Share**, then **Add to Home Screen**. iOS does not expose the Chromium `beforeinstallprompt` event.
- The web app manifest defines the app name, icons, standalone display mode, start URL, and scope. The service worker precaches the game shell and dictionary so the app can launch offline after its first successful load.

## Verify

Requires Node.js:

```bash
node --check hound.js
node --check sw.js
node tests/core.test.cjs
```

The game is static and has no build step or runtime server dependency. The service worker requires HTTPS or localhost.

## First-run onboarding and progression

- A three-step field guide appears on the first visit and stays dismissed after completion or skip. The guide remains available from the `?` button.
- The guide explains legal word changes, the Hound's danger patterns, the gap meter, route planning, hints, and autosaving.
- Campaign puzzles scale in two-level tiers: target distance and minimum strategic detours increase, the supported par ceiling rises gradually, and the move allowance tightens every three levels.
- The chase UI uses shared view transitions when supported and respects reduced-motion preferences.
- Small-screen layouts account for safe areas, narrow widths, short viewports, and wrapping action controls.

The game is designed around clear goals, fast feedback, player agency, and a gradual skill challenge. It avoids forced streaks, punitive daily timers, and manipulative loss aversion.
