# Cloudflare Migration

## Goal

Migrate all Vercel-hosted projects to Cloudflare Pages, deploying via GitHub Actions.

## Scope

- All apps currently deployed on Vercel
- Target platform: Cloudflare Workers (with Static Assets for SPAs, Workers for SSR)
- Includes build, deploy, DNS, and env/secret migration

## Apps

| App | Type | Status |
|-----|------|--------|
| `apps/ravrun` | Static SPA (Vite + React) | Done (pending secrets + domain) |
| `apps/calendar-visualizer` | Static (Astro + React) | Done (pending secrets + domain) |
| `apps/djf.io` | Static (Astro + MDX + React) | Done (pending secrets + domain) |

## Migration Playbook (per app)

### Agent tasks

1. Add `wrangler.toml` to the app with `[assets]` config (static) or worker script (SSR)
2. Create `.github/workflows/<app>-deploy.yml` using the ravrun workflow as a template
3. Adjust build command, output directory, and project name for the app
4. If the app needs env vars at build time, add them to the workflow via secrets
5. Update this plan and create a progress file

### Human tasks

1. **GitHub Secrets**: Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` to the repo (one-time, shared across all apps)
   - API token needs: Workers Scripts edit permission
2. **Custom domain**: In Cloudflare dashboard, add a Custom Domain route to the Worker
3. **Verify**: Push to main, confirm the Action runs and the site is live
4. **Teardown**: Remove the Vercel project once Cloudflare is confirmed working

## Architecture

- **Deploy trigger**: GitHub Actions on push to `main`, scoped by path filter to the app directory
- **Build**: Runs in CI using mise-managed tooling (same as other workflows)
- **Deploy**: `wrangler deploy` via `cloudflare/wrangler-action@v3` (Workers Static Assets for SPAs)
- **Config**: `wrangler.toml` in each app directory with `[assets]` block pointing to build output
- **Secrets**: `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` stored as GitHub repo secrets
