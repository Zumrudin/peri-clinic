# YCLIENTS pricing refresh · 2026-09-19

Scope: 75 additions, 8 changed rows, no deletions; 296 rendered rows in 8 groups.
Migration backups: `scripts/migrate/out/yclients-prices/1789838275518/` and
`scripts/migrate/out/yclients-prices/1789838477435/` (gitignored).

Validation:
- Astro check: no errors or warnings (existing deprecation hints).
- Astro build: 44 pages generated.
- Migration dry-run after apply: 0 updates, 0 additions, 0 deletions.
- `scripts/qa/yclients-prices.mjs`: all 75 additions and 8 changes verified in HTML fetched from the external dev host.
- External dev browser checks passed at 320 / 375 / 800 / 1440 px: navigation, back/forward history, direct links, keyboard, no horizontal page overflow, zero serious/critical axe violations.
- With JavaScript disabled, all categories remain visible and native accordions work.
- Final dev release: `/srv/peri/releases/2026-09-19T17-29-27`.

The broad SEO audit reports 6 pre-existing issues on `/spravka` and specialist
metadata. Running the same audit against the pre-change release
`/srv/peri/releases/2026-09-19T17-00-12` returns exactly the same issues.

Dev only. Production database and deployment were not changed.
Report: https://dev.zumrudin.ru/peri-concepts/pricing-2026-09-19-1728/report.html
