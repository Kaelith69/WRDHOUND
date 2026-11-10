# WRDHOUND UX and gameplay audit

## Findings in the supplied build

1. No first-run explanation existed. The player was dropped directly into a rules-heavy chase with no guided introduction.
2. There was no persistent way to reopen the rules after the first session.
3. Campaign difficulty used a narrow start-to-exit distance band, a low par ceiling, and a fixed move allowance.
4. Shared view transitions were used for selected actions but not consistently for normal accepted moves.
5. Small viewports needed stronger width, safe-area, wrapping, and short-height safeguards.
6. The service worker shell cache name had not been advanced for this update, risking stale installed-app assets.
7. Automated coverage exercised only early campaign levels and did not assert the presence of onboarding UI.

## Changes applied

- Added a three-step first-run field guide covering legal moves, Hound danger patterns, distance indicators, hints, and autosaving.
- Persisted guide completion or skip in local storage. Added a permanent guide control so instructions can be reopened.
- Added keyboard dismissal and focus trapping for the guide dialog.
- Expanded campaign difficulty by increasing route distance and strategic detour requirements in two-level tiers, raising the par ceiling gradually, and tightening the move allowance every three levels.
- Increased solver search depth and cap to support the expanded campaign.
- Applied shared view transitions to accepted moves while retaining the existing reduced-motion preference.
- Added compact mobile layout safeguards for narrow widths, short screens, safe areas, wrapping actions, and horizontal overflow.
- Bumped the service worker cache to `wrdhound-shell-v3`.
- Expanded automated tests across levels 0 through 20 and added onboarding and responsive CSS smoke checks.

## Design rationale

The game now applies flow theory through progressive challenge, self-determination theory through player agency and competence feedback, and strategic opponent design through the Hound's deterministic behavior. The Hound remains predictable, allowing players to learn and plan rather than depend on opaque randomness.

No forced streaks, punitive daily resets, or manipulative timers were introduced.

## Verification

- `node --check hound.js`: passed.
- `node --test tests/core.test.cjs`: passed.
- Graph invariants: 3,889 unique dictionary words, symmetric edges, exactly one changed letter per edge.
- Solver and puzzle generation: verified at campaign levels 0, 1, 2, 3, 4, 6, 9, 12, 15, and 20.
- UI smoke checks: onboarding elements, persistence hooks, guide controls, and mobile safeguards present.
- Entry pages: `index.html` and `hound.html` byte-identical.

A full interactive device matrix is still required to certify visual behavior on physical iOS and Android devices. Automated browser screenshot capture was attempted in this environment but did not complete.
