# alchemy-state-viewer: per-PR previews

## Status

**Parked** (2026-07-21). Spun out of the initial app bring-up, where previews were deliberately
deferred: the shared `preview-wrangler` action hard-requires a Playwright screenshot suite
(`pnpm run test:e2e`), and the app shipped without one. Pick this up once the viewer is wired to the
real state store and UI changes start to churn.

## Goal

Every PR touching `apps/alchemy-state-viewer` gets a deployed preview URL, smoked and
screenshot-diffed, via the shared `.depot/actions/preview-wrangler` action -- the same rig
revision.city uses.

## Steps

- [ ] Minimal Playwright e2e suite: co-located `*.e2e.test.ts` (no `describe`, no hooks), starting
      with the home page -- assert the unconfigured setup panel renders and take the visual baseline
      there, since it is the one deterministic page.
- [ ] `playwright.config.ts` mirroring revision.city's dual-mode shape: `PREVIEW_URL` set (CI
      preview) means no local boot; unset means boot the production build locally. This app's local
      boot is `wrangler dev` on `.svelte-kit/cloudflare/_worker.js` (the same boot
      `bin/smoke-local.ts` uses), not `vite preview`.
- [ ] `test:e2e` / `test:e2e:update` package scripts and a `test:e2e` mise task with
      `depends = ["build"]`, matching the other apps.
- [ ] `cd-preview-alchemy-state-viewer.yml` calling `preview-wrangler` with
      `worker-name: alchemy-state-viewer`, path-filtered to the app + the action + `bin/**`.
- [ ] A snapshot-update bot workflow (`bot-update-snapshots-*`, path-scoped like djf.io's and
      forzamonica.com's) once baselines exist and start churning.

## Design note: previews inherit the worker's secrets

`wrangler versions upload` creates a version of the same worker, so once `APP_PASSWORD` /
`ALCHEMY_STATE_*` are set in production, preview versions serve the real (Basic-auth-gated) app --
and the action's unauthenticated smoke/screenshot probes of `/` will see 401, not the setup page.
The preview flow must handle that before this lands: either pass Basic credentials into the smoke
and Playwright requests (a repo secret), or treat a 401-with-challenge as "serving" for smoke and
keep screenshots to pages that render unauthenticated. Decide when picking this up; the plan should
not assume the secret-free bring-up state.

## Related

- Parent umbrella: [alchemy-state-viewer](../alchemy-state-viewer/plan.md)
- App location: `apps/alchemy-state-viewer/`
- Reference rig: `.depot/workflows/cd-preview-revision-city.yml`,
  `apps/revision.city/playwright.config.ts`, `.depot/actions/preview-wrangler/`
