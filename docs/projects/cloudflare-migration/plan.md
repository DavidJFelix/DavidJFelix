# Cloudflare Migration

## Goal

Migrate all Vercel-hosted projects to Cloudflare Pages, deploying via GitHub Actions.

## Scope

- All apps currently deployed on Vercel
- Target platform: Cloudflare Pages (static assets) or Cloudflare Workers (SSR)
- Includes build, deploy, DNS, and env/secret migration

## Apps

| App | Type | Status |
|-----|------|--------|
| `apps/ravrun` | Static SPA (Vite + React) | In progress |
| `apps/calendar-visualizer` | TBD | Not started |
| `apps/djf.io` | Astro SSR/SSG | Not started |

## Migration Playbook (per app)

### Agent tasks

1. Create `.github/workflows/<app>-deploy.yml` using the ravrun workflow as a template
2. Adjust build command, output directory, and project name for the app
3. If the app needs env vars at build time, add them to the workflow via secrets
4. Update this plan and create a progress file

### Human tasks

1. **Cloudflare Dashboard**: Create a Cloudflare Pages project (name must match `--project-name` in the workflow)
2. **GitHub Secrets**: Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` to the repo (one-time, shared across all apps)
   - API token needs: Cloudflare Pages edit permission
3. **Custom domain**: In Cloudflare Pages project settings, add the custom domain
4. **Verify**: Push to main, confirm the Action runs and the site is live
5. **Teardown**: Remove the Vercel project once Cloudflare is confirmed working

## Architecture

- **Deploy trigger**: GitHub Actions on push to `main`, scoped by path filter to the app directory
- **Build**: Runs in CI using mise-managed tooling (same as other workflows)
- **Deploy**: `wrangler pages deploy` via `cloudflare/wrangler-action@v3`
- **Secrets**: `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` stored as GitHub repo secrets
