### chore(revision.city): turn off preview URLs on the production worker

Previews upload as versions of the dev worker, so the production worker no longer needs workers.dev
preview URLs. With `preview_urls = false`, an old `pr-<N>` alias on production can no longer serve
old code with production secrets.
