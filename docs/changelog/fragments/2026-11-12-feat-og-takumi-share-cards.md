### feat(og): render share cards with Takumi on WebAssembly

The share card renderer in `@davidjfelix/og` now uses Takumi (`@takumi-rs/wasm`) in place of satori
and resvg. Takumi makes the card layout and draws the PNG in one WebAssembly module, which loads on
Cloudflare Workers the same way as the old modules. The cards keep their layout; some text moves by
a few pixels at most. In a local benchmark, a card after the first renders in about 6 ms in place of
about 23 ms. The fonts are now WOFF2 files, because Takumi does not read WOFF. Each Worker upload
grows by about 0.7 MB gzipped. The package tests now compare three cards with committed PNG
snapshots and measure the card layout. Takumi draws text directly to pixels, with no SVG step. So
the `ogSvg` export and the SVG text test that pinned satori's advisory are gone, and so are satori,
`@resvg/resvg-wasm`, and the Renovate rule that held satori at 0.32. The apps' comments no longer
describe how the og package works; its README does.
