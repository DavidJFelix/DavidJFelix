### fix(tooling): keep the deployed-app link in preview comments when smoke or screenshots fail

The sticky per-PR preview comment reported one lumped "Smoke + screenshots" status next to the
preview link, so a red smoke run read as an undifferentiated failure with nothing in the comment
saying the app itself deployed fine. `bin/comment-preview.ts` now takes the three stage outcomes
(`PREVIEW_DEPLOY_OUTCOME`, `PREVIEW_SMOKE_OUTCOME`, `PREVIEW_E2E_OUTCOME`, wired from the steps'
`outcome` values in both preview actions and the f311x workflow) and renders one line per stage.

The deployed-app link is keyed to the deploy outcome alone: it renders whenever the deploy step
itself succeeded, so a failing smoke test or screenshot suite keeps the URL needed to open the
preview and see what is wrong, while smoke and screenshots each report passed, failed, or skipped. A
deploy that succeeded without yielding a URL is labeled as such instead of masquerading as a failed
deploy; an actually failed deploy still explains itself without a link. The comment body builder is
now a pure exported function with unit tests.
