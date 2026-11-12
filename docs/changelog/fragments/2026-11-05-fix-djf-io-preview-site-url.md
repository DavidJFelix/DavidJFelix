### fix(djf.io): previews name their own URL in absolute tags

djf.io now reads `PUBLIC_SITE_URL` for its Astro `site`, as the other apps do, so a preview's
canonical link, og:url, og:image, and sitemap point at the preview instead of production. The SEO
e2e suite expects the preview origin when it runs against a preview.
