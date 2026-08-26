### fix(djf.io): serve the sitemap at its conventional paths

Crawlers and site validators probe `/sitemap.xml` (and Yoast-trained ones `/sitemap_index.xml`)
before reading robots.txt, but @astrojs/sitemap only emits `sitemap-index.xml` (plus
`sitemap-0.xml`) and has no option for other names, so both conventional paths returned 404. A small
`sitemap-alias` integration in astro.config.mjs now copies the built index to both names at
`astro:build:done`, and the seo e2e suite asserts each alias serves XML byte-identical to the index.
robots.txt keeps pointing at `sitemap-index.xml`; the aliases exist for clients that guess.
