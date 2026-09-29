# Certificate consent — 2026-09-28

- `npm run check`: 0 errors, 0 warnings, 333 existing project hints.
- `npm run build`: success, 44 pages.
- `node scripts/qa/certificate-consent.mjs`: pass. Intercepted API only; no real submissions.
- Backend: `node --test backend/services/cert-consent.test.js backend/services/cert-request.test.js`: 22 passing.
- After final nullable-evidence adjustment, repeated cert-consent suite: 6 passing.
- Browser: separate unchecked checkbox; independent policy; exact version/hash payload;
  missing/stale config blocks; stale POST unchecks and disables; document links; iframe.
- Widths 375/800/1440: no horizontal overflow, axe zero serious/critical form findings.
- Production migration and real DB integration NOT run. Production deployment pending approval.

The snapshots and CMS body use SHA-256(title + LF + body); edits require a new immutable revision.
The database evidence is server-owned; old rows deliberately remain without a known revision.

## Production validation

User approved deployment. Production column migration and backend/site rollout completed 2026-09-28.
Release 2026-09-28T15-25-45. New consent page, policy, index and form return 200.
Published consent text matches snapshot; config/form version and SHA match.
Two intentionally invalid POSTs without patient fields rejected with 400 (no requests created).
`node scripts/qa/cert-request.mjs https://www.peri-clinic.ru docs/qa/certificate-consent/production`: PASS.
Only config/isolation GETs reached API in the browser suite; submissions/PDF intercepted.
